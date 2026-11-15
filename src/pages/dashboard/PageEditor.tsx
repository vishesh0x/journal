import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { MarkdownContent } from "@/components/markdown-content";
import { pagePath } from "@/components/site-shell";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { api } from "@/lib/api";

type Draft = {
  title: string;
  slug: string;
  eyebrow: string;
  subtitle: string;
  content_md: string;
  status: string;
  show_in_footer: boolean | number;
  show_in_nav: boolean | number;
  sort_order: number;
  meta_title: string;
  meta_description: string;
  noindex: boolean | number;
};

const field =
  "w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";
const label = "text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground";

export default function PageEditor() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-page", id],
    queryFn: () => api.get<Record<string, unknown>>(`/pages/admin/${id}`),
    enabled: Boolean(id),
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const isSystem = Boolean(query.data?.system_key);

  useEffect(() => {
    const page = query.data;
    if (!page) return;
    setDraft({
      title: (page.title as string) ?? "",
      slug: (page.slug as string) ?? "",
      eyebrow: (page.eyebrow as string) ?? "",
      subtitle: (page.subtitle as string) ?? "",
      content_md: (page.content_md as string) ?? "",
      status: (page.status as string) ?? "draft",
      show_in_footer: Boolean(page.show_in_footer),
      show_in_nav: Boolean(page.show_in_nav),
      sort_order: (page.sort_order as number) ?? 0,
      meta_title: (page.meta_title as string) ?? "",
      meta_description: (page.meta_description as string) ?? "",
      noindex: Boolean(page.noindex),
    });
  }, [query.data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Draft>) => {
      const next = { ...(draft as Draft), ...patch };
      return api.put(`/pages/admin/${id}`, {
        title: next.title || "Untitled page",
        slug: next.slug || next.title,
        eyebrow: next.eyebrow || null,
        subtitle: next.subtitle || null,
        content_md: next.content_md,
        status: next.status,
        show_in_footer: next.show_in_footer ? 1 : 0,
        show_in_nav: next.show_in_nav ? 1 : 0,
        sort_order: Number(next.sort_order) || 0,
        meta_title: next.meta_title || null,
        meta_description: next.meta_description || null,
        noindex: next.noindex ? 1 : 0,
      });
    },
    onSuccess: () => {
      setError(null);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      queryClient.invalidateQueries({ queryKey: ["admin-pages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-page", id] });
      queryClient.invalidateQueries({ queryKey: ["pages", "public"] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
  });

  const debouncedContent = useDebouncedValue(draft?.content_md ?? "", 200);

  if (!draft) return <DashboardShell><div className="p-10 text-sm text-muted-foreground">Loading page…</div></DashboardShell>;
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-6xl px-5 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/dashboard/pages"
            className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-primary"
          >
            ← All pages
          </Link>
          <div className="flex items-center gap-3">
            {saved ? <span className="text-xs text-primary">Saved</span> : null}
            <button
              onClick={() => save.mutate({})}
              disabled={save.isPending}
              className="rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-primary disabled:opacity-60"
            >
              {save.isPending ? "Saving…" : "Save"}
            </button>
            {draft.status === "published" ? (
              <button
                onClick={() => {
                  set({ status: "draft" });
                  save.mutate({ status: "draft" });
                }}
                className="rounded-md border border-border px-4 py-2 text-sm font-semibold hover:border-destructive hover:text-destructive"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={() => {
                  set({ status: "published" });
                  save.mutate({ status: "published" });
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                Publish
              </button>
            )}
          </div>
        </div>

        {error ? <p className="mt-4 text-sm text-destructive">{error}</p> : null}

        <div className="mt-7 grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:gap-8">
          <div className="space-y-4">
            <input
              value={draft.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Page title"
              className="w-full bg-transparent font-display text-3xl font-bold tracking-tighter outline-none placeholder:text-muted-foreground/50 sm:text-4xl"
            />
            <input
              value={draft.eyebrow}
              onChange={(e) => set({ eyebrow: e.target.value })}
              placeholder="Small label above the title (optional)"
              className={field}
            />
            <textarea
              value={draft.subtitle}
              onChange={(e) => set({ subtitle: e.target.value })}
              placeholder="Short intro line (optional)"
              rows={2}
              className={field}
            />
            <textarea
              value={draft.content_md}
              onChange={(e) => set({ content_md: e.target.value })}
              placeholder="Write in Markdown…"
              rows={22}
              className={`${field} font-mono text-[13px] leading-relaxed`}
            />
          </div>

          <div className="space-y-6">
            <div className="rounded-lg border border-border bg-surface p-5">
              <p className={label}>Live preview</p>
              <div className="mt-4 max-h-[26rem] overflow-auto">
                <MarkdownContent markdown={debouncedContent || "_Nothing written yet._"} />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-5">
              <p className={label}>Where it lives</p>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Address</p>
                <input
                  value={draft.slug}
                  disabled={isSystem}
                  onChange={(e) => set({ slug: e.target.value })}
                  className={`${field} disabled:opacity-60`}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {pagePath(draft.slug || "page")}
                  {isSystem ? " · built-in address, can't change" : ""}
                </p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(draft.show_in_footer)}
                  onChange={(e) => set({ show_in_footer: e.target.checked })}
                />
                Show in the footer
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(draft.show_in_nav)}
                  onChange={(e) => set({ show_in_nav: e.target.checked })}
                />
                Show in the top menu
              </label>
              <div>
                <p className="mb-1.5 text-xs text-muted-foreground">Order</p>
                <input
                  type="number"
                  value={draft.sort_order}
                  onChange={(e) => set({ sort_order: Number(e.target.value) })}
                  className={field}
                />
              </div>
            </div>

            <div className="space-y-4 rounded-lg border border-border p-5">
              <p className={label}>Search appearance</p>
              <input
                value={draft.meta_title}
                onChange={(e) => set({ meta_title: e.target.value })}
                placeholder="Search title"
                className={field}
              />
              <textarea
                value={draft.meta_description}
                onChange={(e) => set({ meta_description: e.target.value })}
                placeholder="Search description"
                rows={3}
                className={field}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(draft.noindex)}
                  onChange={(e) => set({ noindex: e.target.checked })}
                />
                Hide from search engines
              </label>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
