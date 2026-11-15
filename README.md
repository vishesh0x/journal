# Journal — Cloudflare edition

A personal blogging platform rebuilt to run entirely on Cloudflare's
serverless stack: **Vite + React** (SPA) served as static assets by a
**Worker**, a **Hono** API, **D1** (SQLite) for data, and **R2** for media.

## Stack

| Layer      | Choice                          | Why |
|------------|----------------------------------|-----|
| Frontend   | React + Vite (client-side SPA)  | Ships as static assets; no SSR runtime needed |
| Routing    | react-router-dom (client-side)  | Simple, framework-agnostic |
| API        | Hono, on a single Worker         | Express doesn't run on Workers — no Node `http`/`net`. Hono is edge-native and has similar middleware ergonomics |
| Database   | Cloudflare D1 (SQLite)           | Replaces Postgres (Workers can't hold raw TCP connections) |
| Storage    | Cloudflare R2                    | Replaces Supabase Storage |
| Auth       | Custom, PBKDF2 + signed JWT cookie | bcrypt/native crypto doesn't run on Workers; Web Crypto (`crypto.subtle`) does |
| Styling    | Tailwind v4 + your existing shadcn/ui components | Pure client-side, unaffected by the backend migration |

## Local development

```bash
npm install

# one-time: create local D1 tables
npm run db:migrate:local

# terminal 1 — the API worker
npm run dev:worker      # wrangler dev, http://localhost:8787

# terminal 2 — the frontend (proxies /api to :8787, see vite.config.ts)
npm run dev              # http://localhost:5173
```

Open http://localhost:5173. The first visit to `/auth` lets you create the
owner account (bootstrap flow — only works once, before any user exists).

## Deploying

1. **Create the D1 database and R2 bucket:**
   ```bash
   npx wrangler d1 create journal_db
   npx wrangler r2 bucket create journal-media
   ```
   Copy the `database_id` from the first command into `wrangler.jsonc`.

2. **Apply migrations to the remote database:**
   ```bash
   npm run db:migrate:remote
   ```

3. **Set the session secret** (used to sign login cookies):
   ```bash
   npx wrangler secret put SESSION_SECRET
   ```

4. **(Recommended) Give R2 a public/custom domain** so images load directly
   from R2 instead of being proxied through the Worker: Cloudflare dashboard
   → R2 → `journal-media` → Settings → connect a custom domain (e.g.
   `media.yourdomain.com`), then set that as `PUBLIC_MEDIA_BASE_URL` in
   `wrangler.jsonc`. Until you do this, uploads still work — they're just
   served via a `/api/media/:key` Worker route, which is fine for low
   traffic but skips R2's CDN caching.

5. **Build and deploy:**
   ```bash
   npm run deploy
   ```

## Project layout

```
worker/            Hono API (the Cloudflare Worker)
  index.ts         entry point / route wiring
  routes/          auth, posts, tags, pages, settings, subscribers, media, feed
  middleware/auth.ts  session cookie verification
  lib/             password hashing, slugs, excerpts
  db/schema.ts     Drizzle schema (reference/typing; migrations are hand-written SQL)
migrations/        D1 SQL migrations (wrangler d1 migrations apply)
src/               the React SPA
  pages/           public site pages
  pages/dashboard/ admin dashboard pages
  components/      shared UI (site shell, post card, editor fields, shadcn/ui)
wrangler.jsonc     Worker + assets + D1 + R2 bindings
```

## Issues found while converting (informational — not fixed beyond what's noted)

1. **`pages` table was referenced everywhere in the original app's server
   functions but never created by any migration.** It would have 500'd in
   production. Added it here with an `about`/`privacy`/`terms` seed.
2. **Express is incompatible with the Workers runtime** (no Node
   `http.Server`/`net` sockets). This rewrite uses Hono instead.
3. **The `postgres` npm client can't run on Workers** (needs raw TCP).
   Replaced with D1, which required converting `uuid`/`timestamptz`/`jsonb`/
   enum columns to `text`/`integer`, and moving all access control out of
   Postgres RLS into Worker middleware (D1 has no RLS).
4. **bcrypt/argon2 native bindings don't run on Workers.** Replaced with
   PBKDF2 via the Web Crypto API, which is natively supported.
5. **Supabase Storage → R2**, with a same-origin Worker route as a fallback
   for serving images until you attach a custom domain to the bucket.
6. **TanStack Start's SSR (Nitro/h3) was dropped** in favor of a plain
   client-rendered SPA, since Workers static-assets + a small API Worker is
   simpler to reason about and deploy than porting a Node SSR framework.
   RSS/sitemap are generated dynamically by the Worker instead of at
   render/build time, so they still update automatically as you publish.
7. Session state is a **stateless signed JWT cookie**, not a server-side
   session table — simpler for a single-admin blog, but it means there's no
   way to revoke a session before it expires (30 days) short of rotating
   `SESSION_SECRET` (which logs out everyone).
8. The initial Vite bundle is ~550KB (166KB gzipped) — fine for a personal
   blog, but if it grows, split the dashboard routes out with
   `React.lazy()` so visitors to the public site don't download admin code.
9. **The frontend's visual design was rebuilt to match the original
   Lovable-generated app** (editorial/magazine style: bold display
   headings, uppercase tracking-wide labels, grayscale-hover cover images,
   a featured-post hero, table-of-contents sidebar on posts, a markdown
   editor with a formatting toolbar + live preview + Google/social share
   previews). The original app doesn't use shadcn/ui anywhere in its actual
   pages despite bundling the whole library, so this rewrite drops shadcn/
   radix entirely and hand-styles with Tailwind instead — smaller bundle,
   closer visual match. Responsiveness (mobile nav, wrapping dashboard
   sidebar) was added on top, since the original didn't handle small
   screens.
10. While matching the design, found that the `pages` table seed data
    shouldn't include an "about" row — `/about` is a dedicated route driven
    by `site_settings.about_markdown`, not a pages-table entry, and the
    site shell already links to it directly. An earlier version of this
    migration seeded one anyway, which caused "About" to appear twice in
    the footer; fixed in `migrations/0000_init.sql`.
11. **Local dev needs a `SESSION_SECRET`.** Added `.dev.vars` (gitignored,
    auto-loaded by `wrangler dev`, no `--var` flags needed) with a
    placeholder value. Production still uses `wrangler secret put
    SESSION_SECRET` as described above — that's unrelated to `.dev.vars`
    and won't be overwritten by it.
12. **Full audit pass** — went through the whole project for bugs and
    - Heading scale was inconsistent across pages (some jumped straight to
      `sm:text-7xl` with no `lg` step, Home and post titles used a
      different scale than Archive/TagDetail/About/404, StaticPage capped
      out smaller than its siblings). Normalized to two consistent scales:
      one for short titles, one for long-form text like post titles.
    - Dashboard border radius, button weight, and input padding were
      inconsistent between the two full-page editors (`PostEditor`,
      `PageEditor`, which used `rounded-xl`/`rounded-2xl`) and every other
      dashboard page (which used `rounded-md`/`rounded-lg`). Unified to one
      scale dashboard-wide. `PagesList` also had a heavier heading style
      than its sibling list pages (Posts/Tags/Subscribers/Settings) —
      normalized.
    - **Settings page was missing real functionality**, not just fields:
      accent colour was a text input against a DB default
      (`oklch(0.55 0.16 35)`) that a native color picker can't parse, so
      the swatch never worked. Now a real `<input type="color">` with a
      proper hex default (`#c4633c`).
      "Default theme" (light/dark/system) existed in the database and was
      fully wired on the backend but had no UI anywhere, and the theme
      toggle never consulted it even when set — added the selector and
      wired it into `ThemeToggle` as the visitor's default (their own
      toggle choice still always wins).
      Social links switched from a freeform list to the fixed platform set
      the design actually uses (twitter, github, linkedin, instagram,
      mastodon, website, email), stored as an object instead of an array,
      with the footer updated to match.
      The entire "Search & sharing" section (default meta title/
      description/share image, analytics snippet) was missing from the UI
      even though the backend already supported all of it. Added the
      section, and — since these fields were stored but never actually
      consulted anywhere — wired default meta title/description/image into
      Home, and `meta_title`/`meta_description` into post pages, the About
      page, and static pages (Privacy/Terms/custom) via a shared
      `useDocumentMeta` hook. The analytics snippet now actually injects
      into `<head>` when set.
