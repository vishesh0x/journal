import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { api } from "@/lib/api";

type Subscriber = { id: string; email: string; status: string; created_at: string };
type SubscribersResponse = { subscribers: Subscriber[]; total: number; page: number; perPage: number };

export default function Subscribers() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: ["admin-subscribers", page],
    queryFn: () => api.get<SubscribersResponse>(`/subscribers/admin?page=${page}`),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/subscribers/admin/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-subscribers"] }),
  });

  const rows = query.data?.subscribers ?? [];
  const total = query.data?.total ?? 0;
  const perPage = query.data?.perPage ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  async function exportCsv() {
    // Export covers every subscriber, not just the current page.
    const all = await api.get<SubscribersResponse>("/subscribers/admin?perPage=1000");
    const csv = [
      "email,status,joined",
      ...all.subscribers.map((r) => `${r.email},${r.status},${r.created_at}`),
    ].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Subscribers</h1>
            <p className="mt-1 text-sm text-muted-foreground">{total} total.</p>
          </div>
          <button
            onClick={exportCsv}
            disabled={total === 0}
            className="rounded-md border border-border px-3 py-1.5 text-sm transition-colors hover:border-primary disabled:opacity-50"
          >
            Export CSV
          </button>
        </div>

        <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
          {rows.length === 0 ? (
            <li className="p-8 text-center text-sm text-muted-foreground">No one has subscribed yet.</li>
          ) : (
            rows.map((row) => (
              <li key={row.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{row.email}</p>
                  <p className="text-xs text-muted-foreground">
                    joined {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    row.status === "active" ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                  }`}
                >
                  {row.status}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Remove ${row.email}?`)) remove.mutate(row.id);
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Remove
                </button>
              </li>
            ))
          )}
        </ul>

        {totalPages > 1 ? (
          <div className="mt-4 flex items-center justify-between text-sm">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
      </div>
    </DashboardShell>
  );
}
