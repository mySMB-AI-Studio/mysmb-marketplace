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
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const PLUGIN_DIR = resolve(PROJECT_ROOT, 'plugin');
const PLUGIN_MCP = resolve(PLUGIN_DIR, '.mcp.json');
const PLUGIN_WIDGETS = resolve(PLUGIN_DIR, 'widgets');

const PORT = Number(process.env.PORT ?? 5174);
const MARKETPLACE_REPO = 'https://github.com/mySMB-AI-Studio/mysmb-marketplace.git';
const CONNECT_TIMEOUT_MS = 12000;

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

function buildTransport(def, subVars) {
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
  if (type === 'http') {
    const url = new URL(substitute(def.url, subVars));
    const headers = {};
    for (const [k, v] of Object.entries(def.headers ?? {})) headers[k] = substitute(v, subVars);
    return new StreamableHTTPClientTransport(url, Object.keys(headers).length ? { requestInit: { headers } } : undefined);
  }
  if (type === 'sse') {
    const url = new URL(substitute(def.url, subVars));
    const headers = {};
    for (const [k, v] of Object.entries(def.headers ?? {})) headers[k] = substitute(v, subVars);
    return new SSEClientTransport(url, Object.keys(headers).length ? { requestInit: { headers } } : undefined);
  }
  throw new Error(`unknown transport type "${type}"`);
}

async function connectServer({ key, def, source, pluginRoot }) {
  const subVars = pluginRoot ? { CLAUDE_PLUGIN_ROOT: pluginRoot } : {};
  try {
    const transport = buildTransport(def, subVars);
    const client = new Client({ name: 'mysmb-plugin-harness', version: '0.1.0' }, { capabilities: {} });
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
    connections.set(key, { name: key, source, client, tools });
    const tag = source.kind === 'self' ? 'self' : `plugin:${source.slug}`;
    console.log(`[harness] connected ${key} (${tools.length} tools, ${tag})`);
  } catch (err) {
    failures.push({ name: key, source, reason: err instanceof Error ? err.message : String(err) });
    const tag = source.kind === 'self' ? 'self' : `plugin:${source.slug}`;
    console.error(`[harness] ${key} (${tag}) failed: ${err instanceof Error ? err.message : err}`);
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
        // Namespace key with slug to avoid collisions across plugins that name
        // their server identically (e.g. multiple plugins called "default").
        const uniqueKey = key === slug ? key : `${slug}:${key}`;
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

app.get('/api/mcp/tools', (_req, res) => {
  const servers = [];
  for (const c of connections.values()) servers.push({ name: c.name, source: c.source, tools: c.tools });
  for (const f of failures) servers.push({ name: f.name, source: f.source, tools: [], failure: f.reason });
  res.json({ servers });
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