13. **Stale media URLs from an earlier default.** An earlier version of
    `wrangler.jsonc` shipped with `PUBLIC_MEDIA_BASE_URL` set to a
    placeholder (`https://media.yourdomain.com`) instead of an empty
    default. Any image uploaded while that placeholder was active got that
    fake, unreachable domain permanently baked into the database as an
    absolute URL — fixing the config afterward doesn't retroactively heal
    already-stored data. Added `migrations/0001_fix_stale_media_urls.sql`,
    a one-time repair that rewrites every occurrence back to the working
    same-origin path across `posts.cover_url`, `posts.og_image`,
    `posts.content_md` (inline Markdown image references), `pages.content_md`,
    and every image field in `site_settings`. Run it the same way as any
    other migration (`npm run db:migrate:local` / `db:migrate:remote`) — it's
    safe to run even if you were never affected, since it only touches rows
    that actually contain the placeholder domain.
14. **Post content could scroll horizontally on narrow screens.** Hardened
    `.prose-journal` (the rendered Markdown) with a blanket
    `max-width: 100%` on every descendant plus `overflow-wrap: anywhere`,
    and fixed `<table>` specifically — tables ignore `overflow-x`/`max-width`
    in their default display mode, so wide tables now scroll within their
    own box (`display: block; overflow-x: auto`) instead of pushing the
    whole page wider.
