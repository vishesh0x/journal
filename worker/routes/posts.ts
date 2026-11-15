import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { newId, readingMinutes, makeExcerpt, slugify } from "../lib/content";
import { cacheControl } from "../middleware/cache";
import { HttpError, cleanFields, readJson, type Rule } from "../lib/validate";

const app = new Hono<AppEnv>();

type TagRow = { id: string; name: string; slug: string };

async function tagsForPosts(db: D1Database, postIds: string[]): Promise<Map<string, TagRow[]>> {
  const map = new Map<string, TagRow[]>();
  if (postIds.length === 0) return map;
  const placeholders = postIds.map(() => "?").join(",");
  const { results } = await db
    .prepare(
      `SELECT pt.post_id as postId, t.id, t.name, t.slug
       FROM post_tags pt JOIN tags t ON t.id = pt.tag_id
       WHERE pt.post_id IN (${placeholders})`,
    )
    .bind(...postIds)
    .all<{ postId: string; id: string; name: string; slug: string }>();
  for (const row of results) {
    const list = map.get(row.postId) ?? [];
    list.push({ id: row.id, name: row.name, slug: row.slug });
    map.set(row.postId, list);
  }
  return map;
}

const SUMMARY_COLUMNS =
  "id,title,slug,subtitle,excerpt,cover_url,published_at,reading_minutes,featured";

// ---- Public ----

function parseIntParam(value: string | undefined, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

app.get("/", cacheControl(60), async (c) => {
  const page = parseIntParam(c.req.query("page"), 1, 1, 100_000);
  const perPage = parseIntParam(c.req.query("perPage"), 8, 1, 50);
  const tagSlug = c.req.query("tag");
  const offset = (page - 1) * perPage;
  const now = new Date().toISOString();

  let tagRow: { id: string; name: string; slug: string; description: string | null } | null = null;
  let postIdFilter: string[] | null = null;
  if (tagSlug) {
    tagRow = await c.env.DB.prepare("SELECT id, name, slug, description FROM tags WHERE slug = ?")
      .bind(tagSlug)
      .first();
    if (!tagRow) return c.json({ posts: [], total: 0, page, perPage, tag: null });
    const { results } = await c.env.DB.prepare("SELECT post_id FROM post_tags WHERE tag_id = ?")
      .bind(tagRow.id)
      .all<{ post_id: string }>();
    postIdFilter = results.map((r) => r.post_id);
    if (postIdFilter.length === 0) return c.json({ posts: [], total: 0, page, perPage, tag: tagRow });
  }

  const filterSql = postIdFilter ? `AND id IN (${postIdFilter.map(() => "?").join(",")})` : "";
  const filterArgs = postIdFilter ?? [];

  const countRow = await c.env.DB.prepare(
    `SELECT COUNT(*) as count FROM posts WHERE status = 'published' AND published_at <= ? ${filterSql}`,
  )
    .bind(now, ...filterArgs)
    .first<{ count: number }>();

  const { results: rows } = await c.env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM posts WHERE status = 'published' AND published_at <= ? ${filterSql}
     ORDER BY ${tagSlug ? "" : "featured DESC, "}published_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(now, ...filterArgs, perPage, offset)
    .all<any>();

  const tagMap = await tagsForPosts(c.env.DB, rows.map((r) => r.id));
  const posts = rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));

  return c.json({ posts, total: countRow?.count ?? 0, page, perPage, tag: tagRow });
});

app.get("/archive", cacheControl(120), async (c) => {
  const now = new Date().toISOString();
  const { results } = await c.env.DB.prepare(
    `SELECT id, title, slug, published_at, reading_minutes FROM posts
     WHERE status = 'published' AND published_at <= ? ORDER BY published_at DESC`,
  )
    .bind(now)
    .all();
  return c.json(results);
});

app.get("/search", cacheControl(60), async (c) => {
  const q = (c.req.query("q") ?? "").trim().slice(0, 200);
  if (!q) return c.json({ posts: [], query: "" });
  const now = new Date().toISOString();
  const like = `%${q.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const { results: rows } = await c.env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM posts
     WHERE status = 'published' AND published_at <= ?
       AND (title LIKE ? ESCAPE '\\' OR excerpt LIKE ? ESCAPE '\\' OR content_md LIKE ? ESCAPE '\\')
     ORDER BY published_at DESC LIMIT 20`,
  )
    .bind(now, like, like, like)
    .all<any>();
  const tagMap = await tagsForPosts(c.env.DB, rows.map((r) => r.id));
  const posts = rows.map((r) => ({ ...r, tags: tagMap.get(r.id) ?? [] }));
  return c.json({ posts, query: q });
});

