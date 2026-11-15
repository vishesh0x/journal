import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { MarkdownContent } from "@/components/markdown-content";
import { ErrorState } from "@/components/error-state";
import { PageSkeleton } from "@/components/skeletons";
import { useDocumentMeta } from "@/lib/head";
import { optimizedImageUrl } from "@/lib/image";
import { api, type SiteSettings } from "@/lib/api";

export default function About() {
  const query = useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<SiteSettings>("/settings"),
  });
  const settings = query.data;

  useDocumentMeta({
    title: settings ? `About, ${settings.site_name}` : undefined,
    description: settings?.author_bio || settings?.description,
    image: settings?.author_avatar_url || settings?.default_og_image,
  });

  if (query.isError) {
    return (
      <SiteShell>
        <ErrorState onRetry={() => query.refetch()} />
      </SiteShell>
    );
  }

  if (!settings) {
    return (
      <SiteShell>
        <PageSkeleton />
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <div className="flex flex-col gap-6">
            <h1 className="display">{settings.author_name}</h1>
            {settings.author_bio ? <p className="lead">{settings.author_bio}</p> : null}
          </div>
          {settings.author_avatar_url ? (
            <img
              src={optimizedImageUrl(settings.author_avatar_url, { width: 480 }, settings.image_resizing_enabled) ?? undefined}
              alt={settings.author_name}
              className="portrait"
              style={{ maxWidth: "20rem" }}
            />
          ) : null}
        </header>
        <div className="band row-2">
          <h2 className="h-section sticky-head">The longer version</h2>
          <MarkdownContent markdown={settings.about_markdown} className="max-w-[68ch]" />
        </div>
      </div>
    </SiteShell>
  );
}