15. **Mobile table of contents was a cramped wrapped list.** Replaced it
    with a collapsible `<details>` disclosure below the `lg` breakpoint
    (closed by default, tap "Contents" to expand), keeping the sticky
    sidebar version for desktop.
16. **Images had no alt text.** Post covers, the homepage's featured
    image, and the author avatar now use meaningful alt text (post title /
    author name). More importantly, images inserted into post content via
    the editor's upload button, drag-drop, or paste now get real alt text
    automatically, derived from the filename — inserted right into the
    Markdown (`![Alt text](url)`) so it's trivially editable afterward.
17. **The post editor's live preview made writing cramped.** The
    write/preview split was always on, permanently halving the width
    available for actual writing. Added a "Show preview" / "Hide preview"
    toggle, off by default — the textarea now gets full width (and more
    height) for focused writing, with the preview available on demand.
18. **The real cause of "edits/publishes don't show up until a retry."**
    This affected both posts and pages, and wasn't a caching or logic bug
    in this app — Cloudflare D1 replicates to multiple read replicas, and
    a write followed immediately by a read can land on a replica that
    hasn't caught up yet. That exactly matches "works after a second save
    or after unpublish/republish" (the retry just gives replication time
    to catch up). Fixed by adopting D1's Sessions API
    (`withSession("first-primary")`) in `worker/index.ts`, which forces
    every request to read from the primary instance, guaranteeing you see
    your own writes immediately. Note: this API is declared in Cloudflare's
    published types but isn't implemented by the local `wrangler dev` D1
    emulator yet, so the middleware feature-detects it
    (`typeof c.env.DB.withSession === "function"`) and only applies it
    where it's actually available — it's a no-op locally and active on
    real Cloudflare deployments.
19. **Critical: D1/R2 binding names must match exactly.** If you let the
    `wrangler d1 create` / `wrangler r2 bucket create` CLI prompts
    auto-add bindings to `wrangler.jsonc` for you, it suggests binding
    names based on the resource name (e.g. `journal_db`), not the names
    this code expects (`DB`, `MEDIA`). If those don't match, every
    database/storage call in the Worker silently fails — which, combined
    with (20) below, used to show as an endless "Loading…" on the
    homepage with no visible error. Make sure `wrangler.jsonc` has
    exactly `"binding": "DB"` under `d1_databases` and
    `"binding": "MEDIA"` under `r2_buckets`, regardless of what the CLI
    prompt suggested.
