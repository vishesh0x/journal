import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { MAX_IMAGE_BYTES, inspectImage } from "../lib/image-check";

const app = new Hono<AppEnv>();

// Admin-only upload: multipart/form-data with a "file" field.
// Stores the object in R2 and returns a durable public URL.
//
// For that URL to actually resolve, point a custom domain at the R2
// bucket (Cloudflare dashboard -> R2 -> bucket -> Settings -> Public
// access / custom domain) and set PUBLIC_MEDIA_BASE_URL to it in
// wrangler.jsonc. Until that's configured, uploads succeed but the
// returned URL will 404 — see the "media serving" note in the README.
app.post("/upload", requireAdmin, async (c) => {
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > MAX_IMAGE_BYTES + 64 * 1024) return c.json({ error: "File is too large (15MB max)." }, 413);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);

  const found = inspectImage(await file.arrayBuffer());
  if (!found.ok) return c.json({ error: found.error }, 400);

  // Random key and an extension taken from the inspected type, never from the uploaded name.
  const key = `${crypto.randomUUID()}.${found.ext}`;
  const name = file.name.replace(/[\u0000-\u001f]/g, "").slice(0, 120);
  await c.env.MEDIA.put(key, found.payload, { httpMetadata: { contentType: found.type }, customMetadata: { name } });

  const base = c.env.PUBLIC_MEDIA_BASE_URL;
  const url = base ? `${base.replace(/\/$/, "")}/${key}` : `/api/media/${key}`;
  return c.json({ url, key });
});

type Source = { label: string; text: string };

// Admin-only library listing: newest first, with where each file is used so deleting is an informed choice.
app.get("/admin/list", requireAdmin, async (c) => {
  const offset = Math.max(0, Number(c.req.query("offset") ?? 0) || 0);
  const limit = Math.min(96, Math.max(1, Number(c.req.query("limit") ?? 48) || 48));

  const all: R2Object[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await c.env.MEDIA.list({ limit: 1000, cursor, include: ["customMetadata", "httpMetadata"] });
    all.push(...page.objects);
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  all.sort((a, b) => b.uploaded.getTime() - a.uploaded.getTime());
  const slice = all.slice(offset, offset + limit);

  const sources: Source[] = [];
  const [posts, pages, settings] = await Promise.all([
    c.env.DB.prepare("SELECT title, cover_url, og_image, content_md FROM posts").all<{ title: string; cover_url: string | null; og_image: string | null; content_md: string }>(),
    c.env.DB.prepare("SELECT title, content_md FROM pages").all<{ title: string; content_md: string }>(),
    c.env.DB.prepare("SELECT author_avatar_url, favicon_url, logo_url, default_og_image, about_markdown FROM site_settings WHERE id = 'main'").first<Record<string, string | null>>(),
  ]);
  for (const p of posts.results) sources.push({ label: `Post: ${p.title}`, text: `${p.cover_url ?? ""} ${p.og_image ?? ""} ${p.content_md}` });
  for (const p of pages.results) sources.push({ label: `Page: ${p.title}`, text: p.content_md });
  if (settings) sources.push({ label: "Site settings", text: Object.values(settings).join(" ") });

  const base = c.env.PUBLIC_MEDIA_BASE_URL?.replace(/\/$/, "");
  const items = slice.map((o) => ({
    key: o.key,
    url: base ? `${base}/${o.key}` : `/api/media/${o.key}`,
    size: o.size,
    uploaded: o.uploaded.toISOString(),
    type: o.httpMetadata?.contentType ?? "",
    name: o.customMetadata?.name || o.key,
    usedIn: sources.filter((s) => s.text.includes(o.key)).map((s) => s.label).slice(0, 5),
  }));
  return c.json({ items, total: all.length, hasMore: offset + limit < all.length });
});

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

// Fallback proxy so media works even without a public R2 custom domain
// (fine for low traffic; a real custom domain is far more efficient
// since it skips the Worker entirely).
app.get("/:key", async (c) => {
  const key = c.req.param("key");
  if (!KEY_RE.test(key)) return c.notFound();
  const object = await c.env.MEDIA.get(key);
  if (!object) return c.notFound();
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  headers.set("content-security-policy", "default-src 'none'; style-src 'unsafe-inline'; img-src data:; sandbox");
  headers.set("x-content-type-options", "nosniff");
  headers.set("cross-origin-resource-policy", "same-origin");
  return new Response(object.body, { headers });
});

app.delete("/:key", requireAdmin, async (c) => {
  const key = c.req.param("key");
  if (!KEY_RE.test(key)) return c.notFound();
  await c.env.MEDIA.delete(key);
  return c.json({ ok: true });
});

export default app;
