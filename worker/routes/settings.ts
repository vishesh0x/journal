import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { obfuscateEmail } from "../lib/obfuscate";
import { cacheControl } from "../middleware/cache";
import { EMAIL_RE, HttpError, cleanFields, readJson, safeUrl, type Rule } from "../lib/validate";

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

const SOCIAL_KEYS = ["twitter", "github", "linkedin", "instagram", "mastodon", "website", "email"];

const RULES: Record<string, Rule> = {
  site_name: "text",
  tagline: "text",
  description: "text",
  author_name: "text",
  author_bio: "text",
  author_avatar_url: "url",
  favicon_url: "url",
  logo_url: "url",
  theme_mode: "enum:system,light,dark",
  about_markdown: "long",
  footer_text: "text",
  default_meta_title: "text",
  default_meta_description: "text",
  default_og_image: "url",
  posts_per_page: "int",
  newsletter_enabled: "bool",
  newsletter_headline: "text",
  newsletter_blurb: "text",
  analytics_script: "text",
  image_resizing_enabled: "bool",
};

export function cleanSocialLinks(value: unknown): string {
  if (value === null || value === undefined) return "{}";
  if (typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Social links must be an object.");
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!SOCIAL_KEYS.includes(key) || raw === "" || raw === null || raw === undefined) continue;
    if (typeof raw !== "string" || raw.length > 500) throw new HttpError(400, `The ${key} link is not valid.`);
    if (key === "email") {
      if (!EMAIL_RE.test(raw.replace(/^mailto:/, "").trim())) throw new HttpError(400, "The email link is not valid.");
      out[key] = raw.trim();
    } else {
      out[key] = safeUrl(raw, `The ${key} link`) as string;
    }
  }
  return JSON.stringify(out);
}

app.put("/admin", requireAdmin, async (c) => {
  const body = await readJson<Record<string, unknown>>(c);
  const update = cleanFields(body, RULES);
  if ("social_links" in body) update.social_links = cleanSocialLinks(body.social_links);
  if ("posts_per_page" in update) update.posts_per_page = Math.min(50, Math.max(1, update.posts_per_page as number));

  const keys = Object.keys(update);
  if (keys.length === 0) return c.json({ ok: true });
  // Column names come from the fixed rule map above, never from the request.
  const setSql = keys.map((k) => `${k} = ?`).join(", ");
  await c.env.DB.prepare(`UPDATE site_settings SET ${setSql}, updated_at = datetime('now') WHERE id = 'main'`)
    .bind(...keys.map((k) => update[k]))
    .run();
  return c.json({ ok: true });
});

export default app;
