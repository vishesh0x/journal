/**
 * Builds a Cloudflare-resized image URL via the /cdn-cgi/image/ path,
 * which transforms images from any same-origin source (including R2,
 * served here through /api/media/:key) on the fly — nothing is
 * duplicated or re-uploaded, the original stays in R2 as the only copy.
 *
 * Requires "Image Resizing" enabled for the zone this site is served
 * from (Cloudflare dashboard -> your domain -> Speed -> Optimization),
 * and generally requires a real custom domain rather than a bare
 * *.workers.dev subdomain. That's why this is opt-in via
 * settings.image_resizing_enabled (Settings > Identity) rather than
 * always-on — turning it on before it's actually available would 404
 * every image on the site.
 */
export function optimizedImageUrl(
  url: string | null | undefined,
  options: { width?: number; quality?: number } = {},
  enabled?: boolean | number,
): string | null {
  if (!url) return null;
  if (!enabled) return url;
  // Only same-origin relative paths (our own /api/media/... URLs) are
  // safe to route through /cdn-cgi/image/ this way — leave external URLs
  // (e.g. a custom PUBLIC_MEDIA_BASE_URL on another domain) untouched.
  if (!url.startsWith("/")) return url;
  if (/\.svg($|\?)/i.test(url)) return url;

  const { width = 1600, quality = 72 } = options;
  const params = [`width=${width}`, `quality=${quality}`, "format=auto"].join(",");
  return `/cdn-cgi/image/${params}${url}`;
}

export const COVER_WIDTHS = [480, 768, 1200, 1600];

/** A responsive srcset for resized images; undefined when the image can't be resized. Keep in sync with worker/lib/image.ts. */
export function imageSrcSet(url: string | null | undefined, enabled?: boolean | number): string | undefined {
  if (!url || !enabled || !url.startsWith("/") || /\.svg($|\?)/i.test(url)) return undefined;
  return COVER_WIDTHS.map((w) => `${optimizedImageUrl(url, { width: w }, true)} ${w}w`).join(", ");
}
