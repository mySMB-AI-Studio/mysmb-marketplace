import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// ── MyHub source discovery ────────────────────────────────────────────
//
// The harness pulls its system components live from MyHub's
// `apps/web/src/features/widgets-system/system` so widgets render with the
// exact same primitives as production. Without this, every prop-name mismatch
// turns into a separate "looks wrong in the harness" report.
//
// Discovery order:
//   1. HARNESS_MYHUB_PATH env var
//   2. Walk up from the project root looking for `apps/web/src/features/widgets-system`
//   3. Fall back to a tiny local stub (./src/system.local) — only the starter widget renders.

function findMyHubRoot(): string | null {
  const fromEnv = process.env.HARNESS_MYHUB_PATH;
  if (fromEnv && existsSync(resolve(fromEnv, 'apps/web/src/features/widgets-system'))) return fromEnv;
  let dir = resolve(__dirname, '..', '..');
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, 'apps/web/src/features/widgets-system/system'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // Try the conventional sibling layout: ../../../myHubV2
  const sibling = resolve(__dirname, '..', '..', '..', '..', 'myHubV2');
  if (existsSync(resolve(sibling, 'apps/web/src/features/widgets-system/system'))) return sibling;
  return null;
}

const myHubRoot = findMyHubRoot();
if (myHubRoot) {
  console.log(`[harness] using MyHub system from ${myHubRoot}`);
} else {
  console.warn('[harness] MyHub source not found — falling back to local stub. Set HARNESS_MYHUB_PATH to point at your myHubV2 checkout.');
}

const aliases: Record<string, string> = {
  '@plugin-elements': resolve(__dirname, '..', 'plugin', 'widget-elements', 'dist', 'index.js'),
};
if (myHubRoot) {
  aliases['@/lib/utils'] = resolve(myHubRoot, 'apps/web/src/lib/utils.ts');
  aliases['@myhub/widget-tokens'] = resolve(myHubRoot, 'packages/widget-tokens/src/index.ts');
  aliases['@myhub-widgets-system/system/components'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system/system/components.tsx');
  aliases['@myhub-widgets-system/system/functions'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system/system/functions.ts');
  aliases['@myhub-widgets-system'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system');
  // Stubs for MyHub-only deps the system imports but the harness doesn't need.
  // `actions.ts` pulls in MCP cache invalidation and a todo-modal store — none
  // of which exists outside MyHub. Our harness wires actions through its own
  // MCP handler map, so we never import actions.ts directly. But the stubs
  // are a safety net if anything transitively reaches for them.
  aliases['@/stores/todo-modal'] = resolve(__dirname, 'src/stubs/todo-modal.ts');
  aliases['sonner'] = resolve(__dirname, 'src/stubs/sonner.ts');
} else {
  // Fall back to the local system-fallback so the harness still boots when
  // MyHub isn't on disk. Widgets render with a plain Tailwind look — point
  // HARNESS_MYHUB_PATH at your myHubV2 checkout for production fidelity.
  aliases['@myhub-widgets-system/system/components'] = resolve(__dirname, 'src/system-fallback/components.tsx');
  aliases['@myhub-widgets-system/system/functions'] = resolve(__dirname, 'src/system-fallback/functions.ts');
}

const fsAllow = [resolve(__dirname, '..')];
if (myHubRoot) fsAllow.push(myHubRoot);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: aliases },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: fsAllow },
    proxy: { '/api': 'http://localhost:5174' },
  },
  define: {
    __HARNESS_USES_MYHUB__: JSON.stringify(Boolean(myHubRoot)),
  },
});
