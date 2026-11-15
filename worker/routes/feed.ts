import { Hono } from "hono";
import type { AppEnv } from "../types";
import { cacheControl } from "../middleware/cache";

const app = new Hono<AppEnv>();

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

app.get("/rss.xml", cacheControl(300), async (c) => {
  const origin = new URL(c.req.url).origin;
  const settings = await c.env.DB.prepare("SELECT site_name, description FROM site_settings WHERE id='main'").first<{
    site_name: string;
    description: string;
  }>();
  const now = new Date().toISOString();
  const { results: posts } = await c.env.DB.prepare(
    `SELECT title, slug, excerpt, published_at FROM posts
     WHERE status='published' AND published_at <= ? AND noindex = 0 ORDER BY published_at DESC LIMIT 30`,
  )
    .bind(now)
    .all<{ title: string; slug: string; excerpt: string | null; published_at: string }>();

  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${origin}/posts/${escapeXml(p.slug)}</link>
      <guid>${origin}/posts/${escapeXml(p.slug)}</guid>
      <pubDate>${new Date(p.published_at).toUTCString()}</pubDate>
      ${p.excerpt ? `<description>${escapeXml(p.excerpt)}</description>` : ""}
    </item>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel>
  <title>${escapeXml(settings?.site_name ?? "Journal")}</title>
  <link>${origin}</link>
  <description>${escapeXml(settings?.description ?? "")}</description>${items}
</channel></rss>`;

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

app.get("/sitemap.xml", cacheControl(300), async (c) => {
  const origin = new URL(c.req.url).origin;
  const now = new Date().toISOString();
  const { results: posts } = await c.env.DB.prepare(
    "SELECT slug, updated_at FROM posts WHERE status='published' AND published_at <= ? AND noindex = 0",
  )
    .bind(now)
    .all<{ slug: string; updated_at: string }>();
  const { results: pages } = await c.env.DB.prepare(
    "SELECT slug, updated_at FROM pages WHERE status='published' AND noindex = 0",
  ).all<{ slug: string; updated_at: string }>();

  const staticUrls = ["", "/archive", "/about"];
  const urls = [
    ...staticUrls.map((path) => `<url><loc>${origin}${path}</loc></url>`),
    ...posts.map(
      (p) => `<url><loc>${origin}/posts/${escapeXml(p.slug)}</loc><lastmod>${p.updated_at}</lastmod></url>`,
    ),
    ...pages.map(
      (p) => `<url><loc>${origin}/p/${escapeXml(p.slug)}</loc><lastmod>${p.updated_at}</lastmod></url>`,
    ),
  ].join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`;

  return c.body(xml, 200, { "content-type": "application/xml; charset=utf-8" });
});

export default app;
