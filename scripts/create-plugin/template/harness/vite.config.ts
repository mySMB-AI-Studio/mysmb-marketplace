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
    fs: { allow: [resolve(__dirname, '..')] },
    proxy: {
      '/api': 'http://localhost:5174',
    },
  },
});