20. **Pages had no error state — a failed fetch just spun forever.**
    Home, Archive, Tag, and About pages never checked for query errors,
    so any API failure (including the binding-name mismatch above) looked
    exactly like an infinite loading spinner with no indication anything
    was wrong. Added a shared error state with a retry button across all
    of them.
21. **Registration accepted any string as an "email."** Added format
    validation, matching the newsletter signup form's existing check.
22. **A near-simultaneous duplicate registration threw an unhandled
    500.** Now caught and returned as a normal "already has an owner"
    message. (Note: the underlying TOCTOU race — two different emails
    registering in the same narrow window before either commits — is a
    known, separate issue and wasn't addressed here; register your own
    account immediately after deploying to close that window in practice.)
23. **Hardening pass**, several smaller issues found in a full security
    review:
    - Media uploads accepted any file type and served it back with the
      client-supplied content-type; now restricted to an image MIME
      allowlist (JPEG/PNG/WebP/GIF/AVIF — deliberately excluding SVG,
      which can embed scripts).
    - `page`/`perPage` query params on the post list weren't validated —
      a non-numeric value produced `NaN` and broke the query, and
      `perPage` had no upper bound. Now clamped and defaulted safely.
    - `posts_per_page` in Settings had no server-side range check (the
      1–50 limit you see was only an HTML hint). Now clamped on save too.
    - Creating a tag with an empty name crashed with a generic error
      instead of a validation message.
    - Post/page slugs went into RSS/sitemap XML unescaped — not
      exploitable today since slugs are always slugified first, but
      hardened defensively anyway.
    - Added baseline security headers (CSP, `X-Frame-Options: DENY`,
      `X-Content-Type-Options: nosniff`) to every response. Getting this
      to actually cover the homepage itself required also setting
      `run_worker_first: true` on the assets config — by default,
      requests that match a static file exactly (like `/`) are served by
      Cloudflare's assets layer *without ever invoking the Worker*, so
      Worker-level headers silently didn't apply to the page you'd
      actually load first.
24. **`noindex` and `canonical_url` were dead fields.** Both existed in
    the database and were fully editable in the Post/Page editors, but
    were never rendered anywhere — the checkbox saved, but had zero real
    effect. Wired `noindex` into an actual `<meta name="robots">` tag (and
    excluded noindex'd content from the sitemap, which previously listed
    it despite the contradiction), and `canonical_url` into a real
    `<link rel="canonical">` tag, via a shared `useDocumentMeta` hook.

## Performance pass

A broad "make it faster" request came with a long checklist. Several
items on that list don't actually apply to this architecture — documented
honestly below rather than faked:

- **"Add a CDN"** — nothing to add. Workers + Assets already serve from
  Cloudflare's global edge by default. The real, applicable version of
  this is making API responses cacheable at that edge layer — done, see
  below.
- **"Add a load balancer"** — doesn't apply. Workers auto-scale across
  Cloudflare's network; there's no single origin to balance load across.
- **"Database connection pooling"** — doesn't apply to D1. It's accessed
  per-request over Cloudflare's binding API, not a persistent TCP
  connection like traditional Postgres/MySQL. There's no pool.
- **"Run a Lighthouse audit"** — this environment has no headless
  browser, so one couldn't actually be run here. Run it yourself via
  Chrome DevTools or PageSpeed Insights against the live deployed URL.

What was actually implemented:

25. **Code splitting.** Every dashboard/editor route is now
    `React.lazy()`-loaded — public visitors no longer download any admin
    code. Confirmed in the build output: dashboard pages now build as
    separate chunks (`PostEditor-*.js`, `Settings-*.js`, etc.) instead of
    being bundled into the main JS file.
26. **Fixed two real N+1 query patterns.** Saving a post's tags did one
    sequential `INSERT` per tag; now batched into a single D1 round-trip
    via `db.batch()`. The dashboard overview stats did 5 separate
    round-trips; now 1 batched call, with published/draft counts
    collapsed into one conditional-aggregation query instead of two.
