// Server-side input checks. The dashboard is trusted, but a stolen session or
// a buggy client must not be able to store values that later become a
// `javascript:` link, a broken query binding or an unbounded blob.

export class HttpError extends Error {
  constructor(
    public status: 400 | 403 | 404 | 409 | 413 | 429,
    message: string,
  ) {
    super(message);
  }
}

export const EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{1,63}$/;

/** http(s) URLs and same-site absolute paths only. Returns null for empty. */
export function safeUrl(value: unknown, field = "URL"): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || value.length > 2048) throw new HttpError(400, `${field} is not valid.`);
  const trimmed = value.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.includes("\\")) return trimmed;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new HttpError(400, `${field} is not valid.`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new HttpError(400, `${field} must start with https:// or http://.`);
  }
  return trimmed;
}

export type Rule = "url" | "bool" | "int" | "text" | "long" | "accent" | "date" | `enum:${string}`;

const LIMITS = { text: 2_000, long: 500_000 } as const;

/** Validates and normalises a patch against a per-field rule map. Unknown fields are never copied. */
export function cleanFields(input: Record<string, unknown>, rules: Record<string, Rule>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, rule] of Object.entries(rules)) {
    if (!(field in input)) continue;
    const value = input[field];
    if (rule === "url") {
      out[field] = safeUrl(value, field);
    } else if (rule === "bool") {
      out[field] = value === true || value === 1 || value === "1" ? 1 : 0;
    } else if (rule === "int") {
      const n = Number(value);
      if (!Number.isFinite(n)) throw new HttpError(400, `${field} must be a number.`);
      out[field] = Math.trunc(n);
    } else if (rule === "accent") {
      if (value === "" || value === null) out[field] = "";
      else if (typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)) out[field] = value;
      else throw new HttpError(400, "Accent must be a 6-digit hex colour like #20294c.");
    } else if (rule === "date") {
      if (value === null || value === "") out[field] = null;
      else if (typeof value === "string" && !Number.isNaN(Date.parse(value))) out[field] = new Date(value).toISOString();
      else throw new HttpError(400, `${field} is not a valid date.`);
    } else if (rule.startsWith("enum:")) {
      const allowed = rule.slice(5).split(",");
      if (typeof value !== "string" || !allowed.includes(value)) throw new HttpError(400, `${field} is not valid.`);
      out[field] = value;
    } else {
      const max = rule === "long" ? LIMITS.long : LIMITS.text;
      if (value === null || value === undefined) out[field] = null;
      else if (typeof value !== "string" || value.length > max) throw new HttpError(400, `${field} is too long or not text.`);
      else out[field] = value;
    }
  }
  return out;
}

export async function readJson<T>(c: { req: { json: <U>() => Promise<U> } }): Promise<T> {
  try {
    const body = await c.req.json<T>();
    if (body === null || typeof body !== "object") throw new Error("not an object");
    return body;
  } catch {
    throw new HttpError(400, "Send a JSON body.");
  }
}

/** Compares two strings without leaking where they differ. */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const x = new Uint8Array(da);
  const y = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i]! ^ y[i]!;
  return diff === 0;
}
