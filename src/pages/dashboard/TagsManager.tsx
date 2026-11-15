import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
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
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-10">
        <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Topics</h1>
        <p className="mt-1 text-sm text-muted-foreground">Group posts so readers can follow a thread.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) add.mutate();
          }}
          className="mt-6 flex flex-col gap-2 sm:flex-row"
        >
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Topic name"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary sm:w-48"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button className="btn">
            Add
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}

        <ul className="mt-8 divide-y divide-border rounded-lg border border-border">
          {(tags.data ?? []).length === 0 ? (
            <li className="p-6 text-center text-sm text-muted-foreground">No topics yet.</li>
          ) : (
            (tags.data ?? []).map((tag) => (
              <li key={tag.id} className="flex items-center gap-3 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{tag.name}</p>
                  <p className="text-xs text-muted-foreground">
                    /tags/{tag.slug}
                    {tag.description ? `, ${tag.description}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => {
                    if (confirm(`Delete the topic "${tag.name}"?`)) remove.mutate(tag.id);
                  }}
                  className="text-xs text-muted-foreground transition-colors hover:text-destructive"
                >
                  Delete
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </DashboardShell>
  );
}
