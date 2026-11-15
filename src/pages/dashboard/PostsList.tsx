import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { api } from "@/lib/api";

type Overview = { published: number; drafts: number; subscribers: number; tagCount: number };
type AdminPost = {
  id: string;
  title: string;
  slug: string;
  status: string;
  updated_at: string;
  view_count: number;
};

const statusStyles: Record<string, string> = {
  published: "border-primary/40 text-primary",
  draft: "border-border text-muted-foreground",
};

export default function PostsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const overview = useQuery({ queryKey: ["overview"], queryFn: () => api.get<Overview>("/overview") });
  const posts = useQuery({ queryKey: ["admin-posts"], queryFn: () => api.get<AdminPost[]>("/posts/admin") });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/posts/admin"),
    onSuccess: (created) => navigate(`/dashboard/posts/${created.id}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/posts/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const stats = [
    { label: "Published", value: overview.data?.published ?? 0 },
    { label: "Drafts", value: overview.data?.drafts ?? 0 },
    { label: "Subscribers", value: overview.data?.subscribers ?? 0 },
    { label: "Topics", value: overview.data?.tagCount ?? 0 },
  ];

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Your writing</h1>
            <p className="mt-1 text-sm text-muted-foreground">Drafts stay private until you publish them.</p>
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {create.isPending ? "Creating…" : "New post"}
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-border bg-surface px-4 py-4">
              <p className="font-display text-2xl sm:text-3xl">{stat.value}</p>
              <p className="mt-0.5 text-xs uppercase tracking-[0.14em] text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-hidden rounded-lg border border-border">
          {posts.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading posts…</p>
          ) : (posts.data ?? []).length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">Nothing written yet. Start your first post.</p>
          ) : (
            <ul className="divide-y divide-border">
              {(posts.data ?? []).map((post) => (
                <li key={post.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate(`/dashboard/posts/${post.id}`)}
                      className="text-left font-display text-lg leading-snug hover:text-primary"
                    >
                      {post.title}
                    </button>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      /{post.slug} · updated {new Date(post.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${
                      statusStyles[post.status] ?? statusStyles["draft"]
                    }`}
                  >
                    {post.status}
                  </span>
                  {post.status === "published" ? (
                    <span className="text-xs text-muted-foreground" title="Views">
                      {post.view_count} {post.view_count === 1 ? "view" : "views"}
                    </span>
                  ) : null}
                  {post.status === "published" ? (
                    <a
                      href={`/posts/${post.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      View
                    </a>
                  ) : null}
                  <button
                    onClick={() => {
                      if (confirm(`Delete "${post.title}"? This can't be undone.`)) remove.mutate(post.id);
                    }}
                    className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
