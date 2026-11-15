import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { newId, slugify } from "../lib/content";
import { cacheControl } from "../middleware/cache";

const app = new Hono<AppEnv>();

app.get("/", cacheControl(120), async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id,slug,title,show_in_footer,show_in_nav,sort_order FROM pages WHERE status='published' ORDER BY sort_order ASC",
  ).all();
  return c.json(results);
});

app.get("/by-slug/:slug", cacheControl(120), async (c) => {
  const page = await c.env.DB.prepare(
    "SELECT id,slug,title,subtitle,eyebrow,content_md,meta_title,meta_description,noindex,updated_at FROM pages WHERE slug=? AND status='published'",
  )
    .bind(c.req.param("slug"))
    .first();
  if (!page) return c.json(null, 404);
  return c.json(page);
});

app.get("/admin", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id,slug,title,status,system_key,show_in_footer,show_in_nav,sort_order,updated_at FROM pages ORDER BY sort_order ASC",
  ).all();
  return c.json(results);
});

app.get("/admin/:id", requireAdmin, async (c) => {
  const page = await c.env.DB.prepare("SELECT * FROM pages WHERE id=?").bind(c.req.param("id")).first();
  if (!page) return c.json({ error: "Page not found" }, 404);
  return c.json(page);
});

app.post("/admin", requireAdmin, async (c) => {
  const body = await c.req.json<{ title?: string }>().catch(() => ({}) as { title?: string });
  const title = body.title?.trim() || "Untitled page";
  let slug = slugify(title);
  const clash = await c.env.DB.prepare("SELECT id FROM pages WHERE slug = ?").bind(slug).first();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const id = newId("page");
  await c.env.DB.prepare(
    "INSERT INTO pages (id, slug, title, content_md, status, created_at, updated_at) VALUES (?, ?, ?, '', 'draft', datetime('now'), datetime('now'))",
  )
    .bind(id, slug, title)
    .run();
  return c.json({ id });
});

const PATCHABLE_FIELDS = [
  "title",
  "slug",
  "subtitle",
  "eyebrow",
  "content_md",
  "status",
  "show_in_footer",
  "show_in_nav",
  "sort_order",
  "meta_title",
  "meta_description",
  "noindex",
] as const;

app.put("/admin/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json<Record<string, unknown>>();
  const update: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) if (field in body) update[field] = body[field];

  if (typeof update.slug === "string") {
    const current = await c.env.DB.prepare("SELECT system_key FROM pages WHERE id = ?").bind(id).first<{
      system_key: string | null;
    }>();
    if (current?.system_key) {
      delete update.slug; // protected slugs (about/privacy/terms) can't be renamed
    } else {
      update.slug = slugify((update.slug as string) || (body.title as string) || "page");
      const clash = await c.env.DB.prepare("SELECT id FROM pages WHERE slug = ? AND id != ?")
        .bind(update.slug, id)
        .first();
      if (clash) return c.json({ error: "Another page already uses that address." }, 409);
    }
  }

  const keys = Object.keys(update);
  if (keys.length > 0) {
    const setSql = keys.map((k) => `${k} = ?`).join(", ");
    await c.env.DB.prepare(`UPDATE pages SET ${setSql}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...keys.map((k) => update[k]), id)
      .run();
  }
  return c.json({ ok: true });
});

app.delete("/admin/:id", requireAdmin, async (c) => {
  await c.env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

export default app;
