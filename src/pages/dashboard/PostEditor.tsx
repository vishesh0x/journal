import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { UploadField } from "@/components/upload-field";
import { renderMarkdown } from "@/lib/markdown";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { api, type Tag } from "@/lib/api";

type Draft = {
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  content_md: string;
  cover_url: string | null;
  status: string;
  featured: boolean | number;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  noindex: boolean | number;
};

const fieldClass =
  "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary";
const labelClass = "block text-sm font-bold  text-muted-foreground";
const cardClass = "rounded-lg border border-border bg-card p-5 sm:p-6";

type ToolbarAction = { label: string; title: string; before: string; after?: string; block?: boolean };

const toolbar: ToolbarAction[] = [
  { label: "H2", title: "Heading", before: "## ", block: true },
  { label: "B", title: "Bold", before: "**", after: "**" },
  { label: "I", title: "Italic", before: "_", after: "_" },
  { label: "“”", title: "Quote", before: "> ", block: true },
  { label: "•", title: "List", before: "- ", block: true },
  { label: "1.", title: "Numbered list", before: "1. ", block: true },
  { label: "</>", title: "Code", before: "`", after: "`" },
  { label: "Link", title: "Link", before: "[", after: "](https://)" },
  { label: "Rule", title: "Divider", before: "\n---\n", block: true },
];