app.get("/by-slug/:slug", cacheControl(60), async (c) => {
  const slug = c.req.param("slug");
  const now = new Date().toISOString();
  const post = await c.env.DB.prepare(
    `SELECT id,title,slug,subtitle,excerpt,content_md,cover_url,published_at,reading_minutes,featured,
            meta_title,meta_description,og_image,canonical_url,noindex
     FROM posts WHERE slug = ? AND status = 'published' AND published_at <= ?`,
  )
    .bind(slug, now)
    .first<any>();
  if (!post) return c.json({ post: null, more: [] }, 404);

  const tagMap = await tagsForPosts(c.env.DB, [post.id]);
  post.tags = tagMap.get(post.id) ?? [];

  await c.env.DB.prepare("UPDATE posts SET view_count = view_count + 1 WHERE id = ?").bind(post.id).run();

  const { results: moreRows } = await c.env.DB.prepare(
    `SELECT ${SUMMARY_COLUMNS} FROM posts WHERE status='published' AND published_at <= ? AND slug != ?
     ORDER BY published_at DESC LIMIT 3`,
  )
    .bind(now, slug)
    .all<any>();
  const moreTagMap = await tagsForPosts(c.env.DB, moreRows.map((r) => r.id));
  const more = moreRows.map((r) => ({ ...r, tags: moreTagMap.get(r.id) ?? [] }));

  return c.json({ post, more });
});

// ---- Admin ----

app.get("/admin", requireAdmin, async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT id,title,slug,status,published_at,updated_at,reading_minutes,featured,cover_url,view_count FROM posts ORDER BY updated_at DESC",
  ).all();
  return c.json(results);
});

app.get("/admin/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const post = await c.env.DB.prepare("SELECT * FROM posts WHERE id = ?").bind(id).first();
  if (!post) return c.json({ error: "Post not found" }, 404);
  const { results: links } = await c.env.DB.prepare("SELECT tag_id FROM post_tags WHERE post_id = ?")
    .bind(id)
    .all<{ tag_id: string }>();
  const { results: tags } = await c.env.DB.prepare("SELECT id,name,slug FROM tags ORDER BY name").all();
  return c.json({ post, tagIds: links.map((l) => l.tag_id), tags });
});

app.post("/admin", requireAdmin, async (c) => {
  const body = await c.req.json<{ title?: string }>().catch(() => ({}) as { title?: string });
  const title = (typeof body.title === "string" ? body.title.trim().slice(0, 300) : "") || "Untitled post";
  let slug = slugify(title);
  const clash = await c.env.DB.prepare("SELECT id FROM posts WHERE slug = ?").bind(slug).first();
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const id = newId("post");
  await c.env.DB.prepare(
    `INSERT INTO posts (id, author_id, title, slug, content_md, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, '', 'draft', datetime('now'), datetime('now'))`,
  )
    .bind(id, c.get("userId"), title, slug)
    .run();
  return c.json({ id });
});

const RULES: Record<string, Rule> = {
  title: "text",
  slug: "text",
  subtitle: "text",
  excerpt: "text",
  content_md: "long",
  cover_url: "url",
  status: "enum:draft,published",
  published_at: "date",
  featured: "bool",
  meta_title: "text",
  meta_description: "text",
  og_image: "url",
  canonical_url: "url",
  noindex: "bool",
};

app.put("/admin/:id", requireAdmin, async (c) => {
  const id = c.req.param("id");
  const body = await readJson<Record<string, unknown> & { tagIds?: unknown }>(c);
  const { tagIds: rawTagIds, ...patch } = body;
  const update = cleanFields(patch, RULES);
  if (rawTagIds !== undefined && (!Array.isArray(rawTagIds) || rawTagIds.length > 50 || rawTagIds.some((t) => typeof t !== "string"))) {
    throw new HttpError(400, "Topics must be a list of ids.");
  }
  const tagIds = rawTagIds as string[] | undefined;

  if (typeof update.content_md === "string") {
    update.reading_minutes = readingMinutes(update.content_md);
    if (!update.excerpt) update.excerpt = makeExcerpt(update.content_md);
  }
  if (typeof update.slug === "string") {
    update.slug = slugify(update.slug || (typeof patch.title === "string" ? patch.title : "") || "untitled");
    const clash = await c.env.DB.prepare("SELECT id FROM posts WHERE slug = ? AND id != ?")
      .bind(update.slug, id)
      .first();
    if (clash) return c.json({ error: "Another post already uses that address." }, 409);
  }
  if (update.status === "published" && !update.published_at) {
    const current = await c.env.DB.prepare("SELECT published_at FROM posts WHERE id = ?").bind(id).first<{
      published_at: string | null;
    }>();
    if (!current?.published_at) update.published_at = new Date().toISOString();
  }

  const keys = Object.keys(update);
  if (keys.length > 0) {
    const setSql = keys.map((k) => `${k} = ?`).join(", ");
    await c.env.DB.prepare(`UPDATE posts SET ${setSql}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...keys.map((k) => update[k]), id)
      .run();
  }

  if (tagIds) {
    const statements = [
      c.env.DB.prepare("DELETE FROM post_tags WHERE post_id = ?").bind(id),
      ...tagIds.map((tagId: string) =>
        c.env.DB.prepare("INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)").bind(id, tagId),
      ),
    ];
    if (statements.length > 0) await c.env.DB.batch(statements);
  }
  return c.json({ ok: true });
});

app.delete("/admin/:id", requireAdmin, async (c) => {
  await c.env.DB.prepare("DELETE FROM posts WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

export default app;
