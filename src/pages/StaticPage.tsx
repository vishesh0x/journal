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
      <article className="container">
        <header className="row-2 hero-row" style={{ paddingBottom: "var(--space-xl)" }}>
          <h1 className="display">{page.title}</h1>
          {page.subtitle ? <p className="lead">{page.subtitle}</p> : null}
        </header>

        <div className="band row-2">
          <p className="small sticky-head">
            Updated {new Date(page.updated_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </p>
          <div style={{ maxWidth: "68ch" }}>
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
        <div className="container">
          <div className="tile tone-a flex max-w-2xl flex-col gap-5">
            <h1 className="h-section">This page doesn’t exist</h1>
            <Link to="/" className="btn self-start">
              Back home
            </Link>
          </div>
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
