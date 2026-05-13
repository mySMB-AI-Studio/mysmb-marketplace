// Widget-harness backend.
//
// Reads ../plugin/.mcp.json (your plugin) AND every plugins/*/.mcp.json from a
// marketplace clone (auto-fetched on first boot). Spawns each MCP server,
// gathers each plugin's widgets/*.json, and exposes them through:
//
//   GET  /api/templates  → widgets from your plugin + every marketplace plugin
//   GET  /api/mcp/tools  → connected servers + their tools
//   POST /api/mcp/call   → { mcp, tool, params } → tool result
//
// Marketplace discovery order (first hit wins):
//   1. $HARNESS_MARKETPLACE_PATH env var (absolute path to the Plugins dir)
//   2. Walk up from the project root looking for .claude-plugin/marketplace.json
//   3. .harness-cache/marketplace/Plugins (shallow clone, fetched once)
//
// Credentials come from the host shell. Marketplace plugins whose ${VAR}s are
// unset will surface as "failed" in the MCP panel — that's expected; only your
// own plugin needs to start cleanly.

import express from 'express';
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js';
import { FileOAuthProvider } from './oauth-provider.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const PLUGIN_DIR = resolve(PROJECT_ROOT, 'plugin');
const PLUGIN_MCP = resolve(PLUGIN_DIR, '.mcp.json');
const PLUGIN_WIDGETS = resolve(PLUGIN_DIR, 'widgets');

const PORT = Number(process.env.PORT ?? 5174);
const MARKETPLACE_REPO = 'https://github.com/mySMB-AI-Studio/mysmb-marketplace.git';
const CONNECT_TIMEOUT_MS = 12000;

// Per-server bearer tokens, persisted between harness restarts so you only
// have to paste a token once. File lives outside the plugin tree so it never
// leaks into a publish; the path is .gitignored by the scaffold.
const TOKENS_FILE = resolve(PROJECT_ROOT, '.harness-cache', 'tokens.json');
function readTokens() {
  try {
    if (existsSync(TOKENS_FILE)) return JSON.parse(readFileSync(TOKENS_FILE, 'utf8'));
  } catch (err) {
    console.warn(`[harness] failed to read tokens file: ${err instanceof Error ? err.message : err}`);
  }
  return {};
}
function writeTokens(tokens) {
  mkdirSync(dirname(TOKENS_FILE), { recursive: true });
  writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
}
let tokens = readTokens();
// In-memory cache of each server's spawn args so we can reconnect after the
// user pastes a token without rescanning the marketplace.
/** @type {Map<string, { def: any, source: any, pluginRoot: string | null }>} */
const serverDefs = new Map();

// ── OAuth ────────────────────────────────────────────────────────────
// One FileOAuthProvider per http/sse server, lazily created the first time we
// connect (or the user clicks "OAuth login"). The provider persists client
// registration, tokens, and PKCE state across harness restarts.
const OAUTH_CACHE = resolve(PROJECT_ROOT, '.harness-cache', 'oauth');
const OAUTH_REDIRECT_URL = `http://localhost:${PORT}/api/oauth/callback`;
/** @type {Map<string, FileOAuthProvider>} */
const oauthProviders = new Map();
/** state → server key, populated by redirectToAuthorization. */
const stateToServer = new Map();
/** Pending "I'm waiting for an auth URL" promises, keyed by server. The
 *  /api/mcp/oauth/:server/start endpoint waits for these to resolve so it
 *  can return the URL to the browser. */
/** @type {Map<string, { resolve: (url: string) => void, reject: (err: Error) => void }>} */
const pendingRedirects = new Map();

function getOAuthProvider(serverKey) {
  let p = oauthProviders.get(serverKey);
  if (!p) {
    p = new FileOAuthProvider({
      cacheDir: OAUTH_CACHE,
      serverKey,
      redirectUrl: OAUTH_REDIRECT_URL,
      clientName: `mySMB harness — ${serverKey}`,
      onRedirect: (key, url) => {
        const state = url.searchParams.get('state');
        if (state) stateToServer.set(state, key);
        const pending = pendingRedirects.get(key);
        if (pending) {
          pending.resolve(url.toString());
          pendingRedirects.delete(key);
        }
      },
    });
    oauthProviders.set(serverKey, p);
  }
  return p;
}

