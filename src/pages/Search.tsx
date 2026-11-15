import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { PostCard } from "@/components/post-card";
import { PostListSkeleton } from "@/components/skeletons";
import { ErrorState } from "@/components/error-state";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { api, type PostSummary } from "@/lib/api";

export default function Search() {
  const [params, setParams] = useSearchParams();
  const initial = params.get("q") ?? "";
  const [input, setInput] = useState(initial);
  const debouncedQuery = useDebouncedValue(input, 300);

  const query = useQuery({
    queryKey: ["posts", "search", debouncedQuery],
    queryFn: () => api.get<{ posts: PostSummary[]; query: string }>(`/posts/search?q=${encodeURIComponent(debouncedQuery)}`),
    enabled: debouncedQuery.trim().length > 0,
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setParams(input ? { q: input } : {});
  }

  const total = query.data?.posts.length ?? 0;

  return (
    <SiteShell>
      <div className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <h1 className="display">Find something to read</h1>
          <form onSubmit={onSubmit} role="search">
            <label htmlFor="site-search" className="visually-hidden">
              Search posts
            </label>
            <input
              id="site-search"
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search posts…"
              className="field field-lg"
            />
          </form>
        </header>

        {debouncedQuery.trim().length === 0 ? (
          <p className="band muted">Start typing to search titles and post content.</p>
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <div className="band">
            <PostListSkeleton count={3} />
          </div>
        ) : query.data && total === 0 ? (
          <p className="band muted">No posts match "{debouncedQuery}".</p>
        ) : (
          <section className="band row-2">
            <h2 className="h-section sticky-head">
              {total} result{total === 1 ? "" : "s"}
            </h2>
            <div className="tile-grid">{query.data?.posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
