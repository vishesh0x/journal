import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";

/**
 * Marks a response cacheable at Cloudflare's edge for `seconds`, serving
 * stale content for up to 5x that while revalidating in the background.
 * Only use on public, unauthenticated GET routes whose data doesn't need
 * to be instantly fresh for every visitor — never on /admin routes.
 */
export function cacheControl(seconds: number) {
  return createMiddleware<AppEnv>(async (c, next) => {
    await next();
    if (c.res.status === 200) {
      c.header("Cache-Control", `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    }
  });
}
