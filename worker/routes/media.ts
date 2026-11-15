import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { checkSvg } from "../lib/svg";

const app = new Hono<AppEnv>();

// Admin-only upload: multipart/form-data with a "file" field.
// Stores the object in R2 and returns a durable public URL.
//
// For that URL to actually resolve, point a custom domain at the R2
// bucket (Cloudflare dashboard -> R2 -> bucket -> Settings -> Public
// access / custom domain) and set PUBLIC_MEDIA_BASE_URL to it in
// wrangler.jsonc. Until that's configured, uploads succeed but the
// returned URL will 404 — see the "media serving" note in the README.
const MAX_BYTES = 15 * 1024 * 1024;

// The browser-declared type is not trusted: the file's own first bytes decide what it is.
function sniff(bytes: Uint8Array): { type: string; ext: string } | null {
  const at = (i: number, text: string) => text.split("").every((ch, k) => bytes[i + k] === ch.charCodeAt(0));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && at(1, "PNG\r\n")) return { type: "image/png", ext: "png" };
  if (at(0, "GIF87a") || at(0, "GIF89a")) return { type: "image/gif", ext: "gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { type: "image/webp", ext: "webp" };
  if (at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return { type: "image/avif", ext: "avif" };
  return null;
}

app.post("/upload", requireAdmin, async (c) => {
  const declared = Number(c.req.header("Content-Length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) return c.json({ error: "File is too large (15MB max)." }, 413);
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return c.json({ error: "No file provided." }, 400);
  if (file.size > MAX_BYTES) return c.json({ error: "File is too large (15MB max)." }, 400);

  const buffer = await file.arrayBuffer();
  let detected = sniff(new Uint8Array(buffer.slice(0, 16)));
  let payload: ArrayBuffer | string = buffer;
  if (!detected) {
    // Not a raster image: accept it only if it is a plain SVG that passes the allowlist.
    const svg = checkSvg(new Uint8Array(buffer));
    if (svg.ok) {
      detected = { type: "image/svg+xml", ext: "svg" };
      payload = svg.text;
    } else if (/^\s*(<\?xml|<svg|\uFEFF)/i.test(new TextDecoder().decode(buffer.slice(0, 64)))) {
      return c.json({ error: svg.reason }, 400);
    }
  }
  if (!detected) return c.json({ error: "Only JPEG, PNG, WebP, GIF, AVIF or SVG images are allowed." }, 400);

  // Random key and an extension taken from the sniffed type, never from the uploaded name.
  const key = `${crypto.randomUUID()}.${detected.ext}`;
  await c.env.MEDIA.put(key, payload, { httpMetadata: { contentType: detected.type } });

  const base = c.env.PUBLIC_MEDIA_BASE_URL;
  const url = base ? `${base.replace(/\/$/, "")}/${key}` : `/api/media/${key}`;
  return c.json({ url, key });
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
