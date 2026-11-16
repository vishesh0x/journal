import { checkSvg } from "./svg";

export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export type Inspected = { ok: true; type: string; ext: string; payload: ArrayBuffer | string } | { ok: false; error: string };

// The browser-declared type is never trusted: the file's own first bytes decide what it is.
function sniff(bytes: Uint8Array): { type: string; ext: string } | null {
  const at = (i: number, text: string) => text.split("").every((ch, k) => bytes[i + k] === ch.charCodeAt(0));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (bytes[0] === 0x89 && at(1, "PNG\r\n")) return { type: "image/png", ext: "png" };
  if (at(0, "GIF87a") || at(0, "GIF89a")) return { type: "image/gif", ext: "gif" };
  if (at(0, "RIFF") && at(8, "WEBP")) return { type: "image/webp", ext: "webp" };
  if (at(4, "ftyp") && (at(8, "avif") || at(8, "avis"))) return { type: "image/avif", ext: "avif" };
  return null;
}

/** Raster images by signature, or a plain SVG that passes the allowlist. Anything else is refused. */
export function inspectImage(buffer: ArrayBuffer): Inspected {
  if (buffer.byteLength > MAX_IMAGE_BYTES) return { ok: false, error: "File is too large (15MB max)." };
  const raster = sniff(new Uint8Array(buffer.slice(0, 16)));
  if (raster) return { ok: true, ...raster, payload: buffer };
  const svg = checkSvg(new Uint8Array(buffer));
  if (svg.ok) return { ok: true, type: "image/svg+xml", ext: "svg", payload: svg.text };
  if (/^\s*(<\?xml|<svg|<!doctype|\uFEFF)/i.test(new TextDecoder().decode(buffer.slice(0, 64)))) return { ok: false, error: svg.reason };
  return { ok: false, error: "Only JPEG, PNG, WebP, GIF, AVIF or SVG images are allowed." };
}