// ── Marketplace discovery ────────────────────────────────────────────

function findMarketplacePlugins() {
  const fromEnv = process.env.HARNESS_MARKETPLACE_PATH;
  if (fromEnv && existsSync(join(fromEnv, 'plugins'))) {
    console.log(`[harness] using marketplace at ${fromEnv} (HARNESS_MARKETPLACE_PATH)`);
    return join(fromEnv, 'plugins');
  }

  // Walk up from the project root looking for .claude-plugin/marketplace.json.
  // Catches the case where the scaffold lives inside the marketplace repo.
  let dir = PROJECT_ROOT;
  for (let i = 0; i < 6; i++) {
    if (existsSync(join(dir, '.claude-plugin', 'marketplace.json')) && existsSync(join(dir, 'plugins'))) {
      console.log(`[harness] using marketplace at ${dir} (walked up from project root)`);
      return join(dir, 'plugins');
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  // Fallback: shallow-clone the marketplace into a per-project cache.
  const cacheRoot = resolve(PROJECT_ROOT, '.harness-cache', 'marketplace');
  const cachePlugins = join(cacheRoot, 'plugins');
  if (existsSync(cachePlugins)) {
    console.log(`[harness] using marketplace at ${cacheRoot} (cache)`);
    return cachePlugins;
  }
  console.log(`[harness] no marketplace found, shallow-cloning ${MARKETPLACE_REPO} → ${cacheRoot}`);
  mkdirSync(dirname(cacheRoot), { recursive: true });
  const r = spawnSync('git', ['clone', '--depth', '1', MARKETPLACE_REPO, cacheRoot], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.warn('[harness] git clone failed — marketplace plugins will not be loaded');
    return null;
  }
  return cachePlugins;
}

// ── MCP connections ──────────────────────────────────────────────────

/** @typedef {{ name: string, source: { kind: 'self' } | { kind: 'plugin', slug: string }, client: any, tools: any[] }} Connection */
/** @type {Map<string, Connection>} */
const connections = new Map();
/** @type {Array<{ name: string, source: any, reason: string }>} */
const failures = [];

function substitute(value, vars) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) return vars[name];
    return process.env[name] ?? '';
  });
}

function buildTransport(def, subVars, { bearer, authProvider } = {}) {
  const type = def.type ?? 'stdio';
  if (type === 'stdio') {
    const env = { ...process.env };
    for (const [k, v] of Object.entries(def.env ?? {})) env[k] = substitute(v, subVars);
    return new StdioClientTransport({
      command: substitute(def.command, subVars),
      args: (def.args ?? []).map((a) => substitute(a, subVars)),
      env,
      stderr: 'pipe',
    });
  }
  if (type === 'http' || type === 'sse') {
    const url = new URL(substitute(def.url, subVars));
    const headers = {};
    for (const [k, v] of Object.entries(def.headers ?? {})) headers[k] = substitute(v, subVars);
    if (bearer && !headers.Authorization && !headers.authorization) headers.Authorization = `Bearer ${bearer}`;
    const opts = {};
    if (Object.keys(headers).length) opts.requestInit = { headers };
    if (authProvider) opts.authProvider = authProvider;
    const Transport = type === 'http' ? StreamableHTTPClientTransport : SSEClientTransport;
    return new Transport(url, Object.keys(opts).length ? opts : undefined);
  }
  throw new Error(`unknown transport type "${type}"`);
}

// Heuristic: does this failure look like the server needs a token?
function looksLikeAuthFailure(msg) {
  const s = String(msg ?? '').toLowerCase();
  return s.includes('401') || s.includes('403') || s.includes('unauthor') || s.includes('invalid_token') || s.includes('missing authorization');
}

