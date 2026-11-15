-- D1 (SQLite) schema for the journal blog.
-- Converted from the original Postgres/Supabase schema.
-- Notes:
--   * No row-level security here -- D1 has no RLS. All access control
--     happens in the Worker (see worker/middleware/auth.ts).
--   * uuid/timestamptz/jsonb/enum don't exist in SQLite -> text/integer.
--   * booleans are stored as integers (0/1).

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE site_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  site_name TEXT NOT NULL DEFAULT 'Journal',
  tagline TEXT NOT NULL DEFAULT 'Notes, essays and things I am figuring out.',
  description TEXT NOT NULL DEFAULT 'A personal journal.',
  author_name TEXT NOT NULL DEFAULT 'Author',
  author_bio TEXT NOT NULL DEFAULT '',
  author_avatar_url TEXT,
  favicon_url TEXT,
  logo_url TEXT,
  accent TEXT NOT NULL DEFAULT '#c4633c',
  theme_mode TEXT NOT NULL DEFAULT 'system',
  about_markdown TEXT NOT NULL DEFAULT '## About. Write something about yourself here.',
  footer_text TEXT NOT NULL DEFAULT '',
  social_links TEXT NOT NULL DEFAULT '{}',
  default_meta_title TEXT,
  default_meta_description TEXT,
  default_og_image TEXT,
  posts_per_page INTEGER NOT NULL DEFAULT 8,
  newsletter_enabled INTEGER NOT NULL DEFAULT 1,
  newsletter_headline TEXT NOT NULL DEFAULT 'Get new posts by email',
  newsletter_blurb TEXT NOT NULL DEFAULT 'No spam. Unsubscribe whenever you like.',
  analytics_script TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT INTO site_settings (id) VALUES ('main');

CREATE TABLE tags (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE posts (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  slug TEXT NOT NULL UNIQUE,
  subtitle TEXT,
  excerpt TEXT,
  content_md TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  published_at TEXT,
  featured INTEGER NOT NULL DEFAULT 0,
  reading_minutes INTEGER NOT NULL DEFAULT 1,
  meta_title TEXT,
  meta_description TEXT,
  og_image TEXT,
  canonical_url TEXT,
  noindex INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX posts_status_published_idx ON posts (status, published_at DESC);

CREATE TABLE post_tags (
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  token TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT
);

-- NOTE: this table is referenced everywhere in the original app's
-- admin/public server functions (pages.*, listSitePages, getPage, etc.)
-- but was NEVER created by its own Supabase migrations -- a latent bug
-- in the source project. It's added here so "static pages" (About,
-- Privacy, Terms, custom pages) actually work.
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Untitled page',
  subtitle TEXT,
  eyebrow TEXT,
  content_md TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  system_key TEXT,
  show_in_footer INTEGER NOT NULL DEFAULT 0,
  show_in_nav INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  meta_title TEXT,
  meta_description TEXT,
  noindex INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Note: there is deliberately no 'about' row here. /about is a dedicated
-- route rendered from site_settings.about_markdown (see pages/About.tsx),
-- not a pages-table entry, and site-shell.tsx already links to it directly.
INSERT INTO pages (id, slug, title, content_md, status, system_key, show_in_footer, sort_order) VALUES
  ('page_privacy', 'privacy', 'Privacy Policy', 'This site does not track you beyond basic hosting logs.', 'published', 'privacy', 1, 1),
  ('page_terms', 'terms', 'Terms', 'Standard stuff. Be nice.', 'published', 'terms', 1, 2);
