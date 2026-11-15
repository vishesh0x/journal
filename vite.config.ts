import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Plain client-side SPA build — no SSR, no Node server plugins.
// The output in dist/ is served by Cloudflare's Worker "assets" binding.
// The entry stylesheet is small; putting it in the HTML removes a render-blocking request.
function inlineCss(): Plugin {
  return {
    name: "inline-entry-css",
    enforce: "post",
    apply: "build",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") return;
      let source = String(html.source);
      for (const [name, file] of Object.entries(bundle)) {
        if (file.type !== "asset" || !name.endsWith(".css")) continue;
        const link = new RegExp(`<link[^>]*href="[^"]*${name.split("/").pop()!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>`);
        if (link.test(source)) {
          source = source.replace(link, () => `<style>${String(file.source).replace(/<\/style/gi, "<\\/style")}</style>`);
          // The file stays in the bundle: lazy route chunks list it as a preload dependency.
        }
      }
      html.source = source;
    },
  };
}

export default defineConfig({
  plugins: [inlineCss(), react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: {
    port: 5173,
    proxy: {
      // During `vite` dev, forward API calls to `wrangler dev` (run separately).
      // Host is kept as-is (changeOrigin: false) so the worker's same-origin check sees the browser's real origin.
      "/api": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/rss.xml": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/sitemap.xml": { target: "http://127.0.0.1:8787", changeOrigin: false },
      "/llms.txt": { target: "http://127.0.0.1:8787", changeOrigin: false },
    },
  },
  build: {
    outDir: "dist",
    // The biggest chunks are Mermaid layout and diagram modules, fetched only when a post contains a diagram.
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Keep the entry chunk small: framework, data layer and the markdown stack load as separate, cacheable files.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler|react-router|react-router-dom)\//.test(id)) return "react";
          if (id.includes("@tanstack")) return "query";
          if (/node_modules\/(unified|remark|rehype|mdast|hast|micromark|unist|vfile|bail|trough|devlop|property-information|space-separated-tokens|comma-separated-tokens|decode-named-character-reference|character-entities|html-void-elements|zwitch|ccount|longest-streak|markdown-table|github-slugger|hast-util|mdast-util|micromark-util|unist-util|trim-lines|estree-util|is-plain-obj|extend|parse-entities|stringify-entities|ungap)/.test(id)) return "markdown";
          return undefined;
        },
      },
    },
  },
});
