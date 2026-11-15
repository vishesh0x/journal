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

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="max-w-2xl pb-10 sm:pb-14">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Search</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl">
            Find something to read
          </h1>
          <form onSubmit={onSubmit} className="mt-8">
            <input
              autoFocus
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search posts…"
              className="w-full border-b-2 border-border bg-transparent py-3 text-lg outline-none transition-colors focus:border-primary"
            />
          </form>
        </header>

        {debouncedQuery.trim().length === 0 ? (
          <p className="border-t border-border py-16 text-center text-muted-foreground">
            Start typing to search titles and post content.
          </p>
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : query.isLoading ? (
          <div className="border-t border-border pt-10">
            <PostListSkeleton count={3} />
          </div>
        ) : query.data && query.data.posts.length === 0 ? (
          <p className="border-t border-border py-16 text-center text-muted-foreground">
            No posts match "{debouncedQuery}".
          </p>
        ) : (
          <section className="grid grid-cols-12 gap-6 border-t border-border pt-10 sm:gap-8 sm:pt-14">
            <p className="col-span-12 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground lg:col-span-4">
              {query.data?.posts.length} result{query.data?.posts.length === 1 ? "" : "s"}
            </p>
            <div className="col-span-12 lg:col-span-8">
              {query.data?.posts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
