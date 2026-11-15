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
    title: settings ? `About · ${settings.site_name}` : undefined,
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
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="grid grid-cols-12 items-end gap-6 pb-12 sm:gap-8 sm:pb-16">
          <div className="col-span-12 lg:col-span-8">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">About</p>
            <h1 className="mt-5 break-words font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
              {settings.author_name}
            </h1>
            {settings.author_bio ? (
              <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {settings.author_bio}
              </p>
            ) : null}
          </div>
          {settings.author_avatar_url ? (
            <div className="col-span-12 lg:col-span-4">
              <img
                src={optimizedImageUrl(settings.author_avatar_url, { width: 480 }, settings.image_resizing_enabled) ?? undefined}
                alt={settings.author_name}
                className="aspect-square w-32 object-cover grayscale transition-all duration-700 ease-out hover:grayscale-0 sm:w-40 lg:w-full"
              />
            </div>
          ) : null}
        </header>
        <div className="grid grid-cols-12 gap-6 border-t border-border pt-10 sm:gap-8 sm:pt-14">
          <p className="col-span-12 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground lg:col-span-4">
            The longer version
          </p>
          <div className="col-span-12 lg:col-span-8">
            <MarkdownContent markdown={settings.about_markdown} className="max-w-[68ch]" />
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
