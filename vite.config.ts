import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { cloudflare } from '@cloudflare/vite-plugin';

// The Cloudflare plugin runs the API Worker (worker/index.js) inside the dev
// server, so /api/* works locally without a separate server or proxy.
export default defineConfig({
  plugins: [react(), cloudflare()],
  server: {
    // Reach the dev server over Tailscale (npm run dev -- --host)
    allowedHosts: ['aaron-laptop.taild7f967.ts.net'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
