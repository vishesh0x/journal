# Journal

A personal journal and blog that runs entirely on Cloudflare. A React single-page app is served as static assets by one Worker. The same Worker hosts the API (Hono), with D1 (SQLite) for data and R2 for images.

There is one owner, one dashboard and no server to look after.

## What you get

**For readers**

- A home page with a pinned or latest post, an index of the rest, and pagination
- Post pages with a table of contents, topics, reading time, a cover image and "keep reading"
- Archive by year, topic pages, search, an About page, Privacy and Terms, and your own pages
- Light and dark themes, and a newsletter sign-up with one-click unsubscribe
- RSS (`/rss.xml`), a sitemap (`/sitemap.xml`) and `/llms.txt`

**For you (dashboard at `/dashboard`)**

- **Posts:** a Markdown editor with a toolbar, a live preview that matches the public page, publish dates (a future date schedules the post), pinning, search and sharing details, Ctrl/Cmd+S to save, and a warning before you leave with unsaved edits
- **Images:** a library with upload, copy address, delete and "where is this used". Every image field lets you choose an existing image or upload a new one
- **Pages**, **Topics**, **Subscribers** (with CSV export) and **Settings**
- **Backup and restore:** one zip with everything (see below)

**Writing features**

- Syntax-highlighted code, with Paper Mono's real ligatures (`==`, `!=`, `=>`, `>=`) and a slashed zero
- Mermaid diagrams in fenced blocks tagged `mermaid`, drawn only when they are about to be seen
- Tables and task lists (GitHub-flavoured Markdown)
- Images from uploads, including SVG (see Security)

## Stack

| Layer | Choice |
| --- | --- |
| Frontend | React 19, Vite, React Router, TanStack Query, Tailwind CSS 4 |
| API | Hono on a single Cloudflare Worker |
| Data | Cloudflare D1 (SQLite) |
| Media | Cloudflare R2 |
| Auth | PBKDF2 password hash, signed JWT in an HttpOnly cookie |
| Markdown | unified, remark and rehype, sanitised before display |
| Diagrams and icons | Mermaid, lucide-react |
| Zip | fflate, in the browser |
| Font | Paper Mono, self-hosted (SIL Open Font License 1.1, in `public/fonts`) |

## Quick start (local)

You need Node 20 or newer. A Cloudflare account is only needed when you deploy.

```bash
npm install

# 1. a secret for signing sessions, local only (this file is git-ignored)
echo 'SESSION_SECRET=use-any-long-random-string' > .dev.vars

# 2. create the local database tables
npm run db:migrate:local

# 3. build once so the Worker has assets to serve
npm run build

# 4. in one terminal: the API and Worker
npm run dev:worker        # http://localhost:8787

# 5. in another: the frontend with hot reload (proxies /api to the Worker)
npm run dev               # http://localhost:5173
```

Open http://localhost:5173/auth and create the owner account. That form only works once, while no user exists.

## Deploy

1. **Create the database and bucket**

   ```bash
   npx wrangler d1 create journal_db
   npx wrangler r2 bucket create journal-media
   ```

   Put the `database_id` from the first command into `wrangler.jsonc`.

2. **Apply the migrations**

   ```bash
   npm run db:migrate:remote
   ```

3. **Set the secrets**

   ```bash
   npx wrangler secret put SESSION_SECRET     # required: any long random string
   npx wrangler secret put SETUP_TOKEN        # recommended, see step 5
   ```

4. **Build and deploy**

   ```bash
   npm run deploy
   ```

5. **Create your account straight away.** Open `/auth`. Until the first account exists, anyone who finds the page could claim the site. If you set `SETUP_TOKEN`, creating the first account also asks for that code, so only you can.

6. **Optional, recommended:** attach your own domain to the Worker, and turn on Cloudflare Image Transformations for it (see Images).

### Updating later

