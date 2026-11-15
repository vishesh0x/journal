import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import type { AppEnv } from "../types";
import { hashPassword, verifyPassword } from "../lib/password";
import { newId } from "../lib/content";
import { SESSION_COOKIE, requireAuth } from "../middleware/auth";

const app = new Hono<AppEnv>();

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

async function setSessionCookie(c: any, userId: string, isAdmin: boolean) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  const token = await sign({ sub: userId, isAdmin, exp }, c.env.SESSION_SECRET);
  setCookie(c, SESSION_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

// Registers the very first user as admin. Once any user exists, this
// route refuses further sign-ups (mirrors the original "claimOwnership":
// first person to sign in becomes admin, everyone else gets nothing).
// If you want a real multi-user model, replace this with an invite flow.
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

app.post("/register", async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email || !EMAIL_RE.test(email) || !password || password.length < 8) {
    return c.json({ error: "A valid email and an 8+ character password are required." }, 400);
  }
  const { results: existing } = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").all();
  if (existing.length > 0) {
    return c.json({ error: "Registration is closed. This site already has an owner." }, 403);
  }
  const id = newId("user");
  const passwordHash = await hashPassword(password);
  try {
    await c.env.DB.prepare(
      "INSERT INTO users (id, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, 1, datetime('now'))",
    )
      .bind(id, email.trim().toLowerCase(), passwordHash)
      .run();
  } catch (err) {
    // Most likely a UNIQUE constraint hit (e.g. a near-simultaneous
    // registration). Either way, someone already owns this site now.
    console.error(err);
    return c.json({ error: "Registration is closed. This site already has an owner." }, 403);
  }
  await setSessionCookie(c, id, true);
  return c.json({ ok: true, isAdmin: true });
});

app.post("/login", async (c) => {
  const { email, password } = await c.req.json<{ email?: string; password?: string }>();
  if (!email || !password) return c.json({ error: "Email and password are required." }, 400);
  const row = await c.env.DB.prepare("SELECT id, password_hash, is_admin FROM users WHERE email = ?")
    .bind(email.trim().toLowerCase())
    .first<{ id: string; password_hash: string; is_admin: number }>();
  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return c.json({ error: "Invalid email or password." }, 401);
  }
  await setSessionCookie(c, row.id, Boolean(row.is_admin));
  return c.json({ ok: true, isAdmin: Boolean(row.is_admin) });
});

app.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

app.get("/me", requireAuth, async (c) => {
  return c.json({ userId: c.get("userId"), isAdmin: c.get("isAdmin") });
});

// Lets the frontend know whether to show "Create the first admin account"
// or a normal login form.
app.get("/bootstrap-status", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").all();
  return c.json({ needsBootstrap: results.length === 0 });
});

export default app;
