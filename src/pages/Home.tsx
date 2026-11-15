import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, Clock, Library } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { PostCard } from "@/components/post-card";
import { Newsletter } from "@/components/newsletter";
import { ErrorState } from "@/components/error-state";
import { FeaturedPostSkeleton, PostListSkeleton } from "@/components/skeletons";
import { useDocumentMeta } from "@/lib/head";
import { imageSrcSet, optimizedImageUrl } from "@/lib/image";
import { api, type PostSummary, type SiteSettings } from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function Home() {
  const [page, setPage] = useState(1);

  const settingsQuery = useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<SiteSettings>("/settings"),
  });
  const settings = settingsQuery.data;

  const postsQuery = useQuery({
    queryKey: ["posts", page, settings?.posts_per_page],
    queryFn: () =>
      api.get<{ posts: PostSummary[]; total: number; perPage: number }>(
        `/posts?page=${page}&perPage=${settings?.posts_per_page ?? 8}`,
      ),
    enabled: Boolean(settings),
  });
  const data = postsQuery.data;

  useDocumentMeta({
    title: settings?.default_meta_title || settings?.site_name,
    description: settings?.default_meta_description || settings?.description,
    image: settings?.default_og_image,
  });

  if (settingsQuery.isError || postsQuery.isError) {
    return (
      <SiteShell>
        <ErrorState onRetry={() => (settingsQuery.isError ? settingsQuery.refetch() : postsQuery.refetch())} />
      </SiteShell>
    );
  }

  if (!data) {
    return (
      <SiteShell>
        <div className="container">
          <FeaturedPostSkeleton />
          <PostListSkeleton />
        </div>
      </SiteShell>
    );
  }

  const [lead, ...rest] = data.posts;
  const showLead = page === 1 && Boolean(lead);
  const indexPosts = showLead ? rest : data.posts;
  const totalPages = Math.max(1, Math.ceil(data.total / data.perPage));

  return (
    <SiteShell>
      <div className="container">
        {/* hero: the tagline set as the broadsheet's masthead, the bio and the way in on the right */}
        <section className="row-2 hero-row hero-fill">
          <h1 className="display">{settings?.tagline}</h1>
          <div className="flex flex-col gap-6">
            {settings?.author_bio ? <p className="lead line-clamp-4">{settings.author_bio}</p> : null}
            {settings?.author_name ? <p className="font-bold">{settings.author_name}</p> : null}
            <div className="flex flex-wrap gap-3">
              {lead ? (
                <Link to={`/posts/${lead.slug}`} className="btn">
                  Read the latest <ArrowRight size={18} aria-hidden="true" />
                </Link>
              ) : null}
              <Link to="/archive" className="btn-ghost">
                <Library size={18} aria-hidden="true" /> Browse the archive
              </Link>
            </div>
          </div>
        </section>

        {data.posts.length === 0 ? (
          <p className="band muted">No posts published yet.</p>
        ) : (
          <>
            {showLead && lead ? (
              <section className="band-flush row-2 wide-left" style={{ alignItems: "stretch" }}>
                {lead.cover_url ? (
                  <Link to={`/posts/${lead.slug}`} tabIndex={-1} aria-hidden className="block">
                    <img
                      src={optimizedImageUrl(lead.cover_url, { width: 1200 }, settings?.image_resizing_enabled) ?? undefined}
                      srcSet={imageSrcSet(lead.cover_url, settings?.image_resizing_enabled)}
                      sizes="(min-width: 64rem) 58vw, 100vw"
                      width={1200}
                      height={675}
                      alt=""
                      className="cover"
                      style={{ height: "100%", aspectRatio: "auto", minHeight: "20rem" }}
                      fetchPriority="high"
                      decoding="async"
                    />
                  </Link>
                ) : null}
                <article
                  className="tile tile-link tone-b flex flex-col gap-5"
                  style={lead.cover_url ? undefined : { gridColumn: "1 / -1" }}
                >
                  <h2 className="h-section">
                    <Link to={`/posts/${lead.slug}`} className="stretch">
                      {lead.title}
                    </Link>
                  </h2>
                  {lead.subtitle || lead.excerpt ? <p className="muted">{lead.subtitle || lead.excerpt}</p> : null}
                  <p className="meta small mt-auto">
                    <span>
                      <CalendarDays size={15} aria-hidden="true" />
                      <time dateTime={lead.published_at ?? undefined}>{formatDate(lead.published_at)}</time>
                    </span>
                    <span>
                      <Clock size={15} aria-hidden="true" />
                      {lead.reading_minutes} min read
                    </span>
                  </p>
                </article>
              </section>
            ) : null}

            {indexPosts.length ? (
              <section className="band row-2">
                <h2 className="h-section sticky-head">More writing</h2>
                <div className="tile-grid">
                  {indexPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            ) : null}

            {totalPages > 1 ? (
              <nav aria-label="Pagination" className="band-flush flex items-center justify-between gap-4">
                {page > 1 ? (
                  <button type="button" onClick={() => setPage((p) => p - 1)} className="btn-ghost">
                    Newer
                  </button>
                ) : (
                  <span />
                )}
                <span className="small">
                  Page {page} of {totalPages}
                </span>
                {page < totalPages ? (
                  <button type="button" onClick={() => setPage((p) => p + 1)} className="btn-ghost">
                    Older
                  </button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        )}

        {settings?.newsletter_enabled ? (
          <div className="band-flush" style={{ marginTop: "var(--section-gap-s)" }}>
            <Newsletter headline={settings.newsletter_headline} blurb={settings.newsletter_blurb} />
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}
