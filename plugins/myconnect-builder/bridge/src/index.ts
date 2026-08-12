#!/usr/bin/env node
/**
 * mcb-bridge daemon entrypoint.
 *
 *   node dist/index.js [path/to/bridge.config.json]
 *
 * Reconcile-on-start: WorkQ labels + comments are the durable pipeline state;
 * this process derives everything else fresh on every tick, so crashes and
 * laptop-off periods resume cleanly.
 */
import { dirname, join, resolve } from 'node:path';
import { loadConfig } from './config.js';
import { FileAuthProvider } from './oauth.js';
import { WorkspaceClient } from './mcp.js';
import { StateStore } from './state.js';
import { Pipeline } from './pipeline.js';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  const configPath = resolve(process.argv[2] ?? 'bridge.config.json');
  const cfg = loadConfig(configPath);
  const baseDir = dirname(configPath);

  const auth = new FileAuthProvider(join(baseDir, '.mcb-auth.json'), cfg.oauthCallbackPort);
  const ws = new WorkspaceClient(cfg.workspaceMcpUrl, auth, cfg.oauthCallbackPort);
  const store = new StateStore(join(baseDir, '.mcb-state.json'));
  const pipeline = new Pipeline(cfg, ws, store);

  console.log(`[mcb-bridge] connecting to ${cfg.workspaceMcpUrl} …`);
  await ws.connect();
  console.log(`[mcb-bridge] connected. Polling every ${cfg.pollSeconds}s for items assigned to ${cfg.builderUserId}.`);

  let stopping = false;
  process.on('SIGINT', () => { stopping = true; console.log('\n[mcb-bridge] stopping after current tick…'); });
  process.on('SIGTERM', () => { stopping = true; });

  while (!stopping) {
    try {
      await pipeline.tick();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[mcb-bridge] tick failed: ${msg}`);
      if (/401|unauthoriz/i.test(msg)) {
        // Token likely revoked/expired past the refresh window — reconnect
        // (triggers the interactive flow again if needed).
        try { await ws.close(); await ws.connect(); } catch (e) {
          console.error(`[mcb-bridge] reconnect failed: ${e instanceof Error ? e.message : e}`);
        }
      }
    }
    for (let i = 0; i < cfg.pollSeconds && !stopping; i++) await sleep(1000);
  }
  await ws.close();
  console.log('[mcb-bridge] stopped.');
}

main().catch((err) => {
  console.error(`[mcb-bridge] fatal: ${err instanceof Error ? err.stack ?? err.message : err}`);
  process.exit(1);
});
