import { ExternalLink, Plus, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHead, StatusChip } from "@/components/dash";
import { pagePath } from "@/components/site-shell";
import { api } from "@/lib/api";

type AdminPage = { id: string; title: string; slug: string; status: string; system_key: string | null };

export default function PagesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pages = useQuery({ queryKey: ["admin-pages"], queryFn: () => api.get<AdminPage[]>("/pages/admin") });

  const create = useMutation({
    mutationFn: () => api.post<{ id: string }>("/pages/admin"),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      navigate(`/dashboard/pages/${created.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/pages/admin/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({ queryKey: ["pages", "public"] });
    },
  });

  const rows = pages.data ?? [];

  return (
    <DashboardShell>
      <div className="dash-main narrow">
        <PageHead
          title="Pages"
          hint="Privacy and Terms live here, and you can add any page you like."
          action={
            <button type="button" onClick={() => create.mutate()} disabled={create.isPending} className="btn">
              <Plus size={18} aria-hidden="true" /> {create.isPending ? "Creating…" : "New page"}
            </button>
          }
        />

        <div className="panel">
          {pages.isLoading ? (
            <p className="panel-empty">Loading pages…</p>
          ) : rows.length === 0 ? (
            <p className="panel-empty">No pages yet.</p>
          ) : (
            rows.map((page) => (
              <div key={page.id} className="panel-row">
                <div className="row-main">
                  <button type="button" onClick={() => navigate(`/dashboard/pages/${page.id}`)} className="row-title">
                    {page.title}
                  </button>
                  <p className="small mt-1">
                    {pagePath(page.slug)}
                    {page.system_key ? ", built in" : ""}
                  </p>
                </div>
                <StatusChip on={page.status === "published"}>{page.status}</StatusChip>
                {page.status === "published" ? (
                  <a href={pagePath(page.slug)} target="_blank" rel="noreferrer" className="icon-btn" aria-label={`View ${page.title}`} title="View on the site">
                    <ExternalLink size={18} aria-hidden="true" />
                  </a>
                ) : null}
                {page.system_key ? null : (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Delete “${page.title}”?`)) remove.mutate(page.id);
                    }}
                    className="icon-btn danger"
                    aria-label={`Delete ${page.title}`}
                    title="Delete"
                  >
                    <Trash2 size={18} aria-hidden="true" />
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
