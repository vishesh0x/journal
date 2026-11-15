import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, ExternalLink, EyeOff, Loader, Save, Send } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { Field, Icon, Section, StatusChip, TextArea, Toggle } from "@/components/dash";
import { MarkdownContent } from "@/components/markdown-content";
import { pagePath } from "@/components/site-shell";
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

  if (!draft)
    return (
      <DashboardShell>
        <p className="dash-main muted">Loading page…</p>
      </DashboardShell>
    );
  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch });
  const isPublished = draft.status === "published";

  return (
    <DashboardShell>
      <div className="dash-main" style={{ maxWidth: "88rem", paddingTop: 0 }}>
        <div className="sticky-bar" style={{ marginInline: "calc(var(--space-lg) * -1)", padding: "var(--space-sm) var(--space-lg)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link to="/dashboard/pages" className="text-link inline-flex items-center gap-2" style={{ textDecoration: "none" }}>
                <Icon as={ArrowLeft} /> All pages
              </Link>
              <StatusChip on={isPublished}>{draft.status}</StatusChip>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {saved ? (
                <span role="status" className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--color-success)" }}>
                  <Icon as={Check} /> Saved
                </span>
              ) : null}
              {isPublished ? (
                <a href={pagePath(draft.slug || "page")} target="_blank" rel="noreferrer" className="btn-ghost">
                  <Icon as={ExternalLink} /> View
                </a>
              ) : null}
              <button type="button" onClick={() => save.mutate({})} disabled={save.isPending} className="btn-ghost">
                <Icon as={save.isPending ? Loader : Save} /> {save.isPending ? "Saving…" : "Save"}
              </button>
              {isPublished ? (
                <button type="button" onClick={() => save.mutate({ status: "draft" })} className="btn-ghost">
                  <Icon as={EyeOff} /> Unpublish
                </button>
              ) : (
                <button type="button" onClick={() => save.mutate({ status: "published" })} className="btn">
                  <Icon as={Send} /> Publish
                </button>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <p role="alert" className="notice mt-4">
            {error}
          </p>
        ) : null}

        <div className="mt-6 grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))" }}>
          <div className="flex min-w-0 flex-col gap-6">
            <Section title="Content">
              <Field id="page-title" label="Title" value={draft.title} maxLength={300} onChange={(e) => set({ title: e.target.value })} />
              <Field id="page-sub" label="Subtitle" value={draft.subtitle} maxLength={300} onChange={(e) => set({ subtitle: e.target.value })} />
              <TextArea
                id="page-body"
                label="Body in Markdown"
                rows={18}
                className="field code-area"
                value={draft.content_md}
                onChange={(e) => set({ content_md: e.target.value })}
                hint="Code fences, tables and Mermaid diagrams work here too."
              />
            </Section>

            <Section title="Placement">
              <Field
                id="page-slug"
                label="Address"
                value={draft.slug}
                disabled={isSystem}
                onChange={(e) => set({ slug: e.target.value })}
                hint={isSystem ? "Built-in pages keep their address." : pagePath(draft.slug || "page")}
              />
              <Field id="page-order" label="Order in menus" type="number" value={draft.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) })} />
              <Toggle id="page-nav" label="Show in the top menu" checked={Boolean(draft.show_in_nav)} onChange={(v) => set({ show_in_nav: v })} />
              <Toggle id="page-foot" label="Show in the footer" checked={Boolean(draft.show_in_footer)} onChange={(v) => set({ show_in_footer: v })} />
            </Section>

            <Section title="Search">
              <Field id="page-meta-title" label="Search title" value={draft.meta_title} onChange={(e) => set({ meta_title: e.target.value })} />
              <TextArea id="page-meta-desc" label="Search description" rows={3} value={draft.meta_description} onChange={(e) => set({ meta_description: e.target.value })} />
              <Toggle id="page-noindex" label="Hide from search engines" checked={Boolean(draft.noindex)} onChange={(v) => set({ noindex: v })} />
            </Section>
          </div>

          <aside aria-label="Live preview" className="min-w-0">
            <div className="panel preview-pane lg:sticky" style={{ top: "5.5rem" }}>
                  <h2 className="visually-hidden">Preview, as readers see it</h2>
              <article style={{ padding: "var(--space-lg)" }}>
                <h1 className="display-s" style={{ fontSize: "var(--text-section)", overflowWrap: "anywhere" }}>
                  {draft.title || "Untitled page"}
                </h1>
                {draft.subtitle ? <p className="lead mt-4">{draft.subtitle}</p> : null}
                <MarkdownContent markdown={draft.content_md} className="mt-6" />
              </article>
            </div>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