Pull the new code, run `npm install`, run `npm run db:migrate:remote` if `migrations/` has new files, then `npm run deploy`.

## Configuration

**`wrangler.jsonc`**

| Key | Purpose |
| --- | --- |
| `d1_databases`, `r2_buckets` | The database and bucket bindings (`DB`, `MEDIA`) |
| `vars.PUBLIC_MEDIA_BASE_URL` | Leave empty to serve images through the Worker at `/api/media/:key`. Set it only after connecting a custom domain to the R2 bucket |
| `preview_urls` | Set to `false`, so Cloudflare does not publish a public URL for every uploaded version |
| `compatibility_date` | The runtime version the Worker is built against |

**Secrets**

| Name | Required | Purpose |
| --- | --- | --- |
| `SESSION_SECRET` | Yes | Signs login cookies. Changing it signs everyone out |
| `SETUP_TOKEN` | No | When set, creating the first account requires this code |

**Settings page (stored in the database)**

Site name, tagline, description, logo, favicon, default theme, posts per page, footer text, your name, bio and portrait, the About page, social links, newsletter text, default search and share details, an optional analytics snippet, and the Cloudflare image resizing switch.

## Images

Uploads accept JPEG, PNG, WebP, GIF, AVIF and SVG up to 15 MB. Files are stored in R2 under random names, and the original file name is kept for the library.

**Cloudflare image resizing** (Settings, Identity) serves covers, the logo, the favicon, the portrait, images inside posts and the dashboard thumbnails resized, and as AVIF or WebP. Turn it on only after enabling Image Transformations for your domain in the Cloudflare dashboard, which needs a custom domain. If images break after turning it on, turn it off again.

With a logo set, the top bar shows the logo alone on small screens, so a long site name never gets cut off.

## Backup and restore

Settings, last section.

- **Export** downloads one zip: `manifest.json`, `data.json` (settings, topics, posts, the links between them, pages, subscribers), `media-index.json` and every image under `media/`. Admin accounts and password hashes are never included. Your password is asked again, because the file contains subscriber emails. Keep it private.
- **Restore** reads the zip in your browser and shows what is inside. It needs a confirmation and your password, downloads a safety copy of the current site first (on by default), uploads the images (existing images are never deleted), then replaces posts, pages, topics, subscribers and settings. Posts are assigned to the current owner.
- The server validates the whole backup before changing anything, so a bad file changes nothing.
- The zip is built in your browser's memory. Very large libraries (several hundred MB) are better handled on a desktop browser.

## Security

- **Sessions:** cookie `__Host-journal_session` (HttpOnly, Secure, SameSite=Lax), valid 7 days. Signing out revokes every session token.
- **Sign-in limits:** 8 tries per email and 20 per IP every 15 minutes. Wrong guesses can briefly lock the owner out; it clears after 15 minutes.
- **Same-origin writes:** requests that change data from another origin are rejected.
- **Headers:** a strict Content Security Policy (scripts from this site only, plus Cloudflare Web Analytics), HSTS, frame blocking, `nosniff`, and Referrer and Permissions policies. The policy relaxes for scripts only while an analytics snippet is saved in Settings.
- **Validation:** settings, posts, pages and tags are validated on the server (URLs must be http or https, text has length limits).
- **Uploads:** checked by content, not by declared type. SVG files must pass an allowlist (no scripts, event handlers, external references, DOCTYPE or entities), are shown only through `<img>`, and are served with a sandboxing policy.
- **Backups:** need your password, and every restored row is rebuilt from known columns and re-validated.
- **Markdown:** sanitised before it is shown. Mermaid runs in its strict mode.
- **Password hashing:** PBKDF2-SHA256, capped at 100,000 iterations by the Workers runtime.
- **Dependencies:** `npm audit` was clean at the last check, and nothing deprecated is installed.

## Performance notes

