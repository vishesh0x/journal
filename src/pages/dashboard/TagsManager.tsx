import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageHead } from "@/components/dash";
import { api, type Tag } from "@/lib/api";

export default function TagsManager() {
  const queryClient = useQueryClient();
  const tags = useQuery({ queryKey: ["admin-tags"], queryFn: () => api.get<Tag[]>("/tags/admin") });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-tags"] });

  const add = useMutation({
    mutationFn: () => api.post("/tags/admin", { name, description: description || null }),
    onSuccess: () => {
      setName("");
      setDescription("");
      setError(null);
      invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/tags/admin/${id}`),
    onSuccess: invalidate,
  });

  return (
    <DashboardShell>
      <div className="dash-main narrow">
        <PageHead title="Topics" hint="Group posts so readers can follow a thread." />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate();
          }}
          className="tile tone-a mb-8 flex flex-col gap-3 sm:flex-row"
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          <label htmlFor="topic-name" className="visually-hidden">
            Topic name
          </label>
          <input
            id="topic-name"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            placeholder="Topic name"
            className="field sm:w-56"
          />
          <label htmlFor="topic-desc" className="visually-hidden">
            Short description
          </label>
          <input
            id="topic-desc"
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="field flex-1"
          />
          <button type="submit" className="btn" disabled={add.isPending}>
            <Plus size={18} aria-hidden="true" /> Add
          </button>
        </form>
        {error ? (
          <p role="alert" className="notice mb-4">
            {error}
          </p>
        ) : null}

        <div className="panel">
          {(tags.data ?? []).length === 0 ? (
            <p className="panel-empty">No topics yet.</p>
          ) : (
            (tags.data ?? []).map((tag) => (
              <div key={tag.id} className="panel-row">
                <div className="row-main">
                  <p className="font-bold">{tag.name}</p>
                  <p className="small mt-1">
                    /tags/{tag.slug}
                    {tag.description ? `, ${tag.description}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Delete the topic “${tag.name}”?`)) remove.mutate(tag.id);
                  }}
                  className="icon-btn danger"
                  aria-label={`Delete ${tag.name}`}
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
