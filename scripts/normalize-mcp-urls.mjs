#!/usr/bin/env node
/**
 * Normalize every plugin `.mcp.json` so any myhub-hosted MCP URL uses the
 * PRODUCTION host. Per-environment routing is applied at runtime by myHub
 * (MCP_SERVERS_BASE_URL) — branches must never bake in a staging/dev host.
 *
 * Use this when importing the staging superset into the consolidated repo, or
 * any time a `.mcp.json` slipped in with a non-production myhub host. Only the
 * scheme+host+port are rewritten; the `/<server>/mcp` path is preserved.
 * Third-party hosts (e.g. mcp.monday.com) and stdio servers are left untouched.
 *
 *   node scripts/normalize-mcp-urls.mjs           # rewrite in place
 *   node scripts/normalize-mcp-urls.mjs --check    # exit 1 if any would change
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROD_HOST =
  process.env.MYHUB_PROD_MCP_HOST ??
  'myhub-mcp-servers.thankfulcliff-9090ceed.westus2.azurecontainerapps.io';
const checkOnly = process.argv.includes('--check');

const pluginsDir = join(repoRoot, 'plugins');
let changed = 0;
const touched = [];

for (const name of existsSync(pluginsDir) ? readdirSync(pluginsDir) : []) {
  const mcpPath = join(pluginsDir, name, '.mcp.json');
  if (!existsSync(mcpPath) || !statSync(mcpPath).isFile()) continue;

  const raw = readFileSync(mcpPath, 'utf8');
  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    console.error(`skip (invalid JSON): plugins/${name}/.mcp.json`);
    continue;
  }

  let fileChanged = false;
  for (const server of Object.values(json.mcpServers ?? {})) {
    if (typeof server?.url !== 'string') continue;
    let u;
    try {
      u = new URL(server.url);
    } catch {
      continue;
    }
    if (!/(^|\.)myhub-mcp-servers/.test(u.host) || u.host === PROD_HOST) continue;
    u.host = PROD_HOST;
    u.protocol = 'https:';
    const next = u.toString();
    if (next !== server.url) {
      server.url = next;
      fileChanged = true;
    }
  }

  if (fileChanged) {
    changed++;
    touched.push(`plugins/${name}/.mcp.json`);
    if (!checkOnly) writeFileSync(mcpPath, JSON.stringify(json, null, 2) + '\n');
  }
}

if (changed === 0) {
  console.log('normalize-mcp-urls: all myhub URLs already production. OK');
  process.exit(0);
}

console.log(`normalize-mcp-urls: ${checkOnly ? 'would update' : 'updated'} ${changed} file(s):`);
for (const f of touched) console.log('  - ' + f);
process.exit(checkOnly ? 1 : 0);