/**
 * @param {object} opts
 * @param {string} opts.key
 * @param {any} opts.def
 * @param {any} opts.source
 * @param {string|null} opts.pluginRoot
 * @param {boolean} [opts.useOAuth]  Wire the FileOAuthProvider for http/sse.
 *                                   We DON'T do this by default on initial
 *                                   boot — that would call redirectToAuthorization
 *                                   for every unauthenticated server and the
 *                                   user would see a flood of pending tabs.
 *                                   Instead we activate it lazily when the
 *                                   user clicks "OAuth login" OR when a saved
 *                                   token file exists.
 */
async function connectServer({ key, def, source, pluginRoot, useOAuth = false }) {
  serverDefs.set(key, { def, source, pluginRoot });
  connections.delete(key);
  for (let i = failures.length - 1; i >= 0; i--) if (failures[i].name === key) failures.splice(i, 1);

  const subVars = pluginRoot ? { CLAUDE_PLUGIN_ROOT: pluginRoot } : {};
  const bearer = tokens[key];
  const type = def.type ?? 'stdio';
  const isHttp = type === 'http' || type === 'sse';
  // Use OAuth if explicitly requested OR if we have a persisted oauth state
  // for this server (so silent refresh on boot just works).
  const hasOAuthState = isHttp && existsSync(join(OAUTH_CACHE, `${encodeURIComponent(key)}.json`));
  const authProvider = isHttp && (useOAuth || hasOAuthState) && !bearer ? getOAuthProvider(key) : undefined;

  try {
    const transport = buildTransport(def, subVars, { bearer, authProvider });
    const client = new Client({ name: 'mysmb-plugin-harness', version: '0.1.0' }, { capabilities: {} });
    // Stash the transport so the callback endpoint can call finishAuth on it.
    connections.set(key, { name: key, source, client, tools: [], transport, pending: true });
    await Promise.race([
      client.connect(transport),
      new Promise((_, rej) => setTimeout(() => rej(new Error(`connect timeout (${CONNECT_TIMEOUT_MS}ms)`)), CONNECT_TIMEOUT_MS)),
    ]);
    const list = await client.listTools();
    const tools = (list.tools ?? []).map((t) => ({
      mcp: key,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
    connections.set(key, { name: key, source, client, tools, transport });
    const tag = source.kind === 'self' ? 'self' : `plugin:${source.slug}`;
    console.log(`[harness] connected ${key} (${tools.length} tools, ${tag})`);
    return { ok: true };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    const isUnauth = err instanceof UnauthorizedError;
    if (isUnauth) {
      // The SDK has already called redirectToAuthorization, which queued a URL
      // on pendingRedirects. The transport is held in connections; the
      // /callback endpoint will resume it with finishAuth.
      const c = connections.get(key);
      if (c) c.awaitingAuth = true;
    } else {
      connections.delete(key);
      failures.push({ name: key, source, reason });
    }
    const tag = source.kind === 'self' ? 'self' : `plugin:${source.slug}`;
    console.error(`[harness] ${key} (${tag}) ${isUnauth ? 'awaiting OAuth' : 'failed'}: ${reason}`);
    return { ok: false, reason, awaitingAuth: isUnauth };
  }
}

async function connectAll() {
  // 1. Your plugin.
  if (existsSync(PLUGIN_MCP)) {
    const cfg = JSON.parse(readFileSync(PLUGIN_MCP, 'utf8'));
    for (const [key, def] of Object.entries(cfg.mcpServers ?? {})) {
      await connectServer({ key, def, source: { kind: 'self' }, pluginRoot: PLUGIN_DIR });
    }
  } else {
    console.warn(`[harness] no plugin/.mcp.json at ${PLUGIN_MCP}`);
  }

  // 2. Marketplace plugins, in parallel — they're independent.
  const mp = findMarketplacePlugins();
  if (!mp) return;
  const slugs = readdirSync(mp).filter((s) => statSync(join(mp, s)).isDirectory());
  await Promise.all(
    slugs.map(async (slug) => {
      const root = join(mp, slug);
      const mcpPath = join(root, '.mcp.json');
      if (!existsSync(mcpPath)) return;
      let cfg;
      try { cfg = JSON.parse(readFileSync(mcpPath, 'utf8')); } catch { return; }
      for (const [key, def] of Object.entries(cfg.mcpServers ?? {})) {
        // Use the bare key (e.g. "m365-calendar") so widget specs that say
        // `"mcp": "m365-calendar"` actually find a handler. Only namespace
        // with the slug on a real collision — that way the harness mirrors
        // MyHub's runtime keying instead of inventing its own.
        const uniqueKey = connections.has(key) || serverDefs.has(key) ? `${slug}:${key}` : key;
        await connectServer({ key: uniqueKey, def, source: { kind: 'plugin', slug }, pluginRoot: root });
      }
    }),
  );
}

// ── Templates (widgets) ──────────────────────────────────────────────

function readWidgets(dir, source) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    const full = join(dir, f);
    if (!statSync(full).isFile()) continue;
    const json = readFileSync(full, 'utf8');
    let title = f;
    try { title = JSON.parse(json).title ?? f; } catch { /* ignore */ }
    out.push({ path: source.kind === 'self' ? f : `${source.slug}/${f}`, title, source, json });
  }
  return out;
}

function allTemplates() {
  const list = [];
  list.push(...readWidgets(PLUGIN_WIDGETS, { kind: 'self' }));
  const mp = findMarketplacePlugins();
  if (mp) {
    for (const slug of readdirSync(mp)) {
      const widgets = join(mp, slug, 'widgets');
      if (existsSync(widgets) && statSync(widgets).isDirectory()) {
        list.push(...readWidgets(widgets, { kind: 'plugin', slug }));
      }
    }
  }
  return list;
}

// ── HTTP ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/templates', (_req, res) => {
  res.json({ templates: allTemplates() });
});

