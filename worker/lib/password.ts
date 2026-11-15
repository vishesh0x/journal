// bcrypt/argon2 native bindings don't run on Workers. PBKDF2 via the
// built-in Web Crypto API (crypto.subtle) is fully supported on the
// Workers runtime and needs no dependency.

const ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    256,
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await deriveBits(password, salt);
  return `pbkdf2:${ITERATIONS}:${toHex(salt)}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  // Workers cap PBKDF2 at 100,000 iterations; ignore any other stored count rather than trust it.
  if (Number(parts[1]) !== ITERATIONS || !/^[0-9a-f]+$/.test(parts[2]!) || parts[2]!.length % 2 !== 0) return false;
  const salt = fromHex(parts[2]!);
  const derived = await deriveBits(password, salt);
  const actual = toHex(derived);
  // constant-time-ish compare
  if (actual.length !== parts[3]!.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ parts[3]!.charCodeAt(i);
  return diff === 0;
}
