import { Hono } from "hono";
import type { AppEnv } from "../types";
import { requireAdmin } from "../middleware/auth";
import { newId } from "../lib/content";

const app = new Hono<AppEnv>();

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

app.post("/subscribe", async (c) => {
  const { email: raw } = await c.req.json<{ email?: string }>().catch(() => ({ email: undefined }));
  const email = (raw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return c.json({ error: "Please enter a valid email address." }, 400);

  const existing = await c.env.DB.prepare("SELECT id, status FROM subscribers WHERE email = ?")
    .bind(email)
    .first<{ id: string; status: string }>();
  if (existing) {
    if (existing.status !== "active") {
      await c.env.DB.prepare("UPDATE subscribers SET status='active', unsubscribed_at=NULL WHERE id=?")
        .bind(existing.id)
        .run();
    }
    return c.json({ ok: true, message: "You're on the list." });
  }
  await c.env.DB.prepare(
    "INSERT INTO subscribers (id, email, status, token, source, created_at) VALUES (?, ?, 'active', ?, 'site', datetime('now'))",
  )
    .bind(newId("sub"), email, crypto.randomUUID())
    .run();
  return c.json({ ok: true, message: "You're on the list." });
});

app.post("/unsubscribe", async (c) => {
  const { token } = await c.req.json<{ token?: string }>().catch(() => ({ token: undefined }));
  if (!token) return c.json({ ok: false, message: "That unsubscribe link is not valid." }, 400);
  const row = await c.env.DB.prepare("SELECT id, email FROM subscribers WHERE token = ?").bind(token).first<{
    id: string;
    email: string;
  }>();
  if (!row) return c.json({ ok: false, message: "That unsubscribe link is not valid." }, 404);
  await c.env.DB.prepare("UPDATE subscribers SET status='unsubscribed', unsubscribed_at=datetime('now') WHERE id=?")
    .bind(row.id)
    .run();
  return c.json({ ok: true, message: `${row.email} has been removed.` });
});

app.get("/admin", requireAdmin, async (c) => {
  const page = Math.max(1, Math.trunc(Number(c.req.query("page")) || 1));
  const perPage = Math.min(1000, Math.max(1, Math.trunc(Number(c.req.query("perPage")) || 50)));
  const offset = (page - 1) * perPage;
  const [{ results }, countRow] = await Promise.all([
    c.env.DB.prepare("SELECT id,email,status,created_at FROM subscribers ORDER BY created_at DESC LIMIT ? OFFSET ?")
      .bind(perPage, offset)
      .all(),
    c.env.DB.prepare("SELECT COUNT(*) as count FROM subscribers").first<{ count: number }>(),
  ]);
  return c.json({ subscribers: results, total: countRow?.count ?? 0, page, perPage });
});

app.delete("/admin/:id", requireAdmin, async (c) => {
  await c.env.DB.prepare("DELETE FROM subscribers WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

export default app;
