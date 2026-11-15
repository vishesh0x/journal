import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const siteSettings = sqliteTable("site_settings", {
  id: text("id").primaryKey().default("main"),
  siteName: text("site_name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  authorName: text("author_name").notNull(),
  authorBio: text("author_bio").notNull(),
  authorAvatarUrl: text("author_avatar_url"),
  faviconUrl: text("favicon_url"),
  logoUrl: text("logo_url"),
  accent: text("accent").notNull(),
  themeMode: text("theme_mode").notNull(),
  aboutMarkdown: text("about_markdown").notNull(),
  footerText: text("footer_text").notNull(),
  socialLinks: text("social_links").notNull(), // JSON string
  defaultMetaTitle: text("default_meta_title"),
  defaultMetaDescription: text("default_meta_description"),
  defaultOgImage: text("default_og_image"),
  postsPerPage: integer("posts_per_page").notNull(),
  newsletterEnabled: integer("newsletter_enabled", { mode: "boolean" }).notNull(),
  newsletterHeadline: text("newsletter_headline").notNull(),
  newsletterBlurb: text("newsletter_blurb").notNull(),
  analyticsScript: text("analytics_script"),
  updatedAt: text("updated_at").notNull(),
});

export const tags = sqliteTable("tags", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
});

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  authorId: text("author_id").notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  subtitle: text("subtitle"),
  excerpt: text("excerpt"),
  contentMd: text("content_md").notNull(),
  coverUrl: text("cover_url"),
  status: text("status").notNull(), // 'draft' | 'published'
  publishedAt: text("published_at"),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  readingMinutes: integer("reading_minutes").notNull().default(1),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  ogImage: text("og_image"),
  canonicalUrl: text("canonical_url"),
  noindex: integer("noindex", { mode: "boolean" }).notNull().default(false),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const postTags = sqliteTable("post_tags", {
  postId: text("post_id").notNull(),
  tagId: text("tag_id").notNull(),
});

export const subscribers = sqliteTable("subscribers", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  status: text("status").notNull(),
  token: text("token").notNull(),
  source: text("source"),
  createdAt: text("created_at").notNull(),
  unsubscribedAt: text("unsubscribed_at"),
});

export const pages = sqliteTable("pages", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  eyebrow: text("eyebrow"),
  contentMd: text("content_md").notNull(),
  status: text("status").notNull(),
  systemKey: text("system_key"),
  showInFooter: integer("show_in_footer", { mode: "boolean" }).notNull().default(false),
  showInNav: integer("show_in_nav", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  noindex: integer("noindex", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
