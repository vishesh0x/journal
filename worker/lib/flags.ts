// Two settings the worker consults on every page load. They are cached in the isolate for a short
// time so a page view does not wait on a database round trip; a settings change shows up within a minute.
type Flags = { analytics: boolean; resizing: boolean };
const TTL_MS = 60_000;
let cached: { at: number; value: Flags } | null = null;

export async function getFlags(db: D1Database): Promise<Flags> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.value;
  try {
    const row = await db
      .prepare("SELECT length(trim(analytics_script)) AS a, image_resizing_enabled AS r FROM site_settings WHERE id = 'main'")
      .first<{ a: number | null; r: number | null }>();
    const value = { analytics: (row?.a ?? 0) > 0, resizing: Boolean(row?.r) };
    cached = { at: Date.now(), value };
    return value;
  } catch {
    return cached?.value ?? { analytics: false, resizing: false };
  }
}

const covers = new Map<string, { at: number; url: string | null }>();

export async function getCover(db: D1Database, key: string, sql: string, bind: unknown[]): Promise<string | null> {
  const hit = covers.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.url;
  const row = await db.prepare(sql).bind(...bind).first<{ cover_url: string | null }>();
  if (covers.size > 200) covers.clear();
  covers.set(key, { at: Date.now(), url: row?.cover_url ?? null });
  return row?.cover_url ?? null;
}
