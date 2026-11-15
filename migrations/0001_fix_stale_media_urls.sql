-- One-time repair: an earlier version of wrangler.jsonc shipped with a
-- placeholder PUBLIC_MEDIA_BASE_URL ("https://media.yourdomain.com")
-- instead of an empty default. Any image uploaded while that placeholder
-- was active got that fake domain baked into the database as an absolute
-- URL, which can never resolve. This rewrites every occurrence back to
-- the working same-origin path (/api/media/...), across every column
-- that can hold a stored image URL or reference one inline in Markdown.
--
-- Safe to run even if you were never affected — it only touches rows
-- that actually contain the placeholder domain.

UPDATE posts
SET cover_url = REPLACE(cover_url, 'https://media.yourdomain.com', '/api/media')
WHERE cover_url LIKE '%media.yourdomain.com%';

UPDATE posts
SET og_image = REPLACE(og_image, 'https://media.yourdomain.com', '/api/media')
WHERE og_image LIKE '%media.yourdomain.com%';

UPDATE posts
SET content_md = REPLACE(content_md, 'https://media.yourdomain.com', '/api/media')
WHERE content_md LIKE '%media.yourdomain.com%';

UPDATE pages
SET content_md = REPLACE(content_md, 'https://media.yourdomain.com', '/api/media')
WHERE content_md LIKE '%media.yourdomain.com%';

UPDATE site_settings
SET
  logo_url = CASE WHEN logo_url LIKE '%media.yourdomain.com%'
    THEN REPLACE(logo_url, 'https://media.yourdomain.com', '/api/media') ELSE logo_url END,
  favicon_url = CASE WHEN favicon_url LIKE '%media.yourdomain.com%'
    THEN REPLACE(favicon_url, 'https://media.yourdomain.com', '/api/media') ELSE favicon_url END,
  author_avatar_url = CASE WHEN author_avatar_url LIKE '%media.yourdomain.com%'
    THEN REPLACE(author_avatar_url, 'https://media.yourdomain.com', '/api/media') ELSE author_avatar_url END,
  default_og_image = CASE WHEN default_og_image LIKE '%media.yourdomain.com%'
    THEN REPLACE(default_og_image, 'https://media.yourdomain.com', '/api/media') ELSE default_og_image END
WHERE id = 'main';
