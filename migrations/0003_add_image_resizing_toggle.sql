-- Off by default: Cloudflare's URL-based Image Resizing
-- (/cdn-cgi/image/...) requires it to be enabled for your zone, and
-- typically requires a real custom domain rather than a bare
-- *.workers.dev subdomain. Shipping this on by default risked turning
-- every image on the site into a 404 for accounts where it isn't
-- available. The owner enables it from Settings once they've confirmed
-- it actually works for their deployment.
ALTER TABLE site_settings ADD COLUMN image_resizing_enabled INTEGER NOT NULL DEFAULT 0;
