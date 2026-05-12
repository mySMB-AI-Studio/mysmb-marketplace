import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// The harness imports the plugin's compiled widget-elements bundle so
// `$computed` helpers like `<slug>_<name>` resolve in the preview. The bundle
// lives at ../plugin/widget-elements/dist/index.js — outside the harness root,
// so we whitelist the parent in `server.fs.allow`.

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@plugin-elements': resolve(__dirname, '..', 'plugin', 'widget-elements', 'dist', 'index.js'),
    },
  },
  server: {
    port: 5173,
    // Fail fast if 5173 is taken instead of silently rolling to 5174+ — the
    // /api proxy below is hardcoded to 5174, so a port shift would break MCP
    // calls in confusing ways.
    strictPort: true,
    fs: { allow: [resolve(__dirname, '..')] },
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
});
