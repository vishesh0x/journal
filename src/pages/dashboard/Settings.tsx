import { useEffect, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard-shell";
import { UploadField } from "@/components/upload-field";
import { api, SOCIAL_PLATFORMS, type SiteSettings } from "@/lib/api";

const fieldClass =
  "mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";
const labelClass = "block text-xs font-medium  text-muted-foreground";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 sm:p-6">
      <h2 className="font-display text-xl tracking-tight">{title}</h2>
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["admin-settings"], queryFn: () => api.get<SiteSettings>("/settings/admin") });
  const [form, setForm] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data && !form) setForm({ ...settings.data });
  }, [settings.data, form]);

  const save = useMutation({
    mutationFn: () => api.put("/settings/admin", form),
    onSuccess: () => {
      setSaved(true);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["settings", "public"] });
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not save."),
  });

  if (!form) return <DashboardShell><div className="p-10 text-sm text-muted-foreground">Loading settings…</div></DashboardShell>;

  function set<K extends keyof SiteSettings>(key: K) {
    return (value: SiteSettings[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const social = form.social_links ?? {};
  function setSocial(key: string, value: string) {
    set("social_links")({ ...social, [key]: value });
  }

  return (
    <DashboardShell>
      <div className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl tracking-tight sm:text-3xl">Settings</h1>
            <p className="mt-1 text-sm text-muted-foreground">Everything readers see, in one place.</p>
          </div>
          <div className="flex items-center gap-3">
            {saved ? <span className="text-sm text-primary">Saved</span> : null}
            <button
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="btn"
            >
              {save.isPending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <div className="mt-8 space-y-5">
          <Section title="Identity">
            <div>
              <label className={labelClass}>Site name</label>
              <input className={fieldClass} value={form.site_name} onChange={(e) => set("site_name")(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Tagline</label>
              <input className={fieldClass} value={form.tagline} onChange={(e) => set("tagline")(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                rows={3}
                className={fieldClass}
                value={form.description}
                onChange={(e) => set("description")(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <UploadField label="Logo" value={form.logo_url} onChange={set("logo_url")} />
              <UploadField label="Favicon" value={form.favicon_url} onChange={set("favicon_url")} hint="Square PNG works best." />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Accent colour</label>
                <div className="mt-1.5 flex items-center gap-3">
                  <input
                    type="color"
                    className="h-10 w-20 cursor-pointer rounded-md border border-border bg-background p-1"
                    value={/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(form.accent) ? form.accent : "#20294c"}
                    onChange={(e) => set("accent")(e.target.value)}
                  />
                  <span className="text-xs text-muted-foreground">{form.accent}</span>
                </div>
              </div>
              <div>
                <label className={labelClass}>Default theme</label>
                <select
                  className={fieldClass}
                  value={form.theme_mode}
                  onChange={(e) => set("theme_mode")(e.target.value as SiteSettings["theme_mode"])}
                >
                  <option value="system">Follow device</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              </div>
            </div>
            <div className="rounded-md border border-border p-4">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-medium">Resize &amp; compress images automatically</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    Uses Cloudflare's Image Resizing to shrink and compress images on the fly — originals stay in
                    R2 untouched. Only turn this on after confirming Image Resizing is enabled for your domain
                    (in the Cloudflare dashboard: your domain, then Speed, then Optimization) — it generally requires a real
                    custom domain, not a *.workers.dev URL. Turning this on before that's set up will break every
                    image on the site.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-0.5 shrink-0"
                  checked={Boolean(form.image_resizing_enabled)}
                  onChange={(e) => set("image_resizing_enabled")(e.target.checked ? 1 : 0)}
                />
              </label>
            </div>
            <div>
              <label className={labelClass}>Footer text</label>
              <input className={fieldClass} value={form.footer_text} onChange={(e) => set("footer_text")(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Posts per page</label>
              <input
                type="number"
                min={1}
                max={50}
                className={fieldClass}
                value={form.posts_per_page}
                onChange={(e) => set("posts_per_page")(Number(e.target.value))}
              />
            </div>
          </Section>

          <Section title="About you">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>Name</label>
                <input className={fieldClass} value={form.author_name} onChange={(e) => set("author_name")(e.target.value)} />
              </div>
              <UploadField label="Portrait" preview="square" value={form.author_avatar_url} onChange={set("author_avatar_url")} />
            </div>
            <div>
              <label className={labelClass}>Short bio</label>
              <textarea rows={2} className={fieldClass} value={form.author_bio} onChange={(e) => set("author_bio")(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>About page (Markdown)</label>
              <textarea
                rows={10}
                className={`${fieldClass} font-mono text-xs leading-relaxed`}
                value={form.about_markdown}
                onChange={(e) => set("about_markdown")(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {SOCIAL_PLATFORMS.map((key) => (
                <div key={key}>
                  <label className={`${labelClass} capitalize`}>{key}</label>
                  <input
                    className={fieldClass}
                    value={social[key] ?? ""}
                    onChange={(e) => setSocial(key, e.target.value)}
                    placeholder={key === "email" ? "you@example.com" : "https://…"}
                  />
                </div>
              ))}
            </div>
          </Section>

          <Section title="Newsletter">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.newsletter_enabled)}
                onChange={(e) => set("newsletter_enabled")(e.target.checked ? 1 : 0)}
              />
              Show the signup form on the site
            </label>
            <div>
              <label className={labelClass}>Headline</label>
              <input
                className={fieldClass}
                value={form.newsletter_headline}
                onChange={(e) => set("newsletter_headline")(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Blurb</label>
              <textarea
                rows={2}
                className={fieldClass}
                value={form.newsletter_blurb}
                onChange={(e) => set("newsletter_blurb")(e.target.value)}
              />
            </div>
          </Section>

          <Section title="Search & sharing">
            <div>
              <label className={labelClass}>Default meta title</label>
              <input
                className={fieldClass}
                value={form.default_meta_title ?? ""}
                onChange={(e) => set("default_meta_title")(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Default meta description</label>
              <textarea
                rows={2}
                className={fieldClass}
                value={form.default_meta_description ?? ""}
                onChange={(e) => set("default_meta_description")(e.target.value)}
              />
            </div>
            <UploadField
              label="Default share image"
              value={form.default_og_image}
              onChange={set("default_og_image")}
              hint="1200×630 looks best in social previews."
            />
            <div>
              <label className={labelClass}>Analytics snippet</label>
              <textarea
                rows={3}
                className={`${fieldClass} font-mono text-xs`}
                value={form.analytics_script ?? ""}
                onChange={(e) => set("analytics_script")(e.target.value)}
                placeholder="<script>…</script>"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Injected on every public page. Leave blank if you don’t use analytics.
              </p>
            </div>
          </Section>
        </div>
      </div>
    </DashboardShell>
  );
}
