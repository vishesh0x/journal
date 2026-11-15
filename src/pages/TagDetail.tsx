import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { PostCard } from "@/components/post-card";
import { ErrorState } from "@/components/error-state";
import { api, type PostSummary, type Tag } from "@/lib/api";

export default function TagDetail() {
  const { slug } = useParams<{ slug: string }>();

  const query = useQuery({
    queryKey: ["posts", "tag", slug],
    queryFn: () =>
      api.get<{ posts: PostSummary[]; total: number; tag: Tag | null }>(`/posts?tag=${slug}&perPage=50`),
    enabled: Boolean(slug),
  });
  const data = query.data;

  if (query.isError) {
    return (
      <SiteShell>
        <ErrorState onRetry={() => query.refetch()} />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="max-w-3xl pb-12 sm:pb-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Topic</p>
          <h1 className="mt-5 break-words font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            {data?.tag?.name ?? slug}
          </h1>
          {data?.tag?.description ? (
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              {data.tag.description}
            </p>
          ) : null}
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {data?.total ?? 0} {(data?.total ?? 0) === 1 ? "piece" : "pieces"}
          </p>
        </header>
        {data && data.posts.length === 0 ? (
          <p className="border-t border-border py-24 text-center text-muted-foreground">Nothing here yet.</p>
        ) : (
          <section className="grid grid-cols-12 gap-6 border-t border-border pt-10 sm:gap-8 sm:pt-14">
            <div className="col-span-12 lg:col-span-4" />
            <div className="col-span-12 lg:col-span-8">
              {data?.posts.map((post) => <PostCard key={post.id} post={post} />)}
            </div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
