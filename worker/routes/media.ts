import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";

const app = new Hono<AppEnv>();

// Admin-only upload: multipart/form-data with a "file" field.
// Stores the object in R2 and returns a durable public URL.
//
// For that URL to actually resolve, point a custom domain at the R2
// bucket (Cloudflare dashboard -> R2 -> bucket -> Settings -> Public
// access / custom domain) and set PUBLIC_MEDIA_BASE_URL to it in
// wrangler.jsonc. Until that's configured, uploads succeed but the
// returned URL will 404 — see the "media serving" note in the README.
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

app.post("/upload", requireAdmin, async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);
  if (file.size > 15 * 1024 * 1024) return c.json({ error: "File is too large (15MB max)." }, 400);
  if (!ALLOWED_TYPES.has(file.type)) {
    return c.json({ error: "Only JPEG, PNG, WebP, GIF, or AVIF images are allowed." }, 400);
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const key = `${Date.now()}-${safeName}`;
  await c.env.MEDIA.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type },
  });

  const base = c.env.PUBLIC_MEDIA_BASE_URL;
  const url = base ? `${base.replace(/\/$/, "")}/${key}` : `/api/media/${key}`;
  return c.json({ url, key });
});

// Fallback proxy so media works even without a public R2 custom domain
// (fine for low traffic; a real custom domain is far more efficient
// since it skips the Worker entirely).
app.get("/:key", async (c) => {
  const object = await c.env.MEDIA.get(c.req.param("key"));
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
});

app.delete("/:key", requireAdmin, async (c) => {
  await c.env.MEDIA.delete(c.req.param("key"));
  return c.json({ ok: true });
});

export default app;
