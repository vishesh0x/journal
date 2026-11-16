import { Hono, type Context } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { verifyPassword } from "../lib/password";
import { hit } from "../lib/throttle";
import { HttpError, readJson, safeUrl } from "../lib/validate";
import { MAX_IMAGE_BYTES, inspectImage } from "../lib/image-check";
import { cleanSocialLinks } from "./settings";

const app = new Hono<AppEnv>();

const FORMAT = "journal-backup";
const VERSION = 1;
const TABLES = ["site_settings", "tags", "posts", "post_tags", "pages", "subscribers"] as const;
type Table = (typeof TABLES)[number];
type Row = Record<string, unknown>;

const KEY_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,199}$/;
const MAX_BODY = 64 * 1024 * 1024;
const LONG_COLUMNS = new Set(["content_md", "about_markdown"]);
const URL_COLUMNS = new Set(["cover_url", "og_image", "canonical_url", "author_avatar_url", "favicon_url", "logo_url", "default_og_image"]);

// Exporting or replacing the whole site needs the owner's password again, even with a valid session.
async function confirmOwner(c: Context<AppEnv>, password: unknown) {
  const userId = c.get("userId");
  const gate = await hit(c.env.DB, `backup:${userId}`, 10, 900);
  if (!gate.allowed) throw new HttpError(429, "Too many attempts. Wait a few minutes and try again.");
  const row = await c.env.DB.prepare("SELECT password_hash FROM users WHERE id = ?").bind(userId).first<{ password_hash: string }>();
  if (typeof password !== "string" || !row || !(await verifyPassword(password, row.password_hash))) {
    throw new HttpError(403, "That password is not correct.");
  }
}

async function listMedia(c: Context<AppEnv>) {
  const out: { key: string; size: number; name: string }[] = [];
  let cursor: string | undefined;
  for (let i = 0; i < 5; i++) {
    const page = await c.env.MEDIA.list({ limit: 1000, cursor, include: ["customMetadata"] });
    for (const o of page.objects) out.push({ key: o.key, size: o.size, name: o.customMetadata?.name || o.key });
    if (!page.truncated) break;
    cursor = page.cursor;
  }
  return out;
}

app.post("/export", requireAdmin, async (c) => {
  const body = await readJson<{ password?: unknown }>(c);
  await confirmOwner(c, body.password);
  const data: Record<string, Row[]> = {};
  for (const table of TABLES) data[table] = (await c.env.DB.prepare(`SELECT * FROM ${table}`).all<Row>()).results;
  const media = await listMedia(c);
  return c.json({
    manifest: {
      format: FORMAT,
      version: VERSION,
      created: new Date().toISOString(),
      counts: { ...Object.fromEntries(TABLES.map((t) => [t, data[t]!.length])), media: media.length },
    },
    data,
    media,
  });
});

// One image at a time, so large libraries never pass through a single request.
app.put("/media/:key", requireAdmin, async (c) => {
  const key = c.req.param("key");
  if (!KEY_RE.test(key)) throw new HttpError(400, "That file name is not allowed.");
  if (Number(c.req.header("Content-Length") ?? 0) > MAX_IMAGE_BYTES + 1024) throw new HttpError(413, "File is too large (15MB max).");
  const found = inspectImage(await c.req.arrayBuffer());
  if (!found.ok) throw new HttpError(400, `${key}: ${found.error}`);
  const name = decodeURIComponent(c.req.header("X-Media-Name") ?? "").replace(/[\u0000-\u001f]/g, "").slice(0, 120);
  await c.env.MEDIA.put(key, found.payload, { httpMetadata: { contentType: found.type }, customMetadata: { name: name || key } });
  return c.json({ ok: true });
});

async function columnsOf(db: D1Database, table: Table): Promise<string[]> {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  return info.results.map((r) => r.name);
}

function scalar(table: string, column: string, value: unknown): string | number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new HttpError(400, `${table}.${column} is not a number.`);
    return value;
  }
  if (typeof value !== "string") throw new HttpError(400, `${table}.${column} has an unsupported value.`);
  const max = LONG_COLUMNS.has(column) ? 500_000 : column === "analytics_script" ? 10_000 : 2_000;
  if (value.length > max) throw new HttpError(400, `${table}.${column} is too long.`);
  if (URL_COLUMNS.has(column)) return safeUrl(value, `${table}.${column}`);
  return value;
}

function oneOf(table: string, column: string, value: unknown, allowed: string[]) {
  if (value === null || value === undefined) return;
  if (typeof value !== "string" || !allowed.includes(value)) throw new HttpError(400, `${table}.${column} is not valid.`);
}

