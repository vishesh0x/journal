import { memo } from "react";
import { Link } from "react-router-dom";
import type { PostSummary } from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PostCardInner({ post }: { post: PostSummary }) {
  return (
    <article className="group border-t border-border py-8 first:border-t-0 first:pt-0 sm:py-10">
      <div className="flex flex-col gap-3 sm:gap-4 md:flex-row md:items-baseline md:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold leading-tight tracking-tight transition-colors group-hover:text-primary sm:text-2xl">
            <Link to={`/posts/${post.slug}`}>{post.title}</Link>
          </h2>
          {post.subtitle ? <p className="mt-2 text-muted-foreground">{post.subtitle}</p> : null}
          {post.excerpt ? (
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-medium text-muted-foreground">
            {post.tags.map((tag) => (
              <Link
                key={tag.slug}
                to={`/tags/${tag.slug}`}
                className="text-[10px] font-bold uppercase tracking-[0.18em] transition-colors hover:text-primary"
              >
                {tag.name}
              </Link>
            ))}
            <span>{post.reading_minutes} min read</span>
          </div>
        </div>
        <time dateTime={post.published_at ?? undefined} className="shrink-0 text-sm font-medium text-muted-foreground">
          {formatDate(post.published_at)}
        </time>
      </div>
    </article>
  );
}

export const PostCard = memo(PostCardInner);