export default function PostEditor() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-post", id],
    queryFn: () => api.get<{ post: Draft; tagIds: string[]; tags: Tag[] }>(`/posts/admin/${id}`),
    enabled: Boolean(id),
  });
  const [form, setForm] = useState<Draft | null>(null);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"write" | "seo">("write");
  const [showPreview, setShowPreview] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (query.data && !form) {
      setForm({ ...query.data.post });
      setTagIds(query.data.tagIds);
    }
  }, [query.data, form]);

  const markdown = form?.content_md ?? "";
  const debouncedMarkdown = useDebouncedValue(markdown, 200);
  const preview = useMemo(() => renderMarkdown(debouncedMarkdown), [debouncedMarkdown]);
  const words = useMemo(() => markdown.trim().split(/\s+/).filter(Boolean).length, [markdown]);

  const save = useMutation({
    mutationFn: (overrides: Partial<Draft & { tagIds: string[] }> = {}) =>
      api.put(`/posts/admin/${id}`, { ...form, tagIds, ...overrides }),
    onSuccess: (_data, variables) => {
      if (variables && "status" in variables) {
        setForm((prev) => (prev ? { ...prev, ...(variables as Partial<Draft>) } : prev));
      }
      setError(null);
      setStatus("Saved");
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] }); // public home/tag lists
      queryClient.invalidateQueries({ queryKey: ["post", form?.slug] }); // this post's own public page
      setTimeout(() => setStatus(null), 2500);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
  });

  if (!form) return <DashboardShell><div className="p-10 text-sm text-muted-foreground">Loading post…</div></DashboardShell>;

  function set<K extends keyof Draft>(key: K) {
    return (value: Draft[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function insertAtCursor(before: string, after = "", block = false) {
    const el = textRef.current;
    const current = form?.content_md ?? "";
    if (!el) {
      setForm((prev) => (prev ? { ...prev, content_md: `${current}\n${before}${after}` } : prev));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = current.slice(start, end);
    const insertion = block ? `${before}${selected}` : `${before}${selected}${after}`;
    const next = current.slice(0, start) + insertion + current.slice(end);
    setForm((prev) => (prev ? { ...prev, content_md: next } : prev));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + insertion.length - (block ? 0 : after.length);
      el.setSelectionRange(caret, caret);
    });
  }

  function filenameToAlt(name: string): string {
    const base = name.replace(/\.[a-zA-Z0-9]+$/, "").replace(/[-_]+/g, " ").trim();
    if (!base) return "";
    return base.charAt(0).toUpperCase() + base.slice(1);
  }

  async function insertImageFile(file: File | undefined) {
    if (!file) return;
    setInserting(true);
    try {
      const res = await api.upload<{ url: string }>("/media/upload", file);
      const alt = filenameToAlt(file.name);
      insertAtCursor(`\n![${alt}](${res.url})\n`, "", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setInserting(false);
    }
  }

  const isPublished = form.status === "published";

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-7xl px-5 pb-16 sm:px-6">
        <div className="sticky top-0 z-30 -mx-5 mb-6 border-b border-border bg-background px-5 py-4 sm:-mx-6 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link
                to="/dashboard"
                className="text-sm font-bold  text-muted-foreground transition-colors hover:text-primary"
              >
                All posts
              </Link>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-sm font-semibold capitalize ${
                  isPublished ? "border-primary/40 text-primary" : "border-border text-muted-foreground"
                }`}
              >
                {form.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status ? <span className="text-xs font-semibold text-primary">{status}</span> : null}
              <span className="hidden text-xs text-muted-foreground sm:inline">
                {words} words, about {Math.max(1, Math.round(words / 200))} min
              </span>
              <button
                onClick={() => save.mutate({})}
                disabled={save.isPending}
                className="btn-ghost"
              >
                {save.isPending ? "Saving…" : "Save"}
              </button>
              {isPublished ? (
                <button
                  onClick={() => save.mutate({ status: "draft" })}
                  className="rounded-md border border-border px-4 py-2 text-sm font-semibold transition-colors hover:border-destructive hover:text-destructive"
                >
                  Unpublish
                </button>
              ) : (
                <button
                  onClick={() => save.mutate({ status: "published" })}
                  className="btn"
                >
                  Publish
                </button>
              )}
            </div>
          </div>
        </div>

        {error ? <p className="mb-4 text-sm text-destructive">{error}</p> : null}

        <div className="mb-6 inline-flex rounded-md border border-border p-1">
          {(["write", "seo"] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                tab === key ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {key === "seo" ? "Search & sharing" : "Write"}
            </button>
          ))}
          {tab === "write" ? (
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className={`ml-auto rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                showPreview ? "bg-surface text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
          ) : null}
        </div>

        {tab === "write" ? (
          <div className={showPreview ? "grid gap-6 lg:grid-cols-[1fr_1fr]" : "grid gap-6"}>
            <div className="space-y-5">
              <UploadField
                label="Cover image"
                value={form.cover_url}
                onChange={set("cover_url")}
                hint="Wide images look best — around 1600×700."
              />

              <div>
                <input
                  value={form.title}
                  onChange={(e) => set("title")(e.target.value)}
                  placeholder="Post title"
                  className="w-full bg-transparent font-display text-3xl font-bold tracking-tighter outline-none placeholder:text-muted-foreground/40 sm:text-4xl"
                />
                <input
                  value={form.subtitle ?? ""}
                  onChange={(e) => set("subtitle")(e.target.value)}
                  placeholder="Subtitle (optional)"
                  className="mt-2 w-full bg-transparent text-lg text-muted-foreground outline-none placeholder:text-muted-foreground/50"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface p-1.5">
                {toolbar.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    title={action.title}
                    onClick={() => insertAtCursor(action.before, action.after ?? "", action.block)}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                  >
                    {action.label}
                  </button>
                ))}
                <label className="ml-auto cursor-pointer rounded-lg px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-background">
                  {inserting ? "Uploading…" : "Insert image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void insertImageFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropping(true);
                }}
                onDragLeave={() => setDropping(false)}
                onDrop={(e) => {
                  if (e.dataTransfer.files?.length) {
                    e.preventDefault();
                    setDropping(false);
                    void insertImageFile(e.dataTransfer.files[0]);
                  }
                }}
                className={`relative rounded-lg border transition-colors ${
                  dropping ? "border-primary bg-primary/5" : "border-border bg-card"
                }`}
              >
                <textarea
                  ref={textRef}
                  value={markdown}
                  onChange={(e) => set("content_md")(e.target.value)}
                  onPaste={(e) => {
                    const file = Array.from(e.clipboardData.files ?? [])[0];
                    if (file && file.type.startsWith("image/")) {
                      e.preventDefault();
                      void insertImageFile(file);
                    }
                  }}
                  placeholder="Write in Markdown… drop or paste an image anywhere."
                  className={`w-full resize-y rounded-lg bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none sm:p-5 ${
                    showPreview ? "min-h-[45vh] sm:min-h-[60vh]" : "min-h-[55vh] sm:min-h-[75vh]"
                  }`}
                />
                {dropping ? (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg text-sm font-bold text-primary">
                    Drop to upload
                  </div>
                ) : null}
              </div>
            </div>

            {showPreview ? (
              <div className="lg:sticky lg:top-28 lg:h-fit">
                <div className="overflow-hidden rounded-lg border border-border bg-card">
                  <p className="border-b border-border px-6 py-3 text-sm font-bold  text-muted-foreground">
                    Live preview
                  </p>
                  <div className="max-h-[72vh] overflow-auto p-6">
                    {form.cover_url ? (
                      <img src={form.cover_url} alt={form.title || "Cover"} className="mb-6 aspect-[16/7] w-full rounded-md object-cover" />
                    ) : null}
                    <h1 className="break-words font-display text-3xl font-bold leading-tight tracking-tighter sm:text-4xl">
                      {form.title || "Untitled post"}
                    </h1>
                    {form.subtitle ? <p className="mt-3 text-lg text-muted-foreground">{form.subtitle}</p> : null}
                    <div className="prose-journal mt-6" dangerouslySetInnerHTML={{ __html: preview }} />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
            <div className={`${cardClass} space-y-5`}>
              <div>
                <label className={labelClass}>Address</label>
                <input className={fieldClass} value={form.slug} onChange={(e) => set("slug")(e.target.value)} />
                <p className="mt-1.5 text-xs text-muted-foreground">/posts/{form.slug}</p>
              </div>
              <div>
                <label className={labelClass}>Search title</label>
                <input
                  className={fieldClass}
                  value={form.meta_title ?? ""}
                  onChange={(e) => set("meta_title")(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {(form.meta_title ?? form.title ?? "").length} / 60
                </p>
              </div>
              <div>
                <label className={labelClass}>Search description</label>
                <textarea
                  rows={3}
                  className={fieldClass}
                  value={form.meta_description ?? ""}
                  onChange={(e) => set("meta_description")(e.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">{(form.meta_description ?? "").length} / 160</p>
              </div>
              <div>
                <label className={labelClass}>Excerpt</label>
                <textarea
                  rows={2}
                  className={fieldClass}
                  value={form.excerpt ?? ""}
                  onChange={(e) => set("excerpt")(e.target.value)}
                />
              </div>
              <UploadField label="Share image" value={form.og_image} onChange={set("og_image")} hint="1200×630 recommended." />
              <div>
                <label className={labelClass}>Canonical URL</label>
                <input
                  className={fieldClass}
                  value={form.canonical_url ?? ""}
                  onChange={(e) => set("canonical_url")(e.target.value)}
                  placeholder="Only if first published elsewhere"
                />
              </div>
              <div className="flex flex-wrap gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.featured)}
                    onChange={(e) => set("featured")(e.target.checked)}
                  />
                  Feature on the home page
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(form.noindex)}
                    onChange={(e) => set("noindex")(e.target.checked)}
                  />
                  Hide from search engines
                </label>
              </div>
              <div>
                <label className={labelClass}>Topics</label>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {(query.data?.tags ?? []).map((tag) => {
                    const on = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setTagIds(on ? tagIds.filter((t) => t !== tag.id) : [...tagIds, tag.id])}
                        className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${
                          on
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary"
                        }`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                  {(query.data?.tags ?? []).length === 0 ? (
                    <Link to="/dashboard/tags" className="text-xs text-primary underline underline-offset-2">
                      Create your first topic
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-card p-5">
                <p className={labelClass}>Google preview</p>
                <p className="mt-3 truncate text-xs text-muted-foreground">yoursite.com › posts › {form.slug}</p>
                <p className="mt-1 text-lg leading-snug text-primary">
                  {form.meta_title || form.title}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {form.meta_description || form.excerpt || "Add a description to control this text."}
                </p>
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-card">
                <p className={`${labelClass} px-5 pt-5`}>Social preview</p>
                <div className="mt-3">
                  {form.og_image || form.cover_url ? (
                    <img src={form.og_image || form.cover_url || ""} alt="" className="aspect-[1200/630] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[1200/630] items-center justify-center bg-surface text-xs text-muted-foreground">
                      No share image
                    </div>
                  )}
                  <div className="p-5">
                    <p className="text-sm font-bold">{form.meta_title || form.title}</p>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {form.meta_description || form.excerpt}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
