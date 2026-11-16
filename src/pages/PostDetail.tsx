import { CalendarDays, Clock } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { Newsletter } from "@/components/newsletter";
import { MarkdownContent } from "@/components/markdown-content";
import { PageSkeleton } from "@/components/skeletons";
import { extractToc } from "@/lib/markdown";
import { useDocumentMeta } from "@/lib/head";
import { imageSrcSet, optimizedImageUrl } from "@/lib/image";
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
        <div className="container">
          <div className="tile tone-a flex max-w-2xl flex-col gap-5">
            <h1 className="h-section">No such piece.</h1>
            <p>That post doesn’t exist or hasn’t been published yet.</p>
            <Link to="/" className="btn self-start">
              Back to writing
            </Link>
          </div>
        </div>
      </SiteShell>
    );
  }

  const { post, more } = data;
  const toc = extractToc(post.content_md);

  const tocList = (
    <ul className="flex flex-col gap-3">
      {toc.map((item) => (
        <li key={item.id} className={item.depth === 3 ? "pl-4" : ""}>
          <a href={`#${item.id}`} className="text-link break-words" style={{ textDecorationThickness: "1px" }}>
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <SiteShell>
      <article className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <div className="flex min-w-0 flex-col gap-6">
            <h1 className="display-s" style={{ overflowWrap: "anywhere" }}>
              {post.title}
            </h1>
            {post.subtitle ? (
              <p className="lead" style={{ maxWidth: "52ch", color: "var(--color-ink)" }}>
                {post.subtitle}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-4">
            <p className="meta small">
              <span>
                <CalendarDays size={15} aria-hidden="true" />
                <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
              </span>
              <span>
                <Clock size={15} aria-hidden="true" />
                {post.reading_minutes} min read
              </span>
            </p>
            {post.tags.length ? (
              <div className="chips">
                {post.tags.map((tag) => (
                  <Link key={tag.slug} to={`/tags/${tag.slug}`} className="chip">
                    {tag.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </header>

        {post.cover_url ? (
          <img
            src={optimizedImageUrl(post.cover_url, { width: 1600 }, settings?.image_resizing_enabled) ?? undefined}
            srcSet={imageSrcSet(post.cover_url, settings?.image_resizing_enabled)}
            sizes="(min-width: 80rem) 1184px, calc(100vw - 3rem)"
            width={1600}
            height={900}
            alt=""
            className="cover"
            fetchPriority="high"
            decoding="async"
          />
        ) : null}

        {toc.length > 2 ? (
          <div className="row-2 band-flush">
            <details className="tile lg:hidden" style={{ padding: "var(--space-md)" }}>
              <summary className="cursor-pointer font-bold">Contents</summary>
              <div className="mt-4">{tocList}</div>
            </details>
            <aside className="sticky-head hidden lg:block" aria-label="Contents">
              <h2 className="h-title mb-5">Contents</h2>
              {tocList}
            </aside>
            <div className="w-full min-w-0" style={{ maxWidth: "68ch" }}>
              <MarkdownContent markdown={post.content_md} />
            </div>
          </div>
        ) : (
          <div className="band-flush single-col min-w-0">
            <MarkdownContent markdown={post.content_md} />
          </div>
        )}

        <section className="band-flush tile tone-c row-2 wide-left" style={{ alignItems: "center", padding: "var(--space-xl)", marginTop: "var(--section-gap-s)" }}>
          <div className="flex items-center gap-5">
            {settings?.author_avatar_url ? (
              <img
                src={optimizedImageUrl(settings.author_avatar_url, { width: 128 }, settings.image_resizing_enabled) ?? undefined}
                alt=""
                className="avatar"
                loading="lazy"
                decoding="async"
              />
            ) : null}
            <h2 className="h-title">Written by {settings?.author_name}</h2>
          </div>
          {settings?.author_bio ? <p className="lead" style={{ color: "inherit" }}>{settings.author_bio}</p> : null}
        </section>

        {more.length ? (
          <section className="band row-2">
            <h2 className="h-section sticky-head">Keep reading</h2>
            <ul className="rows">
              {more.map((item) => (
                <li key={item.id}>
                  <Link to={`/posts/${item.slug}`} className="h-title">
                    {item.title}
                  </Link>
                  <span className="small">{item.reading_minutes} min read</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {settings?.newsletter_enabled ? (
          <div className="band-flush" style={{ marginTop: "var(--section-gap-s)" }}>
            <Newsletter headline={settings.newsletter_headline} blurb={settings.newsletter_blurb} />
          </div>
        ) : null}
      </article>
    </SiteShell>
  );
}