// Lists every plugin (self + marketplace) that ships a widget-elements bundle.
// The browser dynamically imports each URL and namespaces functions/components
// by slug (e.g. xero-accounting_status_tone). Without this, marketplace widgets
// render with empty/undefined $computed values and look wrong vs MyHub.
app.get('/api/plugin-elements', (_req, res) => {
  const list = [];
  const selfBundle = join(PLUGIN_DIR, 'widget-elements', 'dist', 'index.js');
  if (existsSync(selfBundle)) list.push({ slug: 'self', source: { kind: 'self' }, url: `/api/plugin-elements/self/index.js` });
  const mp = findMarketplacePlugins();
  if (mp) {
    for (const slug of readdirSync(mp)) {
      const bundle = join(mp, slug, 'widget-elements', 'dist', 'index.js');
      if (existsSync(bundle)) list.push({ slug, source: { kind: 'plugin', slug }, url: `/api/plugin-elements/${encodeURIComponent(slug)}/index.js` });
    }
  }
  res.json({ bundles: list });
});

// Serves a plugin-elements bundle as JavaScript. Self → ../plugin/...;
// marketplace → plugins/<slug>/.... Path lookups are restricted to those
// two roots to keep this endpoint from acting as an arbitrary file proxy.
app.get('/api/plugin-elements/:slug/index.js', (req, res) => {
  const { slug } = req.params;
  let bundle = null;
  if (slug === 'self') {
    bundle = join(PLUGIN_DIR, 'widget-elements', 'dist', 'index.js');
  } else {
    const mp = findMarketplacePlugins();
    if (mp) bundle = join(mp, slug, 'widget-elements', 'dist', 'index.js');
  }
  if (!bundle || !existsSync(bundle)) {
    res.status(404).send(`// no widget-elements bundle for "${slug}"`);
    return;
  }
  res.type('application/javascript').send(readFileSync(bundle, 'utf8'));
});

function hasOAuthFile(key) {
  return existsSync(join(OAUTH_CACHE, `${encodeURIComponent(key)}.json`));
}

