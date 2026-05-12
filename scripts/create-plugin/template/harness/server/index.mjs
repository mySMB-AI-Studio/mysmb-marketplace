// Widget-harness backend.
//
// Reads ../plugin/.mcp.json, spawns each MCP server as a child process via the
// MCP SDK's stdio transport, and exposes a tiny HTTP API for the React app:
//
//   GET  /api/templates  → list of plugin/widgets/*.json files
//   GET  /api/mcp/tools  → connected servers + their tools
//   POST /api/mcp/call   → { mcp, tool, params } → tool result
//
// Credentials come from the host shell. Reference any ${VAR} you put in
// .mcp.json by setting it before `npm run dev` (or via a .env file you load
// yourself — we deliberately don't ship dotenv to keep dependencies thin).

import express from 'express';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..');
const PLUGIN_DIR = resolve(PROJECT_ROOT, 'plugin');
const MCP_CONFIG = resolve(PLUGIN_DIR, '.mcp.json');
const WIDGETS_DIR = resolve(PLUGIN_DIR, 'widgets');

const PORT = Number(process.env.PORT ?? 5174);

// ── MCP connections ──────────────────────────────────────────────────

/** @typedef {{ name: string, client: import('@modelcontextprotocol/sdk/client/index.js').Client, tools: any[] }} Connection */
/** @type {Map<string, Connection>} */
const connections = new Map();
/** @type {Array<{ name: string, reason: string }>} */
const failures = [];

function substituteEnv(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_, name) => process.env[name] ?? '');
}

async function connectAll() {
  if (!existsSync(MCP_CONFIG)) {
    console.warn(`[harness] no plugin/.mcp.json found at ${MCP_CONFIG}`);
    return;
  }
  const cfg = JSON.parse(readFileSync(MCP_CONFIG, 'utf8'));
  const servers = cfg.mcpServers ?? {};
  for (const [name, def] of Object.entries(servers)) {
    if (def.type && def.type !== 'stdio') {
      failures.push({ name, reason: `transport "${def.type}" not yet supported by harness (stdio only)` });
      continue;
    }
    try {
      const env = { ...process.env };
      for (const [k, v] of Object.entries(def.env ?? {})) env[k] = substituteEnv(v);
      const transport = new StdioClientTransport({
        command: def.command,
        args: (def.args ?? []).map(substituteEnv),
        env,
        stderr: 'pipe',
      });
      const client = new Client({ name: 'mysmb-plugin-harness', version: '0.1.0' }, { capabilities: {} });
      await client.connect(transport);
      const list = await client.listTools();
      const tools = (list.tools ?? []).map((t) => ({
        mcp: name,
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      }));
      connections.set(name, { name, client, tools });
      console.log(`[harness] connected ${name} (${tools.length} tools)`);
    } catch (err) {
      failures.push({ name, reason: err instanceof Error ? err.message : String(err) });
      console.error(`[harness] failed to connect ${name}:`, err);
    }
  }
}

// ── HTTP ─────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/templates', (_req, res) => {
  const templates = [];
  if (existsSync(WIDGETS_DIR)) {
    for (const f of readdirSync(WIDGETS_DIR)) {
      if (!f.endsWith('.json')) continue;
      const full = join(WIDGETS_DIR, f);
      if (!statSync(full).isFile()) continue;
      const json = readFileSync(full, 'utf8');
      let title = f;
      try { title = JSON.parse(json).title ?? f; } catch { /* ignore */ }
      templates.push({ path: f, title, json });
    }
  }
  res.json({ templates });
});

app.get('/api/mcp/tools', (_req, res) => {
  const servers = [];
  for (const c of connections.values()) servers.push({ name: c.name, tools: c.tools });
  for (const f of failures) servers.push({ name: f.name, tools: [], failure: f.reason });
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
    // Convention: if the server returns content[0].text as JSON, parse it so the
    // renderer can bind into structured fields. Fall back to the raw payload.
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

connectAll().finally(() => {
  app.listen(PORT, () => {
    console.log(`[harness] http://localhost:${PORT} — proxied from vite dev server at /api`);
  });
});

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
