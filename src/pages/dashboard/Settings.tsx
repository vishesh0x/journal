import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Check, Image as ImageIcon, Loader, Mail, Save, Search, UserRound } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { Field, Icon, PageHead, Section, Select, TextArea, Toggle } from "@/components/dash";
import { UploadField } from "@/components/upload-field";
import { api, SOCIAL_PLATFORMS, type SiteSettings } from "@/lib/api";

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

  if (!form)
    return (
      <DashboardShell>
        <p className="dash-main muted">Loading settings…</p>
      </DashboardShell>
    );

  function set<K extends keyof SiteSettings>(key: K) {
    return (value: SiteSettings[K]) => setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }
  const text = (key: keyof SiteSettings) => (e: { target: { value: string } }) => set(key)(e.target.value as never);

  const social = form.social_links ?? {};
  function setSocial(key: string, value: string) {
    set("social_links")({ ...social, [key]: value });
  }

  return (
    <DashboardShell>
      <div className="dash-main narrow">
        <PageHead
          title="Settings"
          hint="Everything readers see, in one place."
          action={
            <div className="flex items-center gap-3">
              {saved ? (
                <span role="status" className="inline-flex items-center gap-1 font-bold" style={{ color: "var(--color-success)" }}>
                  <Icon as={Check} /> Saved
                </span>
              ) : null}
              <button type="button" onClick={() => save.mutate()} disabled={save.isPending} className="btn">
                <Icon as={save.isPending ? Loader : Save} /> {save.isPending ? "Saving…" : "Save changes"}
              </button>
            </div>
          }
        />
        {error ? (
          <p role="alert" className="notice mb-4">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col gap-6">
          <Section title="Identity" icon={ImageIcon}>
            <Field id="s-name" label="Site name" value={form.site_name} maxLength={80} onChange={text("site_name")} />
            <Field id="s-tag" label="Tagline" value={form.tagline} maxLength={160} onChange={text("tagline")} hint="Shown huge on the home page. Shorter reads better." />
            <TextArea id="s-desc" label="Description" rows={3} value={form.description} onChange={text("description")} />
            <div className="form-grid two">
              <UploadField label="Logo" value={form.logo_url} onChange={set("logo_url")} />
              <UploadField label="Favicon" value={form.favicon_url} onChange={set("favicon_url")} hint="SVG or a square PNG works best." />
            </div>
            <div className="form-grid two">
              <Select id="s-theme" label="Default theme" value={form.theme_mode} onChange={text("theme_mode")}>
                <option value="system">Follow the device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </Select>
              <Field id="s-ppp" label="Posts per page" type="number" min={1} max={50} value={form.posts_per_page} onChange={(e) => set("posts_per_page")(Number(e.target.value))} />
            </div>
            <Toggle
              id="s-resize"
              label="Resize and compress images automatically"
              hint="Uses Cloudflare Image Resizing; originals stay in R2. Turn it on only after enabling it for your domain (Cloudflare dashboard, your domain, Speed, Optimization). It generally needs a real custom domain. Turned on too early, it breaks every image."
              checked={Boolean(form.image_resizing_enabled)}
              onChange={(v) => set("image_resizing_enabled")(v ? 1 : 0)}
            />
            <Field id="s-foot" label="Footer text" value={form.footer_text} onChange={text("footer_text")} />
          </Section>

          <Section title="About you" icon={UserRound}>
            <div className="form-grid two">
              <Field id="s-author" label="Name" value={form.author_name} maxLength={80} onChange={text("author_name")} />
              <UploadField label="Portrait" preview="square" value={form.author_avatar_url} onChange={set("author_avatar_url")} />
            </div>
            <TextArea id="s-bio" label="Short bio" rows={2} value={form.author_bio} onChange={text("author_bio")} hint="Shown beside the tagline. Keep it to a sentence or two." />
            <TextArea id="s-about" label="About page in Markdown" rows={10} className="field code-area" value={form.about_markdown} onChange={text("about_markdown")} />
            <div className="form-grid two">
              {SOCIAL_PLATFORMS.map((key) => (
                <Field
                  key={key}
                  id={`s-social-${key}`}
                  label={key.charAt(0).toUpperCase() + key.slice(1)}
                  value={social[key] ?? ""}
                  onChange={(e) => setSocial(key, e.target.value)}
                  placeholder={key === "email" ? "you@example.com" : "https://"}
                />
              ))}
            </div>
          </Section>

          <Section title="Newsletter" icon={Mail}>
            <Toggle id="s-news" label="Show the sign-up form on the site" checked={Boolean(form.newsletter_enabled)} onChange={(v) => set("newsletter_enabled")(v ? 1 : 0)} />
            <Field id="s-news-h" label="Headline" value={form.newsletter_headline} onChange={text("newsletter_headline")} />
            <TextArea id="s-news-b" label="Blurb" rows={2} value={form.newsletter_blurb} onChange={text("newsletter_blurb")} />
          </Section>

          <Section title="Search and sharing" icon={Search}>
            <Field id="s-mt" label="Default meta title" value={form.default_meta_title ?? ""} onChange={text("default_meta_title")} />
            <TextArea id="s-md" label="Default meta description" rows={2} value={form.default_meta_description ?? ""} onChange={text("default_meta_description")} />
            <UploadField label="Default share image" value={form.default_og_image} onChange={set("default_og_image")} hint="1200 by 630 in PNG or JPEG looks best in social previews." />
          </Section>

          <Section title="Analytics" icon={BarChart3}>
            <TextArea
              id="s-an"
              label="Analytics snippet"
              rows={3}
              className="field code-area"
              value={form.analytics_script ?? ""}
              onChange={text("analytics_script")}
              placeholder="<script>…</script>"
              hint="Added to every public page. While this is filled in, the site allows the scripts it loads; leave it blank for the strictest security policy."
            />
          </Section>
        </div>
      </div>
    </DashboardShell>
  );
}
