import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Newsletter } from "@/components/newsletter";
import { MarkdownContent } from "@/components/markdown-content";
import { PageSkeleton } from "@/components/skeletons";
import { extractToc } from "@/lib/markdown";
import { useDocumentMeta } from "@/lib/head";
import { optimizedImageUrl } from "@/lib/image";
import { api, type PostFull, type PostSummary, type SiteSettings } from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PostDetail() {
  const { slug } = useParams<{ slug: string }>();

  const { data: settings } = useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<SiteSettings>("/settings"),
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["post", slug],
    queryFn: () => api.get<{ post: PostFull; more: PostSummary[] }>(`/posts/by-slug/${slug}`),
    enabled: Boolean(slug),
    retry: false,
  });

  useDocumentMeta({
    title: data?.post ? data.post.meta_title || data.post.title : undefined,
    description: data?.post ? data.post.meta_description || data.post.excerpt : undefined,
    image: data?.post ? data.post.og_image || data.post.cover_url || settings?.default_og_image : undefined,
    noindex: data?.post?.noindex,
    canonicalUrl: data?.post?.canonical_url,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <PageSkeleton />
      </SiteShell>
    );
  }

  if (error || !data?.post) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-6 sm:py-32">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Missing page</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            No such piece.
          </h1>
          <p className="mt-6 max-w-md leading-relaxed text-muted-foreground">
            That post doesn't exist or hasn't been published yet.
          </p>
          <Link
            to="/"
            className="mt-10 inline-block border-b-2 border-primary pb-1 text-[11px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-primary"
          >
            Back to writing
          </Link>
        </div>
      </SiteShell>
    );
  }

  const { post, more } = data;
  const toc = extractToc(post.content_md);

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="max-w-4xl pb-10 sm:pb-12">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            {post.tags.map((tag) => (
              <Link key={tag.slug} to={`/tags/${tag.slug}`} className="transition-opacity hover:opacity-70">
                {tag.name}
              </Link>
            ))}
          </div>
          <h1 className="mt-5 break-words font-display text-3xl font-bold leading-[1.05] tracking-tighter sm:text-6xl lg:text-7xl">
            {post.title}
          </h1>
          {post.subtitle ? (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:mt-6 sm:text-lg">
              {post.subtitle}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground sm:mt-8">
            <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
            <span aria-hidden>·</span>
            <span>{post.reading_minutes} min read</span>
          </div>
        </header>

        {post.cover_url ? (
          <img
            src={optimizedImageUrl(post.cover_url, { width: 1600 }, settings?.image_resizing_enabled) ?? undefined}
            alt={post.title}
            className="aspect-video w-full object-cover"
            fetchPriority="high"
          />
        ) : null}

        <div className="grid min-w-0 gap-8 py-10 sm:py-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start lg:gap-12">
          {toc.length > 2 ? (
            <>
              {/* Mobile / tablet: collapsed by default so it doesn't compete with the article */}
              <details className="group rounded-lg border border-border lg:hidden">
                <summary className="flex cursor-pointer select-none list-none items-center justify-between px-4 py-3 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground marker:content-none">
                  Contents
                  <span className="text-sm transition-transform duration-200 group-open:rotate-180" aria-hidden>
                    ⌄
                  </span>
                </summary>
                <ul className="flex flex-col gap-2.5 border-t border-border px-4 py-3 text-sm">
                  {toc.map((item) => (
                    <li key={item.id} className={item.depth === 3 ? "pl-3" : ""}>
                      <a href={`#${item.id}`} className="break-words text-muted-foreground transition-colors hover:text-primary">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              {/* Desktop: sticky sidebar alongside the article */}
              <aside className="hidden lg:sticky lg:top-28 lg:block">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Contents</p>
                <ul className="mt-4 space-y-2.5 text-sm">
                  {toc.map((item) => (
                    <li key={item.id} className={item.depth === 3 ? "pl-3" : ""}>
                      <a href={`#${item.id}`} className="break-words text-muted-foreground transition-colors hover:text-primary">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            </>
          ) : (
            <div className="hidden lg:block" />
          )}
          <div className="w-full min-w-0 max-w-[68ch]">
            <MarkdownContent markdown={post.content_md} />
          </div>
        </div>

        <section className="flex flex-col gap-5 border-t border-border py-8 sm:flex-row sm:items-center sm:py-10">
          {settings?.author_avatar_url ? (
            <img
              src={optimizedImageUrl(settings.author_avatar_url, { width: 128 }, settings.image_resizing_enabled) ?? undefined}
              alt={settings.author_name}
              className="size-16 object-cover"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Written by</p>
            <p className="mt-2 font-display text-xl font-bold tracking-tight">{settings?.author_name}</p>
            <p className="mt-1 max-w-prose text-sm leading-relaxed text-muted-foreground">{settings?.author_bio}</p>
          </div>
        </section>

        {more.length ? (
          <section className="grid grid-cols-12 gap-6 border-t border-border py-10 sm:gap-8 sm:py-14">
            <p className="col-span-12 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground lg:col-span-4">
              Keep reading
            </p>
            <ul className="col-span-12 divide-y divide-border lg:col-span-8">
              {more.map((item) => (
                <li key={item.id} className="group py-5 first:pt-0">
                  <Link
                    to={`/posts/${item.slug}`}
                    className="font-display text-lg font-bold leading-snug tracking-tight transition-colors group-hover:text-primary sm:text-xl"
                  >
                    {item.title}
                  </Link>
                  <p className="mt-1.5 text-xs font-medium text-muted-foreground">{item.reading_minutes} min read</p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {settings?.newsletter_enabled ? (
          <div className="my-8 sm:my-10">
            <Newsletter headline={settings.newsletter_headline} blurb={settings.newsletter_blurb} />
          </div>
        ) : null}
      </article>
    </SiteShell>
  );
}