27. **Added the index that was actually missing**:
    `post_tags` only had an implicit index on `(post_id, tag_id)` via its
    composite primary key, which doesn't serve tag-first lookups — the
    exact query the public tag-filtered post list runs. Without it, that
    query was a full table scan. Added `post_tags_tag_id_idx`, plus two
    minor ones (`subscribers.status`, `pages.status`).
28. **Cache-Control headers on every public GET endpoint** (posts,
    post-by-slug, archive, search, tags, pages, settings, RSS, sitemap),
    via a reusable middleware — these now get cached at Cloudflare's edge.
    Admin routes are explicitly excluded. One honest tradeoff: the
    post-by-slug route also increments view count as a side effect of the
    GET, so caching it means view counts become approximate
    (undercounted during cache hits) — a normal tradeoff for a personal
    blog's traffic level.
29. **Image compression, keeping originals in R2 only.** Wired up
    Cloudflare's URL-based Image Resizing (`/cdn-cgi/image/...`), which
    transforms images from any same-origin source on the fly — nothing
    gets duplicated or migrated into Cloudflare Images' own storage.
    **Off by default** behind a Settings toggle ("Resize & compress
    images automatically"): Image Resizing needs to be enabled for your
    zone and generally requires a real custom domain rather than a bare
    `*.workers.dev` URL, so shipping it on by default risked 404-ing
    every image for accounts where it isn't available yet. Turn it on
    once you've confirmed it works.
30. **Lazy-loading images.** Straightforward for React-rendered images
    (`loading="lazy"`) — except the likely LCP candidates (post cover,
    homepage hero), which deliberately get `fetchPriority="high"`
    instead, since lazy-loading your own LCP element hurts load
    performance rather than helping it. Images embedded *inside* post
    content are a different case — they're raw HTML strings from the
    Markdown pipeline, not React elements, so `loading="lazy"` couldn't
    be added as a prop. Wrote a small custom rehype plugin instead.
31. **Debounced editor previews.** Both the post and page editors now
    debounce the Markdown re-parse by 200ms instead of re-parsing on
    every keystroke. The textarea itself still updates instantly — only
    the (more expensive) preview render is delayed.
32. **Loading skeletons** replace plain "Loading…" text on Home,
    PostDetail, StaticPage, and About.
33. **`React.memo`** on `PostCard`, which renders repeatedly across post
    lists and was re-rendering even when its own data hadn't changed.
34. **Paginated the one dashboard list that can actually grow large** —
    Subscribers, now 50 per page with page controls; CSV export still
    covers everyone regardless of page. Tags and Pages were deliberately
    left unpaginated: both are naturally small for any real blog (you
    don't create thousands of topics or static pages by hand), so paging
    them would add UI complexity for no real benefit.
35. **Removed unused dependencies**: audited every entry in
    `package.json` against actual imports — all of them were genuinely
    in use, nothing to remove. (The bundle was already trimmed
    significantly in an earlier pass when shadcn/radix were dropped.)

## New features

36. **Site search.** Was genuinely missing. Added a `/search` page and
    a search icon in the header (desktop and mobile) — searches post
    titles, excerpts, and body content via SQL `LIKE`, debounced 300ms as
    you type.
37. **View counts, now actually visible.** `view_count` was tracked in
    the database this whole time but never shown anywhere. Now displayed
    per-post in the dashboard's post list.
38. **Email address protected from scrapers, without hiding it from
    real visitors.** The public `/api/settings` response now serves your
    contact email reversed + base64-encoded, so a bot scraping the raw
    API or HTML for an `@...` pattern won't find one. The frontend
    decodes it back to a fully normal, clickable `mailto:` link for
    actual people — same "Email" link in the footer as before, just not
    harvestable from the raw response. This deters the cheapest and most
    common scraping method; it isn't cryptographic security, and a
    scraper specifically targeting this site's code could still reverse
    it — the same tradeoff every such"contact obfuscation" approach makes.
