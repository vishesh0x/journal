import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../types";
import { HttpError } from "../lib/validate";
import { getFlags } from "../lib/flags";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Rejects cross-site writes. SameSite=Lax already blocks the cookie; this closes the gap for odd clients. */
export const sameOriginWrites = createMiddleware<AppEnv>(async (c, next) => {
  if (MUTATING.has(c.req.method)) {
    const origin = c.req.header("Origin");
    const fetchSite = c.req.header("Sec-Fetch-Site");
    if (fetchSite === "cross-site") throw new HttpError(403, "Cross-site requests are not allowed.");
    if (origin && origin !== new URL(c.req.url).origin) throw new HttpError(403, "Cross-site requests are not allowed.");
  }
  await next();
});

export const securityHeaders = createMiddleware<AppEnv>(async (c, next) => {
  await next();
  const path = new URL(c.req.url).pathname;
  const isApi = path.startsWith("/api/");
  const wantsHtml = (c.req.header("Accept") ?? "").includes("text/html");

  // Scripts are locked to this origin unless the owner saved an analytics snippet in Settings.
  // Cloudflare Web Analytics, when enabled on the zone, injects its own beacon; allow exactly that host.
  let scriptSrc = "script-src 'self' https://static.cloudflareinsights.com";
  let connectSrc = "connect-src 'self' https://cloudflareinsights.com";
  if (!isApi && wantsHtml && (await getFlags(c.env.DB)).analytics) {
    scriptSrc = "script-src 'self' 'unsafe-inline' https:";
    connectSrc = "connect-src 'self' https:";
  }

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Strict-Transport-Security", "max-age=31536000");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()");
  if (!c.res.headers.has("Content-Security-Policy")) {
    c.header(
      "Content-Security-Policy",
      [
        "default-src 'self'",
        scriptSrc,
        "style-src 'self' 'unsafe-inline'",
        "font-src 'self'",
        "img-src 'self' data: https:",
        connectSrc,
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
        "upgrade-insecure-requests",
      ].join("; "),
    );
  }
  // Anything an owner-only or session-aware route returns must never sit in a shared cache.
  if (isApi && !c.res.headers.has("Cache-Control")) c.header("Cache-Control", "no-store");
  // API data is for this site only. Images stay embeddable elsewhere (feed readers, social cards).
  if (isApi && !path.startsWith("/api/media/")) c.header("Cross-Origin-Resource-Policy", "same-origin");
});
