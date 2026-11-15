import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { PostCard } from "@/components/post-card";
import { Newsletter } from "@/components/newsletter";
import { ErrorState } from "@/components/error-state";
import { FeaturedPostSkeleton, PostListSkeleton } from "@/components/skeletons";
import { useDocumentMeta } from "@/lib/head";
import { optimizedImageUrl } from "@/lib/image";
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
        <div className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-6 sm:pt-12">
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
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <section className="pb-16 pt-6 sm:pb-28 sm:pt-12">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{settings?.author_name}</p>
          <h1 className="mt-5 max-w-5xl break-words font-display text-3xl font-bold leading-[1.05] tracking-tighter sm:mt-6 sm:text-6xl lg:text-7xl">
            {settings?.tagline}
          </h1>
          {settings?.author_bio ? (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:mt-8 sm:text-lg">
              {settings.author_bio}
            </p>
          ) : null}
        </section>

        {data.posts.length === 0 ? (
          <p className="border-t border-border py-24 text-center text-muted-foreground">No posts published yet.</p>
        ) : (
          <>
            {showLead && lead ? (
              <section className="pb-16 sm:pb-32">
                <div className="grid grid-cols-12 items-end gap-6">
                  <div className="relative z-0 col-span-12 lg:col-span-7">
                    {lead.cover_url ? (
                      <Link to={`/posts/${lead.slug}`} className="block aspect-video w-full overflow-hidden">
                        <img
                          src={optimizedImageUrl(lead.cover_url, { width: 1200 }, settings?.image_resizing_enabled) ?? undefined}
                          alt={lead.title}
                          className="size-full object-cover grayscale transition-all duration-700 ease-out hover:grayscale-0"
                          fetchPriority="high"
                        />
                      </Link>
                    ) : (
                      <div className="aspect-video w-full bg-surface" />
                    )}
                  </div>
                  <div className="relative z-10 col-span-12 border-primary/20 bg-background p-6 sm:p-8 lg:col-span-5 lg:col-start-8 lg:-ml-24 lg:mb-16 lg:border-l lg:border-t lg:p-12">
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Latest</p>
                    <h2 className="mt-4 break-words font-display text-2xl font-bold leading-tight tracking-tight sm:mt-5 sm:text-3xl">
                      <Link to={`/posts/${lead.slug}`} className="transition-colors hover:text-primary">
                        {lead.title}
                      </Link>
                    </h2>
                    {lead.subtitle || lead.excerpt ? (
                      <p className="mt-4 leading-relaxed text-muted-foreground sm:mt-5">
                        {lead.subtitle || lead.excerpt}
                      </p>
                    ) : null}
                    <p className="mt-5 text-xs font-medium text-muted-foreground sm:mt-6">
                      {formatDate(lead.published_at)} · {lead.reading_minutes} min read
                    </p>
                    <Link
                      to={`/posts/${lead.slug}`}
                      className="mt-7 inline-block border-b-2 border-primary pb-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-primary sm:mt-8"
                    >
                      Read full piece
                    </Link>
                  </div>
                </div>
              </section>
            ) : null}

            {indexPosts.length ? (
              <section className="grid grid-cols-12 gap-6 border-t border-border pt-10 sm:gap-8 sm:pt-16">
                <div className="col-span-12 lg:col-span-4">
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground lg:sticky lg:top-28">
                    More writing
                  </h2>
                </div>
                <div className="col-span-12 lg:col-span-8">
                  {indexPosts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </section>
            ) : null}

            {totalPages > 1 ? (
              <nav className="mt-12 flex items-center justify-between border-t border-border pt-8 text-[11px] font-bold uppercase tracking-[0.18em] sm:mt-16">
                {page > 1 ? (
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
                    Newer
                  </button>
                ) : (
                  <span />
                )}
                <span className="text-muted-foreground">
                  {page} / {totalPages}
                </span>
                {page < totalPages ? (
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    className="text-muted-foreground transition-colors hover:text-primary"
                  >
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
          <div className="mt-16 sm:mt-32">
            <Newsletter
              headline={settings.newsletter_headline}
              blurb={settings.newsletter_blurb}
            />
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}
