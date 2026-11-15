import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";

const app = new Hono<AppEnv>();

app.get("/", requireAdmin, async (c) => {
  const db = c.env.DB;
  const [recent, postCounts, subs, tags] = await db.batch([
    db.prepare(
      "SELECT id,title,slug,status,published_at,updated_at,reading_minutes FROM posts ORDER BY updated_at DESC LIMIT 6",
    ),
    db.prepare(
      "SELECT SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) as published, SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) as drafts FROM posts",
    ),
    db.prepare("SELECT COUNT(*) as count FROM subscribers WHERE status='active'"),
    db.prepare("SELECT COUNT(*) as count FROM tags"),
  ]);
  const counts = postCounts.results[0] as { published: number; drafts: number } | undefined;
  return c.json({
    recent: recent.results,
    published: counts?.published ?? 0,
    drafts: counts?.drafts ?? 0,
    subscribers: (subs.results[0] as { count: number } | undefined)?.count ?? 0,
    tagCount: (tags.results[0] as { count: number } | undefined)?.count ?? 0,
  });
});

export default app;
