import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SiteShell } from "@/components/site-shell";
import { MarkdownContent } from "@/components/markdown-content";
import { PageSkeleton } from "@/components/skeletons";
import { useDocumentMeta } from "@/lib/head";
import { api, type StaticPageFull } from "@/lib/api";

function StaticPageBody({ page }: { page: StaticPageFull }) {
  useDocumentMeta({
    title: page.meta_title || page.title,
    description: page.meta_description || page.subtitle,
    noindex: page.noindex,
  });

  return (
    <SiteShell>
      <article className="mx-auto w-full max-w-6xl px-5 sm:px-6">
        <header className="max-w-3xl pb-10 sm:pb-14">
          {page.eyebrow ? (
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{page.eyebrow}</p>
          ) : null}
          <h1 className="mt-5 break-words font-display text-4xl font-bold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            {page.title}
          </h1>
          {page.subtitle ? (
            <p className="mt-6 text-base leading-relaxed text-muted-foreground sm:text-lg">{page.subtitle}</p>
          ) : null}
        </header>

        <div className="grid gap-8 border-t border-border pt-10 sm:gap-12 sm:pt-14 lg:grid-cols-[1fr_2fr]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Updated {new Date(page.updated_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <div className="max-w-2xl">
            <MarkdownContent markdown={page.content_md} />
          </div>
        </div>
      </article>
    </SiteShell>
  );
}

function StaticPageBySlug({ slug }: { slug: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["page", slug],
    queryFn: () => api.get<StaticPageFull>(`/pages/by-slug/${slug}`),
    retry: false,
  });

  if (isLoading) {
    return (
      <SiteShell>
        <PageSkeleton />
      </SiteShell>
    );
  }

  if (error || !data) {
    return (
      <SiteShell>
        <div className="mx-auto max-w-6xl px-5 py-24 text-center sm:px-6">
          <h1 className="font-display text-3xl font-bold tracking-tighter">This page doesn't exist</h1>
          <Link to="/" className="mt-6 inline-block text-primary underline underline-offset-2">
            Back home
          </Link>
        </div>
      </SiteShell>
    );
  }

  return <StaticPageBody page={data} />;
}

export default function CustomPage() {
  const { slug } = useParams<{ slug: string }>();
  return <StaticPageBySlug slug={slug ?? ""} />;
}

export function PrivacyPage() {
  return <StaticPageBySlug slug="privacy" />;
}

export function TermsPage() {
  return <StaticPageBySlug slug="terms" />;
}