- Public pages are code-split, and the sign-in checks run only on dashboard routes.
- The home page and post pages get a preload hint for the cover image from the Worker, using the same sizes the page will request.
- The Worker caches two settings and the cover lookup for 60 seconds, so a change in Settings can take up to a minute to reach the page headers and preload hint.
- Mermaid loads only on posts with a diagram, and only when a diagram is near the screen.
- The page stylesheet is inlined into the HTML.

## Design system

The look comes from three references (a monochrome broadsheet, a navy-on-fog fintech page and an outlined-tile bento grid), built with Hallmark's rules.

- `src/tokens.css` holds every colour, size, radius and spacing value, for light and dark. Nothing below it uses a hard-coded colour.
- `src/styles.css` holds the Hallmark stamp, the recorded waivers and the component classes (`.tile`, `.btn`, `.chip`, `.field`, `.row-2`, `.prose-journal`, `.panel`, and so on).
- Paper Mono is used for body text, interface, code and headlines. There is no accent colour setting: colour comes from the tokens.

## Project layout

```text
worker/
  index.ts              entry point: security headers, route wiring, llms.txt, cover preload
  routes/               auth, posts, tags, pages, settings, subscribers, media, backup, overview, feed
  middleware/           auth (session check), security (headers, same-origin), cache
  lib/                  password, validate, throttle, svg and image checks, flags, content helpers
  db/schema.ts          typed reference of the tables (migrations are plain SQL)
migrations/             SQL files applied by wrangler, in order
src/
  pages/                public pages; pages/dashboard holds the dashboard screens
  components/           shells, post cards, media picker, backup section, form pieces
  lib/                  API client, auth, markdown pipeline, image helpers, backup (zip) logic
  tokens.css, base.css, styles.css
public/                 favicon, robots.txt, Paper Mono and its licence
wrangler.jsonc          Worker, bindings and settings
```

## Routes

**Pages:** `/`, `/posts/:slug`, `/archive`, `/search`, `/tags/:slug`, `/about`, `/privacy`, `/terms`, `/p/:slug`, `/unsubscribe`, `/auth`, and `/dashboard` with its screens (posts, pages, images, topics, subscribers, settings).

**Machine-readable:** `/rss.xml`, `/sitemap.xml`, `/llms.txt`, `/robots.txt`. Unknown files return a real 404.

**API (`/api/...`):** `auth`, `posts`, `tags`, `pages`, `settings`, `subscribers`, `overview`, `media`, `backup`. Everything under an `admin` path, plus uploads, backup and the overview, needs the owner's session.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reload |
| `npm run dev:worker` | Local Worker with a local D1 and R2 |
| `npm run build` | Production build into `dist/` |
| `npm run typecheck` | TypeScript check of the frontend |
| `npm run deploy` | Build and deploy with Wrangler |
| `npm run db:migrate:local` | Apply migrations to the local database |
| `npm run db:migrate:remote` | Apply migrations to the live database |

To type-check the Worker too, run `npx tsc --noEmit -p tsconfig.worker.json`.

## Troubleshooting

- **Images are broken after turning on resizing.** Turn the switch off in Settings. The zone needs Image Transformations enabled and a custom domain.
- **Images are broken after setting `PUBLIC_MEDIA_BASE_URL`.** That domain must really be connected to the R2 bucket. Empty it to go back to `/api/media/:key`.
- **Locked out after wrong passwords.** Wait 15 minutes.
- **Signed out after a deploy.** Expected after a migration that changes sessions, or if `SESSION_SECRET` changed.
- **A settings change is slow to show.** Headers and the cover preload hint are cached for up to 60 seconds.
- **Local sign-in fails with a 500.** `.dev.vars` is missing or has no `SESSION_SECRET`. Restart `npm run dev:worker` after creating it.

## Licence notes

Paper Mono is licensed under the SIL Open Font License 1.1 by The Paper-Mono Project Authors. The licence text is at `public/fonts/PaperMono-OFL.txt`.
