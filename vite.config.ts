import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Plain client-side SPA build — no SSR, no Node server plugins.
// The output in dist/ is served by Cloudflare's Worker "assets" binding.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      // During `vite` dev, forward API calls to `wrangler dev` (run separately).
      "/api": "http://127.0.0.1:8787",
      "/rss.xml": "http://127.0.0.1:8787",
      "/sitemap.xml": "http://127.0.0.1:8787",
    },
  },
  build: {
    outDir: "dist",
  },
});
