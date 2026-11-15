import { Hono } from "hono";
import type { AppEnv } from "./types";
import { attachSession } from "./middleware/auth";

import authRoutes from "./routes/auth";
import postsRoutes from "./routes/posts";
import tagsRoutes from "./routes/tags";
import pagesRoutes from "./routes/pages";
import settingsRoutes from "./routes/settings";
import subscribersRoutes from "./routes/subscribers";
import overviewRoutes from "./routes/overview";
import mediaRoutes from "./routes/media";
import feedRoutes from "./routes/feed";

const app = new Hono<AppEnv>();

app.use("*", attachSession);

// Forces every query in this request to read from D1's primary instance
// instead of a possibly-lagging read replica. Without this, editing/
// publishing content and then immediately loading a page that reads it
// back (the dashboard's own "Save" -> homepage check, or a visitor
// browsing right after a publish) can race D1's replication and see
// stale/missing data — which looks exactly like "it disappeared until I
// saved again" or "until I unpublished and republished". A blog's D1
// traffic is low enough that always hitting the primary has no
// meaningful cost.
app.use("*", async (c, next) => {
  if (typeof c.env.DB.withSession === "function") {
    c.env.DB = c.env.DB.withSession("first-primary") as unknown as D1Database;
  }
  await next();
});

app.use("*", async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'", // needed for the admin-configurable analytics snippet
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
});

app.route("/api/auth", authRoutes);
app.route("/api/posts", postsRoutes);
app.route("/api/tags", tagsRoutes);
app.route("/api/pages", pagesRoutes);
app.route("/api/settings", settingsRoutes);
app.route("/api/subscribers", subscribersRoutes);
app.route("/api/overview", overviewRoutes);
app.route("/api/media", mediaRoutes);
app.route("/", feedRoutes); // exposes /rss.xml and /sitemap.xml at the site root

app.notFound((c) => {
  const path = new URL(c.req.url).pathname;
  // Real API 404s stay JSON; anything else (a client-side route like
  // /posts/hello-world hit on a hard refresh) falls through to the
  // static-assets binding, which serves index.html per
  // `not_found_handling: "single-page-application"` in wrangler.jsonc.
  if (path.startsWith("/api/")) return c.json({ error: "Not found" }, 404);
  return c.env.ASSETS.fetch(c.req.raw);
});
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal server error" }, 500);
});

export default app;
