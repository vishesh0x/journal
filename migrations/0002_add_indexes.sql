-- post_tags only had an implicit index on (post_id, tag_id) via its
-- composite primary key, which serves post_id-first lookups (tag list for
-- a post) but not tag_id-first lookups (post list for a tag) — the exact
-- query the public tag-filtered post list runs. Without this, that query
-- does a full table scan.
CREATE INDEX post_tags_tag_id_idx ON post_tags (tag_id);

-- Small tables today, but cheap to add and used directly in WHERE clauses.
CREATE INDEX subscribers_status_idx ON subscribers (status);
CREATE INDEX pages_status_idx ON pages (status);
