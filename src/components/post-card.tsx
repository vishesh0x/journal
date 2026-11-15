import { memo } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Clock } from "lucide-react";
import type { PostSummary } from "@/lib/api";

function formatDate(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** One entry in the tray. The title link stretches over the whole tile; tags sit above it. */
function PostCardInner({ post }: { post: PostSummary }) {
  return (
    <article className="tile tile-link flex flex-col gap-4">
      <h3 className="h-title">
        <Link to={`/posts/${post.slug}`} className="stretch">
          {post.title}
        </Link>
      </h3>
      {post.subtitle || post.excerpt ? <p className="muted">{post.subtitle || post.excerpt}</p> : null}
      {post.tags.length ? (
        <div className="chips above">
          {post.tags.map((tag) => (
            <Link key={tag.slug} to={`/tags/${tag.slug}`} className="chip">
              {tag.name}
            </Link>
          ))}
        </div>
      ) : null}
      <div className="meta small mt-auto">
        <span>
          <CalendarDays size={15} aria-hidden="true" />
          <time dateTime={post.published_at ?? undefined}>{formatDate(post.published_at)}</time>
        </span>
        <span>
          <Clock size={15} aria-hidden="true" />
          {post.reading_minutes} min read
        </span>
      </div>
    </article>
  );
}

export const PostCard = memo(PostCardInner);
