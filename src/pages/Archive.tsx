import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { ErrorState } from "@/components/error-state";
import { api, type Tag } from "@/lib/api";

type ArchivePost = { id: string; title: string; slug: string; published_at: string | null };

export default function Archive() {
  const postsQuery = useQuery({
    queryKey: ["posts", "archive"],
    queryFn: () => api.get<ArchivePost[]>("/posts/archive"),
  });
  const tagsQuery = useQuery({ queryKey: ["tags"], queryFn: () => api.get<Tag[]>("/tags") });
  const posts = postsQuery.data;
  const tags = tagsQuery.data;

  if (postsQuery.isError) {
    return (
      <SiteShell>
        <ErrorState onRetry={() => postsQuery.refetch()} />
      </SiteShell>
    );
  }

  const byYear = (posts ?? []).reduce<Record<string, ArchivePost[]>>((acc, post) => {
    const year = post.published_at ? new Date(post.published_at).getFullYear().toString() : "Undated";
    (acc[year] ??= []).push(post);
    return acc;
  }, {});

  const count = (posts ?? []).length;

  return (
    <SiteShell>
      <div className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <h1 className="display">Archive</h1>
          <p className="lead">
            {count} {count === 1 ? "piece" : "pieces"}, newest first.
          </p>
        </header>

        {tags && tags.length > 0 ? (
          <section className="band row-2">
            <h2 className="h-section sticky-head">Topics</h2>
            <div className="chips" style={{ alignContent: "flex-start" }}>
              {tags.map((tag) => (
                <Link key={tag.slug} to={`/tags/${tag.slug}`} className="chip">
                  {tag.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {Object.entries(byYear).map(([year, items]) => (
          <section key={year} className="band row-2">
            <h2 className="h-section sticky-head">{year}</h2>
            <ul className="rows">
              {items.map((post) => (
                <li key={post.id}>
                  <Link to={`/posts/${post.slug}`} className="h-title">
                    {post.title}
                  </Link>
                  <span className="small">
                    {post.published_at
                      ? new Date(post.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </SiteShell>
  );
}