app.get('/api/mcp/tools', (_req, res) => {
  const servers = [];
  for (const c of connections.values()) {
    const def = serverDefs.get(c.name)?.def;
    servers.push({
      name: c.name,
      source: c.source,
      tools: c.tools,
      transport: def?.type ?? 'stdio',
      hasToken: Boolean(tokens[c.name]),
      hasOAuth: hasOAuthFile(c.name),
      awaitingAuth: Boolean(c.awaitingAuth),
    });
  }
  for (const f of failures) {
    const def = serverDefs.get(f.name)?.def;
    servers.push({
      name: f.name,
      source: f.source,
      tools: [],
      failure: f.reason,
      transport: def?.type ?? 'stdio',
      hasToken: Boolean(tokens[f.name]),
      hasOAuth: hasOAuthFile(f.name),
      authRequired: looksLikeAuthFailure(f.reason) && (def?.type === 'http' || def?.type === 'sse'),
    });
  }
  res.json({ servers });
});

// Start the OAuth flow for a server: kicks connectServer with useOAuth=true,
// which causes the SDK to call redirectToAuthorization. We await the URL via
// pendingRedirects and return it to the browser so it can window.open it.
app.post('/api/mcp/oauth/:server/start', async (req, res) => {
  const { server } = req.params;
  const def = serverDefs.get(server);
  if (!def) {
    res.status(404).json({ ok: false, error: `unknown server "${server}"` });
    return;
  }
  if (def.def.type !== 'http' && def.def.type !== 'sse') {
    res.status(400).json({ ok: false, error: 'OAuth only applies to http/sse transports' });
    return;
  }
  // Clear any stale paste-token so the OAuth provider is used.
  if (tokens[server]) {
    delete tokens[server];
    writeTokens(tokens);
  }
  // Register a deferred resolver BEFORE kicking the connect — the SDK's
  // redirectToAuthorization is synchronous. We race two outcomes:
  //   (a) provider.redirectToAuthorization fires → resolve with URL
  //   (b) connectServer throws BEFORE the redirect → reject with the real
  //       error (e.g. "Cannot POST /register" from a misconfigured server)
  const urlPromise = new Promise((resolve, reject) => {
    pendingRedirects.set(server, { resolve, reject });
    setTimeout(() => {
      if (pendingRedirects.get(server)?.resolve === resolve) {
        pendingRedirects.delete(server);
        reject(new Error('timed out waiting for authorization URL'));
      }
    }, 15000);
  });
  connectServer({ key: server, ...def, useOAuth: true }).then((r) => {
    // If connect didn't throw with an UnauthorizedError, the OAuth flow never
    // started. Surface the underlying reason.
    if (!r.awaitingAuth) {
      const pending = pendingRedirects.get(server);
      if (pending) {
        pendingRedirects.delete(server);
        pending.reject(new Error(r.reason ?? (r.ok ? 'already authorized' : 'connect failed before OAuth redirect')));
      }
    }
  });
  try {
    const authorizationUrl = await urlPromise;
    res.json({ ok: true, authorizationUrl });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// OAuth callback. The provider redirected the browser here with ?code=&state=.
// We look up which server this state belongs to, call transport.finishAuth(code)
// (which uses the persisted PKCE verifier + dynamic client info to exchange the
// code for tokens), then reconnect the server. Returns a small HTML page that
// postMessages the opener and self-closes.
app.get('/api/oauth/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  const finish = (status, body) => {
    res.status(status).send(
      `<!doctype html><meta charset="utf-8"><title>OAuth ${body.ok ? 'success' : 'error'}</title>` +
      `<body style="font:14px ui-sans-serif,system-ui;padding:24px;color:#111">` +
      `<h2 style="margin-top:0">${body.ok ? 'Authorized ✓' : 'Authorization failed'}</h2>` +
      `<p>${body.message}</p>` +
      (body.ok ? '' : `<pre style="background:#fef2f2;color:#991b1b;padding:12px;border-radius:8px;white-space:pre-wrap">${body.detail ?? ''}</pre>`) +
      `<script>try{window.opener&&window.opener.postMessage(${JSON.stringify(body)},'*')}catch(e){}` +
      `setTimeout(()=>window.close(),${body.ok ? 600 : 4000})</script>`
    );
  };
  if (error) {
    finish(400, { ok: false, message: 'Provider returned an error.', detail: `${error}: ${error_description ?? ''}` });
    return;
  }
  if (!code || !state) {
    finish(400, { ok: false, message: 'Missing code or state.' });
    return;
  }
  const server = stateToServer.get(String(state));
  if (!server) {
    finish(400, { ok: false, message: 'Unknown state — possibly stale or replayed.' });
    return;
  }
  stateToServer.delete(String(state));
  const c = connections.get(server);
  if (!c?.transport) {
    finish(500, { ok: false, message: `No pending transport for "${server}".` });
    return;
  }
  try {
    await c.transport.finishAuth(String(code));
  } catch (err) {
    finish(500, { ok: false, message: `Token exchange failed for "${server}".`, detail: err instanceof Error ? err.message : String(err) });
    return;
  }
  // Tokens are now persisted by the provider. Reconnect cleanly with a fresh
  // transport so listTools runs with the bearer attached.
  const def = serverDefs.get(server);
  const result = await connectServer({ key: server, ...def, useOAuth: true });
  if (!result.ok) {
    finish(500, { ok: false, message: `Reconnect failed for "${server}".`, detail: result.reason });
    return;
  }
  finish(200, { ok: true, server, message: `Connected ${server}. You can close this tab.` });
});

// Forget all OAuth state for a server (delete the persisted file) and reconnect.
app.delete('/api/mcp/oauth/:server', async (req, res) => {
  const { server } = req.params;
  const def = serverDefs.get(server);
  if (!def) { res.status(404).json({ ok: false, error: `unknown server "${server}"` }); return; }
  const provider = oauthProviders.get(server);
  if (provider) provider.reset();
  oauthProviders.delete(server);
  const result = await connectServer({ key: server, ...def });
  res.json({ ok: result.ok, error: result.ok ? undefined : result.reason });
});

// Save (or clear) a bearer token for a server and reconnect it.
//   PUT  /api/mcp/auth/:server  body { token: "..." }   sets the token
//   DELETE /api/mcp/auth/:server                        clears the token
// Reconnects synchronously so the response carries the new failure (or success).
app.put('/api/mcp/auth/:server', async (req, res) => {
  const { server } = req.params;
  const { token } = req.body ?? {};
  const def = serverDefs.get(server);
  if (!def) {
    res.status(404).json({ ok: false, error: `unknown server "${server}"` });
    return;
  }
  if (typeof token !== 'string' || token.trim().length === 0) {
    res.status(400).json({ ok: false, error: 'token must be a non-empty string' });
    return;
  }
  tokens[server] = token.trim();
  writeTokens(tokens);
  const result = await connectServer({ key: server, ...def });
  res.json({ ok: result.ok, error: result.ok ? undefined : result.reason });
});

app.delete('/api/mcp/auth/:server', async (req, res) => {
  const { server } = req.params;
  const def = serverDefs.get(server);
  if (!def) {
    res.status(404).json({ ok: false, error: `unknown server "${server}"` });
    return;
  }
  delete tokens[server];
  writeTokens(tokens);
  const result = await connectServer({ key: server, ...def });
  res.json({ ok: result.ok, error: result.ok ? undefined : result.reason });
});

app.post('/api/mcp/call', async (req, res) => {
  const { mcp, tool, params } = req.body ?? {};
  const c = connections.get(mcp);
  if (!c) {
    res.status(404).json({ ok: false, error: `MCP server "${mcp}" not connected` });
    return;
  }
  try {
    const result = await c.client.callTool({ name: tool, arguments: params ?? {} });
    let data = result;
    const first = Array.isArray(result?.content) ? result.content[0] : null;
    if (first?.type === 'text' && typeof first.text === 'string') {
      try { data = JSON.parse(first.text); } catch { data = first.text; }
    }
    res.json({ ok: true, data });
  } catch (err) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

// ── Boot ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[harness] http://localhost:${PORT} — proxied from vite dev server at /api`);
});

connectAll().catch((err) => {
  console.error('[harness] connectAll error:', err);
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
