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

  return (
    <SiteShell>
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="max-w-3xl pb-12 sm:pb-16">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Everything</p>
          <h1 className="mt-5 font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            Archive
          </h1>
          <p className="mt-6 text-base text-muted-foreground sm:text-lg">
            {(posts ?? []).length} {(posts ?? []).length === 1 ? "piece" : "pieces"}, newest first.
          </p>
        </header>

        {tags && tags.length > 0 ? (
          <section className="grid grid-cols-12 gap-6 border-t border-border py-8 sm:gap-8 sm:py-10">
            <p className="col-span-12 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground lg:col-span-4">
              Topics
            </p>
            <div className="col-span-12 flex flex-wrap gap-x-6 gap-y-3 lg:col-span-8">
              {tags.map((tag) => (
                <Link
                  key={tag.slug}
                  to={`/tags/${tag.slug}`}
                  className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        <div>
          {Object.entries(byYear).map(([year, items]) => (
            <section key={year} className="grid grid-cols-12 gap-6 border-t border-border py-10 sm:gap-8 sm:py-12">
              <h2 className="col-span-12 font-display text-2xl font-bold tracking-tighter text-muted-foreground sm:text-3xl lg:col-span-4">
                {year}
              </h2>
              <ul className="col-span-12 divide-y divide-border lg:col-span-8">
                {items.map((post) => (
                  <li key={post.id} className="group flex flex-wrap items-baseline justify-between gap-3 py-4 first:pt-0 sm:gap-4 sm:py-5">
                    <Link
                      to={`/posts/${post.slug}`}
                      className="font-display text-lg font-bold tracking-tight transition-colors group-hover:text-primary sm:text-xl"
                    >
                      {post.title}
                    </Link>
                    <span className="text-xs font-medium text-muted-foreground">
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
      </div>
    </SiteShell>
  );
}
