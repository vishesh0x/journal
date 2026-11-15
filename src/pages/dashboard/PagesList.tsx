import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
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
      <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Pages</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Privacy and Terms live here, and you can add any page you like.
            </p>
          </div>
          <button
            onClick={() => create.mutate()}
            disabled={create.isPending}
            className="btn"
          >
            {create.isPending ? "Creating…" : "New page"}
          </button>
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-border">
          {pages.isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading pages…</p>
          ) : rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">No pages yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rows.map((page) => (
                <li key={page.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigate(`/dashboard/pages/${page.id}`)}
                      className="text-left font-display text-lg leading-snug hover:text-primary"
                    >
                      {page.title}
                    </button>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {pagePath(page.slug)}
                      {page.system_key ? ", built in" : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs capitalize ${
                      page.status === "published" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                    }`}
                  >
                    {page.status}
                  </span>
                  {page.status === "published" ? (
                    <a
                      href={pagePath(page.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      View
                    </a>
                  ) : null}
                  {page.system_key ? null : (
                    <button
                      onClick={() => {
                        if (confirm(`Delete "${page.title}"?`)) remove.mutate(page.id);
                      }}
                      className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                    >
                      Delete
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
