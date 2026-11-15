import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { Field, PageHead, TextArea } from "@/components/dash";
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
          className="section-card mb-8"
          style={{ borderRadius: "var(--radius-panel)" }}
        >
          <Field id="topic-name" label="Topic name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="For example, Cities" />
          <TextArea
            id="topic-desc"
            label="Short description"
            rows={4}
            value={description}
            maxLength={500}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A sentence or two about what this topic covers. It appears at the top of the topic page."
            hint={`${description.length} of 500 characters`}
          />
          <button type="submit" className="btn self-start" disabled={add.isPending || !name.trim()}>
            <Plus size={18} aria-hidden="true" /> Add topic
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
