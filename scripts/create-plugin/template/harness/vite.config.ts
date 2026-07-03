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
  // Try sibling layouts at several depths to cover different workspace arrangements.
  // e.g. <parent>/<plugin>/harness/ → ../../myHubV2 = <parent>/myHubV2
  for (const candidate of [
    resolve(__dirname, '..', '..', 'myHubV2'),              // standard: plugin + myHubV2 siblings
    resolve(__dirname, '..', '..', '..', 'myHubV2'),        // 3 levels up
    resolve(__dirname, '..', '..', '..', '..', 'myHubV2'),  // conventional 4-level layout
  ]) {
    if (existsSync(resolve(candidate, 'apps/web/src/features/widgets-system/system'))) return candidate;
  }
  return null;
}

const myHubRoot = findMyHubRoot();
if (myHubRoot) {
  console.log(`[harness] using MyHub system from ${myHubRoot}`);
} else {
  console.warn('[harness] MyHub source not found — falling back to local stub. Set HARNESS_MYHUB_PATH to point at your myHubV2 checkout.');
}

// lucide-react, clsx, and tailwind-merge are hoisted to the workspace root
// node_modules. Vite can't find them when processing myHubV2 files outside
// the project root, so we alias them explicitly. Other packages (@json-render/*)
// must NOT be aliased — aliasing breaks their subpath exports.
const workspaceModules = resolve(__dirname, '..', 'node_modules');

const aliases: Record<string, string> = {
  '@plugin-elements': resolve(__dirname, '..', 'plugin', 'widget-elements', 'dist', 'index.js'),
  'lucide-react': resolve(workspaceModules, 'lucide-react'),
  'clsx': resolve(workspaceModules, 'clsx'),
  'tailwind-merge': resolve(workspaceModules, 'tailwind-merge'),
};
if (myHubRoot) {
  aliases['@/lib/utils'] = resolve(myHubRoot, 'apps/web/src/lib/utils.ts');
  aliases['@myhub/widget-tokens'] = resolve(myHubRoot, 'packages/widget-tokens/src/index.ts');
  aliases['@myhub-widgets-system/system/components'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system/system/components.tsx');
  aliases['@myhub-widgets-system/system/functions'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system/system/functions.ts');
  aliases['@myhub-widgets-system'] = resolve(myHubRoot, 'apps/web/src/features/widgets-system');
  aliases['@/stores/todo-modal'] = resolve(__dirname, 'src/stubs/todo-modal.ts');
  aliases['sonner'] = resolve(__dirname, 'src/stubs/sonner.ts');
  // SurveyCard in components.tsx imports shadcn/ui primitives and internal survey
  // components. We never render SurveyCard in the harness (not in componentNames)
  // but Vite still needs to parse the file without errors.
  aliases['@/components/ui/card'] = resolve(__dirname, 'src/stubs/card.tsx');
  aliases['@/components/ui/button'] = resolve(__dirname, 'src/stubs/button.tsx');
  aliases['@/components/surveys/survey-form-dialog'] = resolve(__dirname, 'src/stubs/survey-form-dialog.tsx');
  aliases['@/components/surveys/survey-form'] = resolve(__dirname, 'src/stubs/survey-form.tsx');
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
