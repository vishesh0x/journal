// Mirrors src/lib/image.ts so the HTML preload hint requests exactly what the page will ask for.
const WIDTHS = [320, 480, 640, 768, 1024, 1280, 1600];

function resized(url: string, width: number): string {
  return `/cdn-cgi/image/width=${width},quality=65,format=auto${url}`;
}

const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** A <link rel="preload"> for the LCP image, or "" when there is nothing safe to preload. */
export function coverPreload(url: string | null | undefined, resizing: boolean, sizes: string, fallbackWidth: number): string {
  if (!url) return "";
  if (!url.startsWith("/") && !/^https:\/\//i.test(url)) return "";
  const canResize = resizing && url.startsWith("/") && !/\.svg($|\?)/i.test(url);
  const href = canResize ? resized(url, fallbackWidth) : url;
  const srcset = canResize ? WIDTHS.map((w) => `${resized(url, w)} ${w}w`).join(", ") : "";
  return `<link rel="preload" as="image" href="${esc(href)}"${
    srcset ? ` imagesrcset="${esc(srcset)}" imagesizes="${esc(sizes)}"` : ""
  } fetchpriority="high">`;
}
