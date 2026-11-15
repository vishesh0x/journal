import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Bold, CalendarDays, Check, Clock, Code, CodeXml, ExternalLink, EyeOff, Heading2, ImagePlus, Italic,
  Link2, List, ListOrdered, Loader, Minus, PanelRight, Quote, Save, Send, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Field, Icon, Section, StatusChip, TextArea, Toggle } from "@/components/dash";
import { MarkdownContent } from "@/components/markdown-content";
import { UploadField } from "@/components/upload-field";
import { optimizedImageUrl } from "@/lib/image";
import { api, type Tag } from "@/lib/api";

type Draft = {
  title: string;
  slug: string;
  subtitle: string | null;
  excerpt: string | null;
  content_md: string;
  cover_url: string | null;
  status: string;
  published_at: string | null;
  featured: boolean | number;
  meta_title: string | null;
  meta_description: string | null;
  og_image: string | null;
  canonical_url: string | null;
  noindex: boolean | number;
};

type ToolbarAction = { icon: LucideIcon; title: string; before: string; after?: string; block?: boolean };

const toolbar: ToolbarAction[] = [
  { icon: Heading2, title: "Heading", before: "\n## ", block: true },
  { icon: Bold, title: "Bold", before: "**", after: "**" },
  { icon: Italic, title: "Italic", before: "_", after: "_" },
  { icon: Quote, title: "Quote", before: "\n> ", block: true },
  { icon: List, title: "Bulleted list", before: "\n- ", block: true },
  { icon: ListOrdered, title: "Numbered list", before: "\n1. ", block: true },
  { icon: Code, title: "Inline code", before: "`", after: "`" },
  { icon: CodeXml, title: "Code block", before: "\n```js\n", after: "\n```\n" },
  { icon: Workflow, title: "Diagram (Mermaid)", before: "\n```mermaid\nflowchart LR\n  A[Idea] --> B[Draft] --> C[Publish]\n```\n", block: true },
  { icon: Link2, title: "Link", before: "[", after: "](https://)" },
  { icon: Minus, title: "Divider", before: "\n\n---\n\n", block: true },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not published yet";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

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
  const [tab, setTab] = useState<"write" | "details">("write");
  const [showPreview, setShowPreview] = useState(() => window.matchMedia("(min-width: 80rem)").matches);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inserting, setInserting] = useState(false);
  const [dropping, setDropping] = useState(false);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const saved = useRef<string>("");

  useEffect(() => {
    if (query.data && !form) {
      setForm({ ...query.data.post });
      setTagIds(query.data.tagIds);
      saved.current = JSON.stringify([query.data.post, query.data.tagIds]);
    }
  }, [query.data, form]);

  const dirty = form ? JSON.stringify([form, tagIds]) !== saved.current : false;
  const markdown = form?.content_md ?? "";
  const words = useMemo(() => markdown.trim().split(/\s+/).filter(Boolean).length, [markdown]);
  const allTags = query.data?.tags ?? [];
  const chosenTags = allTags.filter((t) => tagIds.includes(t.id));

  const save = useMutation({
    mutationFn: (overrides: Partial<Draft> = {}) => {
      const next = { ...(form as Draft), ...overrides };
      return api.put(`/posts/admin/${id}`, { ...next, tagIds }).then(() => next);
    },
    onSuccess: (next) => {
      setForm(next);
      saved.current = JSON.stringify([next, tagIds]);
      setError(null);
      setStatus("Saved");
      queryClient.invalidateQueries({ queryKey: ["admin-posts"] });
      queryClient.invalidateQueries({ queryKey: ["overview"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      queryClient.invalidateQueries({ queryKey: ["post", next.slug] });
      setTimeout(() => setStatus(null), 2500);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
  });

  const saveNow = useCallback(() => {
    if (form && !save.isPending) save.mutate({});
  }, [form, save]);

  // Ctrl/Cmd+S saves; leaving with unsaved edits asks first.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveNow();
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [dirty, saveNow]);

  if (!form)
    return (
      <DashboardShell>
        <p className="dash-main muted">Loading post…</p>
      </DashboardShell>
    );

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
    return base ? base.charAt(0).toUpperCase() + base.slice(1) : "";
  }

  async function insertImageFile(file: File | undefined) {
    if (!file) return;
    setInserting(true);
    try {
      const res = await api.upload<{ url: string }>("/media/upload", file);
      insertAtCursor(`\n![${filenameToAlt(file.name)}](${res.url})\n`, "", true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setInserting(false);
    }
  }

  const isPublished = form.status === "published";
  const shareImage = form.og_image || form.cover_url || "";
  const origin = typeof window !== "undefined" ? window.location.host : "yoursite.com";

  return (
    <DashboardShell>
      <div className="dash-main" style={{ maxWidth: "88rem", paddingTop: 0 }}>
        <div className="sticky-bar" style={{ marginInline: "calc(var(--space-lg) * -1)", padding: "var(--space-sm) var(--space-lg)" }}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <Link to="/dashboard" className="text-link inline-flex items-center gap-2" style={{ textDecoration: "none" }}>
                <Icon as={ArrowLeft} /> All posts
              </Link>
              <StatusChip on={isPublished}>{form.status}</StatusChip>
              {dirty ? <span className="small">Unsaved changes</span> : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {status ? (
                <span role="status" className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--color-success)" }}>
                  <Icon as={Check} /> {status}
                </span>
              ) : null}
              <span className="small hidden items-center gap-1 sm:inline-flex">
                <Icon as={Clock} size={15} /> {words} words, about {Math.max(1, Math.round(words / 200))} min
              </span>
              {isPublished ? (
                <a href={`/posts/${form.slug}`} target="_blank" rel="noreferrer" className="btn-ghost">
                  <Icon as={ExternalLink} /> View
                </a>
              ) : null}
              <button type="button" onClick={saveNow} disabled={save.isPending || !dirty} className="btn-ghost">
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

        <div className="my-6 flex flex-wrap items-center justify-between gap-3">
          <div className="seg" role="tablist" aria-label="Editor sections">
            <button type="button" role="tab" aria-selected={tab === "write"} onClick={() => setTab("write")}>
              Write
            </button>
            <button type="button" role="tab" aria-selected={tab === "details"} onClick={() => setTab("details")}>
              Details and sharing
            </button>
          </div>
          {tab === "write" ? (
            <button type="button" className="btn-ghost" aria-pressed={showPreview} onClick={() => setShowPreview((v) => !v)}>
              <Icon as={PanelRight} /> {showPreview ? "Hide preview" : "Show preview"}
            </button>
          ) : null}
        </div>

        {tab === "write" ? (
          <div className="grid gap-6" style={{ gridTemplateColumns: showPreview ? "repeat(auto-fit, minmax(min(100%, 30rem), 1fr))" : "minmax(0, 1fr)" }}>
            <div className="flex min-w-0 flex-col gap-5">
              <UploadField
                label="Cover image"
                value={form.cover_url}
                onChange={set("cover_url")}
                hint="Wide images look best, around 1600 by 700. It is cropped to fit."
              />

              <div>
                <label htmlFor="post-title" className="visually-hidden">
                  Post title
                </label>
                <textarea
                  id="post-title"
                  rows={1}
                  maxLength={300}
                  value={form.title}
                  onChange={(e) => set("title")(e.target.value.replace(/\n/g, " "))}
                  placeholder="Post title"
                  className="editor-title"
                  style={{ resize: "none", fieldSizing: "content" } as React.CSSProperties}
                />
                <label htmlFor="post-subtitle" className="visually-hidden">
                  Subtitle
                </label>
                <input
                  id="post-subtitle"
                  value={form.subtitle ?? ""}
                  maxLength={300}
                  onChange={(e) => set("subtitle")(e.target.value)}
                  placeholder="Subtitle (optional)"
                  className="editor-sub"
                />
              </div>

              <div>
                <p className="form-label">Topics</p>
                <div className="chips">
                  {allTags.map((tag) => {
                    const on = tagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTagIds(on ? tagIds.filter((t) => t !== tag.id) : [...tagIds, tag.id])}
                        className={`chip ${on ? "chip-on" : ""}`}
                        style={{ cursor: "pointer", background: on ? undefined : "transparent", color: on ? undefined : "var(--color-ink)" }}
                      >
                        {on ? <Icon as={Check} size={14} /> : null}
                        {tag.name}
                      </button>
                    );
                  })}
                  {allTags.length === 0 ? (
                    <Link to="/dashboard/tags" className="text-link">
                      Create your first topic
                    </Link>
                  ) : null}
                </div>
              </div>

              <div className="toolbar" role="toolbar" aria-label="Formatting">
                {toolbar.map((action) => (
                  <button
                    key={action.title}
                    type="button"
                    title={action.title}
                    aria-label={action.title}
                    onClick={() => insertAtCursor(action.before, action.after ?? "", action.block)}
                    className="tool-btn"
                  >
                    <Icon as={action.icon} />
                  </button>
                ))}
                <label className="tool-btn ml-auto" title="Insert image" style={{ cursor: "pointer" }}>
                  <Icon as={inserting ? Loader : ImagePlus} />
                  <span className="visually-hidden">Insert image</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/svg+xml"
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
                className="panel"
                style={dropping ? { background: "var(--color-paper-3)", borderStyle: "dashed" } : undefined}
              >
                <label htmlFor="post-body" className="visually-hidden">
                  Post body in Markdown
                </label>
                <textarea
                  id="post-body"
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
                  placeholder="Write in Markdown. Drop or paste an image anywhere."
                  spellCheck
                  className="editor-area code-area"
                  style={{ minHeight: "60svh" }}
                />
              </div>
            </div>

            {showPreview ? (
              <aside aria-label="Live preview" className="min-w-0">
                <div className="panel preview-pane lg:sticky" style={{ top: "5.5rem" }}>
                  <h2 className="visually-hidden">Preview, as readers see it</h2>
                  <article style={{ padding: "var(--space-lg)" }}>
                    <h1 className="display-s" style={{ fontSize: "var(--text-section)", overflowWrap: "anywhere" }}>
                      {form.title || "Untitled post"}
                    </h1>
                    {form.subtitle ? <p className="lead mt-4">{form.subtitle}</p> : null}
                    <div className="meta mt-4">
                      <span>
                        <Icon as={CalendarDays} size={15} />
                        <time>{formatDate(form.published_at)}</time>
                      </span>
                      <span>
                        <Icon as={Clock} size={15} /> {Math.max(1, Math.round(words / 200))} min read
                      </span>
                    </div>
                    {chosenTags.length ? (
                      <div className="chips mt-4">
                        {chosenTags.map((tag) => (
                          <span key={tag.id} className="chip">
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {form.cover_url ? (
                      <img src={optimizedImageUrl(form.cover_url, { width: 1200 }, false) ?? undefined} alt="" className="cover mt-6" />
                    ) : null}
                    <MarkdownContent markdown={markdown} className="mt-6" />
                  </article>
                </div>
              </aside>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
            <div className="flex min-w-0 flex-col gap-6">
              <Section title="Publishing">
                <div className="form-grid two">
                  <Field id="post-slug" label="Address" value={form.slug} onChange={(e) => set("slug")(e.target.value)} hint={`/posts/${form.slug}`} />
                  <Field
                    id="post-date"
                    label="Publish date"
                    type="datetime-local"
                    value={toLocalInput(form.published_at)}
                    onChange={(e) => set("published_at")(e.target.value ? new Date(e.target.value).toISOString() : null)}
                    hint="A date in the future schedules the post: it goes live then."
                  />
                </div>
                <Toggle id="post-featured" label="Pin to the top of the home page" checked={Boolean(form.featured)} onChange={set("featured")} />
              </Section>

              <Section title="Search and sharing">
                <Field
                  id="post-meta-title"
                  label="Search title"
                  value={form.meta_title ?? ""}
                  onChange={(e) => set("meta_title")(e.target.value)}
                  hint={`${(form.meta_title ?? form.title ?? "").length} of 60 characters`}
                />
                <TextArea
                  id="post-meta-desc"
                  label="Search description"
                  rows={3}
                  value={form.meta_description ?? ""}
                  onChange={(e) => set("meta_description")(e.target.value)}
                  hint={`${(form.meta_description ?? "").length} of 160 characters`}
                />
                <TextArea
                  id="post-excerpt"
                  label="Excerpt"
                  rows={2}
                  value={form.excerpt ?? ""}
                  onChange={(e) => set("excerpt")(e.target.value)}
                  hint="Shown on tiles and in the feed. Left empty, it is taken from the start of the post."
                />
                <UploadField
                  label="Share image"
                  value={form.og_image}
                  onChange={set("og_image")}
                  hint="1200 by 630 works best. Use PNG or JPEG: most social sites ignore SVG."
                />
                <Field
                  id="post-canonical"
                  label="Canonical URL"
                  value={form.canonical_url ?? ""}
                  onChange={(e) => set("canonical_url")(e.target.value)}
                  placeholder="Only if first published elsewhere"
                />
                <Toggle id="post-noindex" label="Hide from search engines" checked={Boolean(form.noindex)} onChange={set("noindex")} />
              </Section>
            </div>

            <div className="flex min-w-0 flex-col gap-6">
              <section className="section-card">
                <h2>Search result</h2>
                <div>
                  <p className="small truncate">{origin} / posts / {form.slug}</p>
                  <p className="mt-1 text-lg font-bold" style={{ color: "var(--color-signal)", overflowWrap: "anywhere" }}>
                    {form.meta_title || form.title || "Untitled post"}
                  </p>
                  <p className="small mt-1 line-clamp-2">{form.meta_description || form.excerpt || "Add a description to control this text."}</p>
                </div>
              </section>
              <section className="section-card" style={{ overflow: "hidden" }}>
                <h2>Social card</h2>
                {shareImage ? (
                  <img src={shareImage} alt="" className="cover" style={{ aspectRatio: "1200 / 630", borderRadius: "var(--radius-panel)" }} />
                ) : (
                  <div className="drop" style={{ aspectRatio: "1200 / 630", cursor: "default" }}>
                    <span className="small">No share image yet</span>
                  </div>
                )}
                <div>
                  <p className="font-bold" style={{ overflowWrap: "anywhere" }}>{form.meta_title || form.title}</p>
                  <p className="small mt-1 line-clamp-2">{form.meta_description || form.excerpt}</p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
