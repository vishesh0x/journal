import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { AppEnv } from "../types";

// "__Host-" pins the cookie to this exact host over HTTPS with path "/" (no Domain attribute).
export const SESSION_COOKIE = "__Host-journal_session";

// Attaches userId/isAdmin to context if a valid session cookie is present.
// Does NOT reject the request — use `requireAuth`/`requireAdmin` for that.
export const attachSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    try {
      const payload = await verify(token, c.env.SESSION_SECRET, "HS256");
      if (typeof payload.sub === "string" && typeof payload.ep === "number") {
        // The token only proves it was issued by us. The database decides whether it is still good:
        // the user must exist and the token's epoch must match, so sign-out revokes it everywhere.
        const user = await c.env.DB.prepare("SELECT is_admin, session_epoch FROM users WHERE id = ?")
          .bind(payload.sub)
          .first<{ is_admin: number; session_epoch: number }>();
        if (user && user.session_epoch === payload.ep) {
          c.set("userId", payload.sub);
          c.set("isAdmin", user.is_admin === 1);
        }
      }
    } catch {
      // invalid/expired token — treat as logged out
    }
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("userId")) return c.json({ error: "Unauthorized" }, 401);
  await next();
});

export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("userId") || !c.get("isAdmin")) return c.json({ error: "Forbidden" }, 403);
  await next();
});
