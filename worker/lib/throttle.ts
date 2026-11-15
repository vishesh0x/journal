// Fixed-window rate limiting backed by D1 (no extra bindings needed).

export async function hit(
  db: D1Database,
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const next = now + windowSeconds;
  await db
    .prepare(
      `INSERT INTO rate_limits (key, count, reset_at) VALUES (?, 1, ?)
       ON CONFLICT(key) DO UPDATE SET
         count = CASE WHEN reset_at <= ? THEN 1 ELSE count + 1 END,
         reset_at = CASE WHEN reset_at <= ? THEN ? ELSE reset_at END`,
    )
    .bind(key, next, now, now, next)
    .run();
  const row = await db
    .prepare("SELECT count, reset_at FROM rate_limits WHERE key = ?")
    .bind(key)
    .first<{ count: number; reset_at: number }>();
  if (Math.random() < 0.02) await db.prepare("DELETE FROM rate_limits WHERE reset_at < ?").bind(now).run();
  const count = row?.count ?? 1;
  return { allowed: count <= limit, retryAfter: Math.max(1, (row?.reset_at ?? next) - now) };
}

export async function clear(db: D1Database, key: string): Promise<void> {
  await db.prepare("DELETE FROM rate_limits WHERE key = ?").bind(key).run();
}

export function clientIp(c: { req: { header: (name: string) => string | undefined } }): string {
  return c.req.header("CF-Connecting-IP") ?? "unknown";
}
