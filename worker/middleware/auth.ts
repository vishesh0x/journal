import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { verify } from "hono/jwt";
import type { AppEnv } from "../types";

export const SESSION_COOKIE = "journal_session";

// Attaches userId/isAdmin to context if a valid session cookie is present.
// Does NOT reject the request — use `requireAuth`/`requireAdmin` for that.
export const attachSession = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    try {
      const payload = await verify(token, c.env.SESSION_SECRET, "HS256");
      c.set("userId", payload.sub as string);
      c.set("isAdmin", Boolean(payload.isAdmin));
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
