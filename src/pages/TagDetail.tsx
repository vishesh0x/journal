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

  const total = data?.total ?? 0;

  return (
    <SiteShell>
      <div className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <h1 className="display">{data?.tag?.name ?? slug}</h1>
          <div className="flex flex-col gap-4">
            {data?.tag?.description ? <p className="lead">{data.tag.description}</p> : null}
            <p className="small">
              {total} {total === 1 ? "piece" : "pieces"}
            </p>
          </div>
        </header>
        {data && data.posts.length === 0 ? (
          <p className="band muted">Nothing here yet.</p>
        ) : (
          <section className="band-flush">
            <div className="tile-grid">{data?.posts.map((post) => <PostCard key={post.id} post={post} />)}</div>
          </section>
        )}
      </div>
    </SiteShell>
  );
}
