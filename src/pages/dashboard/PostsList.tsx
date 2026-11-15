import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHead, StatusChip } from "@/components/dash";
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
    { label: "Published", value: overview.data?.published ?? 0, tone: "tone-b" },
    { label: "Drafts", value: overview.data?.drafts ?? 0, tone: "tone-c" },
    { label: "Subscribers", value: overview.data?.subscribers ?? 0, tone: "tone-a" },
    { label: "Topics", value: overview.data?.tagCount ?? 0, tone: "tone-e" },
  ];

  return (
    <DashboardShell>
      <div className="dash-main">
        <PageHead
          title="Your writing"
          hint="Drafts stay private until you publish them."
          action={
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn">
              <Plus size={18} aria-hidden="true" /> {create.isPending ? "Creating…" : "New post"}
            </button>
          }
        />

        <div className="stat-grid">
          {stats.map((stat) => (
            <div key={stat.label} className={`tile stat ${stat.tone}`}>
              <p className="stat-n">{stat.value}</p>
              <p className="small mt-2">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="panel">
          {posts.isLoading ? (
            <p className="panel-empty">Loading posts…</p>
          ) : (posts.data ?? []).length === 0 ? (
            <p className="panel-empty">Nothing written yet. Start your first post.</p>
          ) : (
            (posts.data ?? []).map((post) => (
              <div key={post.id} className="panel-row">
                <div className="row-main">
                  <button type="button" onClick={() => navigate(`/dashboard/posts/${post.id}`)} className="row-title">
                    {post.title}
                  </button>
                  <p className="small mt-1">
                    /{post.slug}, updated {new Date(post.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <StatusChip on={post.status === "published"}>{post.status}</StatusChip>
                {post.status === "published" ? (
                  <span className="small">
                    {post.view_count} {post.view_count === 1 ? "view" : "views"}
                  </span>
                ) : null}
                {post.status === "published" ? (
                  <a href={`/posts/${post.slug}`} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`View ${post.title}`} title="View on the site">
                    <ExternalLink size={18} aria-hidden="true" />
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete “${post.title}”? This can’t be undone.`)) remove.mutate(post.id);
                  }}
                  className="icon-btn danger"
                  aria-label={`Delete ${post.title}`}
                  title="Delete"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
