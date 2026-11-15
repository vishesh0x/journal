const JSON_HEADERS = { "Content-Type": "application/json" };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: { ...JSON_HEADERS, ...(options.headers ?? {}) },
    ...options,
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: async <T>(path: string, file: File): Promise<T> => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api${path}`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) throw new Error("Upload failed");
    return res.json() as Promise<T>;
  },
};

// ---- Shared types ----

export type Tag = { id: string; name: string; slug: string; description?: string | null };

export type PostSummary = {
  id: string;
  title: string;
  slug: string;
  subtitle?: string | null;
  excerpt?: string | null;
  cover_url?: string | null;
  published_at: string;
  reading_minutes: number;
  featured: boolean | number;
  tags: Tag[];
};

export type PostFull = PostSummary & {
  content_md: string;
  meta_title?: string | null;
  meta_description?: string | null;
  og_image?: string | null;
  canonical_url?: string | null;
  noindex?: boolean | number;
};

export const SOCIAL_PLATFORMS = ["twitter", "github", "linkedin", "instagram", "mastodon", "website", "email"] as const;
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

export type SiteSettings = {
  site_name: string;
  tagline: string;
  description: string;
  author_name: string;
  author_bio: string;
  author_avatar_url?: string | null;
  favicon_url?: string | null;
  logo_url?: string | null;
  theme_mode: "system" | "light" | "dark";
  image_resizing_enabled: boolean | number;
  about_markdown: string;
  footer_text: string;
  social_links: Partial<Record<SocialPlatform, string>>;
  default_meta_title?: string | null;
  default_meta_description?: string | null;
  default_og_image?: string | null;
  posts_per_page: number;
  newsletter_enabled: boolean | number;
  newsletter_headline: string;
  newsletter_blurb: string;
  analytics_script?: string | null;
};

export type StaticPageSummary = {
  id: string;
  slug: string;
  title: string;
  show_in_footer: boolean | number;
  show_in_nav: boolean | number;
  sort_order: number;
};

export type StaticPageFull = StaticPageSummary & {
  subtitle?: string | null;
  eyebrow?: string | null;
  content_md: string;
  updated_at: string;
  meta_title?: string | null;
  meta_description?: string | null;
  noindex?: boolean | number | null;
};
