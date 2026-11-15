import { Hono, type Context } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { sign } from "hono/jwt";
import type { AppEnv } from "../types";
import { hashPassword, verifyPassword } from "../lib/password";
import { newId } from "../lib/content";
import { SESSION_COOKIE, requireAuth } from "../middleware/auth";
import { EMAIL_RE, HttpError, readJson, safeEqual } from "../lib/validate";
import { clear, clientIp, hit } from "../lib/throttle";

const app = new Hono<AppEnv>();

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function setSessionCookie(c: Context<AppEnv>, userId: string, isAdmin: boolean) {
  const iat = Math.floor(Date.now() / 1000);
  const token = await sign({ sub: userId, isAdmin, iat, exp: iat + SESSION_TTL_SECONDS }, c.env.SESSION_SECRET, "HS256");
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
// A hash that never matches, verified when the email is unknown so both outcomes cost the same time.
const DUMMY_HASH = "pbkdf2:100000:00000000000000000000000000000000:0000000000000000000000000000000000000000000000000000000000000000";

app.post("/register", async (c) => {
  const { email, password, setupToken } = await readJson<{ email?: string; password?: string; setupToken?: string }>(c);
  if (c.env.SETUP_TOKEN && !(typeof setupToken === "string" && (await safeEqual(setupToken, c.env.SETUP_TOKEN)))) {
    return c.json({ error: "The setup code is missing or wrong." }, 403);
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim()) || typeof password !== "string" || password.length < 8 || password.length > 128) {
    return c.json({ error: "A valid email and a password of 8 to 128 characters are required." }, 400);
  }
  const gate = await hit(c.env.DB, `register:${clientIp(c)}`, 5, 3600);
  if (!gate.allowed) throw new HttpError(429, "Too many attempts. Try again later.");
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
  const { email, password } = await readJson<{ email?: string; password?: string }>(c);
  if (typeof email !== "string" || typeof password !== "string" || !email || !password || password.length > 128) {
    return c.json({ error: "Email and password are required." }, 400);
  }
  const normalised = email.trim().toLowerCase().slice(0, 320);
  const ipKey = `login:ip:${clientIp(c)}`;
  const emailKey = `login:email:${normalised}`;
  const [byIp, byEmail] = await Promise.all([hit(c.env.DB, ipKey, 20, 900), hit(c.env.DB, emailKey, 8, 900)]);
  if (!byIp.allowed || !byEmail.allowed) {
    c.header("Retry-After", String(Math.max(byIp.retryAfter, byEmail.retryAfter)));
    throw new HttpError(429, "Too many sign-in attempts. Wait a few minutes and try again.");
  }
  const row = await c.env.DB.prepare("SELECT id, password_hash, is_admin FROM users WHERE email = ?")
    .bind(normalised)
    .first<{ id: string; password_hash: string; is_admin: number }>();
  const ok = await verifyPassword(password, row?.password_hash ?? DUMMY_HASH);
  if (!row || !ok) return c.json({ error: "Invalid email or password." }, 401);
  await clear(c.env.DB, emailKey);
  await setSessionCookie(c, row.id, Boolean(row.is_admin));
  return c.json({ ok: true, isAdmin: Boolean(row.is_admin) });
});

app.post("/logout", async (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
  return c.json({ ok: true });
});

app.get("/me", requireAuth, async (c) => {
  return c.json({ userId: c.get("userId"), isAdmin: c.get("isAdmin") });
});

// Lets the frontend know whether to show "Create the first admin account"
// or a normal login form.
app.get("/bootstrap-status", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT id FROM users LIMIT 1").all();
  return c.json({ needsBootstrap: results.length === 0, needsSetupToken: Boolean(c.env.SETUP_TOKEN) });
});

export default app;
