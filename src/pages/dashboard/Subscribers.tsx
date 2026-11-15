import { Download, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHead, StatusChip } from "@/components/dash";
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

  // A cell that starts with = + - @ or a control character would run as a formula in Excel or Sheets, so it is defanged and quoted.
  function csvCell(value: string) {
    const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
    return `"${safe.replace(/"/g, '""')}"`;
  }

  async function exportCsv() {
    // Export covers every subscriber, not just the current page.
    const all = await api.get<SubscribersResponse>("/subscribers/admin?perPage=1000");
    const csv = [
      "email,status,joined",
      ...all.subscribers.map((r) => [r.email, r.status, r.created_at].map(csvCell).join(",")),
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
      <div className="dash-main narrow">
        <PageHead
          title="Subscribers"
          hint={`${total} total.`}
          action={
            <button type="button" onClick={exportCsv} disabled={total === 0} className="btn-ghost">
              <Download size={18} aria-hidden="true" /> Export CSV
            </button>
          }
        />

        <div className="panel">
          {rows.length === 0 ? (
            <p className="panel-empty">No one has subscribed yet.</p>
          ) : (
            rows.map((row) => (
              <div key={row.id} className="panel-row">
                <div className="row-main">
                  <p className="truncate font-bold">{row.email}</p>
                  <p className="small mt-1">joined {new Date(row.created_at).toLocaleDateString()}</p>
                </div>
                <StatusChip on={row.status === "active"}>{row.status}</StatusChip>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Remove ${row.email}?`)) remove.mutate(row.id);
                  }}
                  className="icon-btn danger"
                  aria-label={`Remove ${row.email}`}
                  title="Remove"
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              </div>
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-between gap-4">
            <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} className="btn-ghost">
              Previous
            </button>
            <span className="small">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="btn-ghost"
            >
              Next
            </button>
          </nav>
        ) : null}
      </div>
    </DashboardShell>
  );
}
