import { Hono, type Context } from "hono";
import type { AppEnv } from "./types";
import { attachSession } from "./middleware/auth";
import { securityHeaders, sameOriginWrites } from "./middleware/security";
import { HttpError } from "./lib/validate";
import { coverPreload } from "./lib/image";

import authRoutes from "./routes/auth";
import postsRoutes from "./routes/posts";
import tagsRoutes from "./routes/tags";
import pagesRoutes from "./routes/pages";
import settingsRoutes from "./routes/settings";
import subscribersRoutes from "./routes/subscribers";
import overviewRoutes from "./routes/overview";
import mediaRoutes from "./routes/media";
import feedRoutes from "./routes/feed";

const app = new Hono<AppEnv>();

app.use("*", attachSession);

// Forces every query in this request to read from D1's primary instance
// instead of a possibly-lagging read replica. Without this, editing/
// publishing content and then immediately loading a page that reads it
// back (the dashboard's own "Save" -> homepage check, or a visitor
// browsing right after a publish) can race D1's replication and see
// stale/missing data — which looks exactly like "it disappeared until I
// saved again" or "until I unpublished and republished". A blog's D1
// traffic is low enough that always hitting the primary has no
// meaningful cost.
app.use("*", async (c, next) => {
  if (typeof c.env.DB.withSession === "function") {
    c.env.DB = c.env.DB.withSession("first-primary") as unknown as D1Database;
  }
  await next();
});

app.use("*", securityHeaders);
app.use("/api/*", sameOriginWrites);

app.route("/api/auth", authRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/pages", pagesRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/subscribers", subscribersRoutes);
app.route("/api/overview", overviewRoutes);
app.route("/api/media", mediaRoutes);
app.route("/", feedRoutes); // exposes /rss.xml and /sitemap.xml at the site root

const FILE_LIKE = /\.[a-z0-9]{2,6}$/i;

// llms.txt: a plain Markdown map of the site for language-model crawlers.
app.get("/llms.txt", async (c) => {
  const origin = new URL(c.req.url).origin;
  const settings = await c.env.DB.prepare("SELECT site_name, tagline, description, author_name, author_bio FROM site_settings WHERE id = 'main'").first<{
    site_name: string; tagline: string; description: string; author_name: string; author_bio: string;
  }>();
  const { results: posts } = await c.env.DB.prepare(
    "SELECT title, slug, subtitle, excerpt FROM posts WHERE status = 'published' AND (published_at IS NULL OR published_at <= datetime('now')) AND noindex = 0 ORDER BY published_at DESC LIMIT 200",
  ).all<{ title: string; slug: string; subtitle: string | null; excerpt: string | null }>();
  const { results: pages } = await c.env.DB.prepare(
    "SELECT title, slug, system_key FROM pages WHERE status = 'published' AND noindex = 0 ORDER BY sort_order, title",
  ).all<{ title: string; slug: string; system_key: string | null }>();
  const clean = (v: string | null | undefined) => (v ?? "").replace(/[\r\n]+/g, " ").replace(/[\[\]]/g, "").trim();
  const lines = [
    `# ${clean(settings?.site_name) || "Journal"}`,
    "",
    `> ${clean(settings?.description) || clean(settings?.tagline) || "A personal journal."}`,
    "",
  ];
  if (settings?.author_name) lines.push(`Written by ${clean(settings.author_name)}. ${clean(settings.author_bio)}`.trim(), "");
  lines.push("## Posts", "");
  for (const p of posts) {
    const note = clean(p.subtitle || p.excerpt);
    lines.push(`- [${clean(p.title)}](${origin}/posts/${p.slug})${note ? `: ${note}` : ""}`);
  }
  lines.push("", "## Pages", "", `- [About](${origin}/about)`);
  for (const p of pages) lines.push(`- [${clean(p.title)}](${origin}${p.system_key ? `/${p.slug}` : `/p/${p.slug}`})`);
  lines.push("", "## Feeds", "", `- [RSS](${origin}/rss.xml)`, `- [Sitemap](${origin}/sitemap.xml)`, "");
  return c.body(lines.join("\n"), 200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=3600",
  });
});

// The home page and post pages are rendered in the browser, so the worker tells the browser about the
// cover image up front instead of making it wait for scripts and API calls to find it.
async function withCoverPreload(c: Context<AppEnv>, cover: string | null, sizes: string, width: number) {
  const res = await c.env.ASSETS.fetch(c.req.raw);
  if (!cover || !(res.headers.get("content-type") ?? "").includes("text/html")) return res;
  const settings = await c.env.DB.prepare("SELECT image_resizing_enabled AS r FROM site_settings WHERE id = 'main'").first<{ r: number }>();
  const tag = coverPreload(cover, Boolean(settings?.r), sizes, width);
  if (!tag) return res;
  return new HTMLRewriter()
    .on("head", { element(el) { el.append(tag, { html: true }); } })
    .transform(res);
}

app.get("/", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT cover_url FROM posts WHERE status = 'published' AND (published_at IS NULL OR published_at <= datetime('now')) ORDER BY featured DESC, published_at DESC LIMIT 1",
  ).first<{ cover_url: string | null }>();
  return withCoverPreload(c, row?.cover_url ?? null, "(min-width: 64rem) 58vw, 100vw", 1200);
});

app.get("/posts/:slug", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT cover_url FROM posts WHERE slug = ? AND status = 'published' AND (published_at IS NULL OR published_at <= datetime('now'))",
  ).bind(c.req.param("slug")).first<{ cover_url: string | null }>();
  return withCoverPreload(c, row?.cover_url ?? null, "(min-width: 80rem) 1184px, 100vw", 1600);
});

app.notFound(async (c) => {
  const path = new URL(c.req.url).pathname;
  // Real API 404s stay JSON; client-side routes (a hard refresh on /archive) fall through to the
  // static assets, which serve index.html. A missing *file* (or /.well-known/ entry) must be a
  // real 404, not an HTML page pretending to be that file.
  if (path.startsWith("/api/")) return c.json({ error: "Not found" }, 404);
  const res = await c.env.ASSETS.fetch(c.req.raw);
  const isHtml = (res.headers.get("content-type") ?? "").includes("text/html");
  if (isHtml && (FILE_LIKE.test(path) || path.startsWith("/.well-known/"))) return c.text("Not found", 404);
  return res;
});
app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
