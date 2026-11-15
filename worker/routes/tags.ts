import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { newId, slugify } from "../lib/content";
import { cacheControl } from "../middleware/cache";

const app = new Hono<AppEnv>();

app.get("/", cacheControl(120), async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id,name,slug,description FROM tags ORDER BY name").all();
  return c.json(results);
});

app.get("/admin", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id,name,slug,description FROM tags ORDER BY name").all();
  return c.json(results);
});

app.post("/admin", requireAdmin, async (c) => {
  const body = await c.req.json<{ id?: string; name?: string; description?: string | null }>().catch(() => ({}) as any);
  const { id } = body;
  const description = typeof body.description === "string" ? body.description.slice(0, 500) : null;
  const name = (typeof body.name === "string" ? body.name : "").trim().slice(0, 80);
  if (!name) return c.json({ error: "Give the topic a name." }, 400);
  const slug = slugify(name);
  if (id) {
    await c.env.DB.prepare("UPDATE tags SET name=?, slug=?, description=? WHERE id=?")
      .bind(name, slug, description ?? null, id)
      .run();
  } else {
    const clash = await c.env.DB.prepare("SELECT id FROM tags WHERE slug = ?").bind(slug).first();
    if (clash) return c.json({ error: "That topic already exists." }, 409);
    await c.env.DB.prepare("INSERT INTO tags (id, name, slug, description, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
      .bind(newId("tag"), name, slug, description ?? null)
      .run();
  }
  return c.json({ ok: true });
});

app.delete("/admin/:id", requireAdmin, async (c) => {
  await c.env.DB.prepare("DELETE FROM tags WHERE id = ?").bind(c.req.param("id")).run();
  await c.env.DB.prepare("DELETE FROM post_tags WHERE tag_id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

export default app;
