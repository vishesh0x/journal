import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { obfuscateEmail } from "../lib/obfuscate";
import { cacheControl } from "../middleware/cache";

const app = new Hono<AppEnv>();

function shapeSettings(row: Record<string, unknown> | null) {
  const s = row ?? {};
  let socialLinks: Record<string, string> = {};
  try {
    const parsed = JSON.parse((s.social_links as string) ?? "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) socialLinks = parsed;
  } catch {
    socialLinks = {};
  }
  return { ...s, social_links: socialLinks };
}

app.get("/", cacheControl(60), async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM site_settings WHERE id = 'main'").first<Record<string, unknown>>();
  const settings = shapeSettings(row ?? null);
  if (settings.social_links.email) {
    settings.social_links = { ...settings.social_links, email: obfuscateEmail(settings.social_links.email) };
  }
  return c.json(settings);
});

app.get("/admin", requireAdmin, async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM site_settings WHERE id = 'main'").first<Record<string, unknown>>();
  return c.json(shapeSettings(row ?? null));
});

const PATCHABLE_FIELDS = [
  "site_name",
  "tagline",
  "description",
  "author_name",
  "author_bio",
  "author_avatar_url",
  "favicon_url",
  "logo_url",
  "accent",
  "theme_mode",
  "about_markdown",
  "footer_text",
  "social_links", // object of platform -> url in the JSON body, re-serialized to text below
  "default_meta_title",
  "default_meta_description",
  "default_og_image",
  "posts_per_page",
  "newsletter_enabled",
  "newsletter_headline",
  "newsletter_blurb",
  "analytics_script",
  "image_resizing_enabled",
] as const;

app.put("/admin", requireAdmin, async (c) => {
  const body = await c.req.json<Record<string, unknown>>();
  const update: Record<string, unknown> = {};
  for (const field of PATCHABLE_FIELDS) if (field in body) update[field] = body[field];
  if ("social_links" in update) update.social_links = JSON.stringify(update.social_links ?? {});
  if ("posts_per_page" in update) {
    const n = Number(update.posts_per_page);
    update.posts_per_page = Number.isFinite(n) ? Math.min(50, Math.max(1, Math.trunc(n))) : 8;
  }

  const keys = Object.keys(update);
  if (keys.length === 0) return c.json({ ok: true });
  const setSql = keys.map((k) => `${k} = ?`).join(", ");
  await c.env.DB.prepare(`UPDATE site_settings SET ${setSql}, updated_at = datetime('now') WHERE id = 'main'`)
    .bind(...keys.map((k) => update[k]))
    .run();
  return c.json({ ok: true });
});

export default app;