// Every row is rebuilt from known columns only; anything unexpected in the file is dropped or refused.
function cleanRows(table: Table, rows: unknown, columns: string[], ownerId: string): Row[] {
  if (rows === undefined && table === "site_settings") return [];
  if (!Array.isArray(rows)) throw new HttpError(400, `The backup is missing ${table}.`);
  if (rows.length > 100_000) throw new HttpError(400, `The backup has too many ${table} rows.`);
  const known = new Set(columns);
  return rows.map((raw, i) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) throw new HttpError(400, `${table} row ${i + 1} is not valid.`);
    const row: Row = {};
    for (const [column, value] of Object.entries(raw as Row)) {
      if (!known.has(column) || column === "__proto__") continue;
      row[column] = scalar(table, column, value);
    }
    if (table === "posts") {
      row.author_id = ownerId; // users are not part of a backup, so every post belongs to the current owner
      oneOf(table, "status", row.status, ["draft", "published"]);
      if (row.published_at != null && Number.isNaN(Date.parse(String(row.published_at)))) throw new HttpError(400, "A post has an invalid publish date.");
    }
    if (table === "pages") {
      oneOf(table, "status", row.status, ["draft", "published"]);
      oneOf(table, "system_key", row.system_key, ["privacy", "terms"]);
    }
    if (table === "subscribers") oneOf(table, "status", row.status, ["active", "unsubscribed"]);
    if (table === "site_settings") {
      oneOf(table, "theme_mode", row.theme_mode, ["system", "light", "dark"]);
      if (typeof row.social_links === "string") {
        try {
          row.social_links = cleanSocialLinks(JSON.parse(row.social_links));
        } catch (err) {
          if (err instanceof HttpError) throw err;
          throw new HttpError(400, "The saved social links are not valid.");
        }
      }
    }
    return row;
  });
}

function requireKeys(table: string, rows: Row[], keys: string[], pattern?: Record<string, RegExp>) {
  const seen = new Map<string, Set<string>>(keys.map((k) => [k, new Set()]));
  for (const row of rows) {
    for (const key of keys) {
      const v = row[key];
      if (typeof v !== "string" || !v) throw new HttpError(400, `A ${table} row has no ${key}.`);
      if (pattern?.[key] && !pattern[key]!.test(v)) throw new HttpError(400, `A ${table} row has an invalid ${key}.`);
      const set = seen.get(key)!;
      if (set.has(v)) throw new HttpError(400, `${table} has two rows with the same ${key}.`);
      set.add(v);
    }
  }
}

app.post("/restore", requireAdmin, async (c) => {
  if (Number(c.req.header("Content-Length") ?? 0) > MAX_BODY) throw new HttpError(413, "That backup is too large to restore in one go.");
  const body = await readJson<{ password?: unknown; data?: Record<string, unknown> }>(c);
  await confirmOwner(c, body.password);
  const data = body.data;
  if (!data || typeof data !== "object") throw new HttpError(400, "The backup has no data.");

  const ownerId = c.get("userId")!;
  const cols = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await columnsOf(c.env.DB, t)]))) as Record<Table, string[]>;
  const clean = Object.fromEntries(TABLES.map((t) => [t, cleanRows(t, data[t], cols[t], ownerId)])) as Record<Table, Row[]>;

  // Validate everything before touching the live site, so a bad file changes nothing.
  requireKeys("tags", clean.tags, ["id", "slug"], { id: ID_RE, slug: SLUG_RE });
  requireKeys("posts", clean.posts, ["id", "slug"], { id: ID_RE, slug: SLUG_RE });
  requireKeys("pages", clean.pages, ["id", "slug"], { id: ID_RE, slug: SLUG_RE });
  requireKeys("subscribers", clean.subscribers, ["id", "email", "token"], { id: ID_RE });
  for (const t of clean.tags) if (typeof t.name !== "string" || !t.name) throw new HttpError(400, "A topic has no name.");
  const postIds = new Set(clean.posts.map((p) => p.id as string));
  const tagIds = new Set(clean.tags.map((t) => t.id as string));
  const links = clean.post_tags.filter((l) => postIds.has(l.post_id as string) && tagIds.has(l.tag_id as string));
  if (clean.site_settings.length > 1) throw new HttpError(400, "The backup has more than one settings row.");

  const insert = (table: Table, row: Row) => {
    const names = Object.keys(row);
    return c.env.DB.prepare(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`).bind(...names.map((n) => row[n]));
  };

  const first: D1PreparedStatement[] = [
    c.env.DB.prepare("DELETE FROM post_tags"),
    c.env.DB.prepare("DELETE FROM posts"),
    c.env.DB.prepare("DELETE FROM tags"),
    c.env.DB.prepare("DELETE FROM pages"),
    c.env.DB.prepare("DELETE FROM subscribers"),
  ];
  const settings = clean.site_settings[0];
  if (settings) {
    const names = Object.keys(settings).filter((n) => n !== "id");
    if (names.length) {
      first.push(
        c.env.DB.prepare(`UPDATE site_settings SET ${names.map((n) => `${n} = ?`).join(", ")} WHERE id = 'main'`).bind(...names.map((n) => settings[n])),
      );
    }
  }
  const inserts = [
    ...clean.tags.map((r) => insert("tags", r)),
    ...clean.posts.map((r) => insert("posts", r)),
    ...links.map((r) => insert("post_tags", r)),
    ...clean.pages.map((r) => insert("pages", r)),
    ...clean.subscribers.map((r) => insert("subscribers", r)),
  ];

  // The first batch clears the old content and the rest refills it in slices, each slice atomic.
  await c.env.DB.batch(first);
  for (let i = 0; i < inserts.length; i += 400) await c.env.DB.batch(inserts.slice(i, i + 400));

  return c.json({
    ok: true,
    restored: { posts: clean.posts.length, pages: clean.pages.length, tags: clean.tags.length, subscribers: clean.subscribers.length },
  });
});

export default app;
