import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, SOCIAL_PLATFORMS, type SiteSettings, type StaticPageSummary } from "@/lib/api";
import { decodeEmail } from "@/lib/obfuscate";
import { ThemeToggle } from "./theme-toggle";

const SOCIAL_LABELS: Record<string, string> = {
  twitter: "Twitter",
  github: "GitHub",
  linkedin: "LinkedIn",
  instagram: "Instagram",
  mastodon: "Mastodon",
  website: "Website",
  email: "Email",
};

const navLink =
  "border-b-2 border-transparent pb-0.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-primary aria-[current=page]:border-primary aria-[current=page]:text-foreground";

const metaLink =
  "text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-primary";

export function pagePath(slug: string) {
  if (slug === "privacy") return "/privacy";
  if (slug === "terms") return "/terms";
  return `/p/${slug}`;
}

export function SiteShell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { data: settings } = useQuery({
    queryKey: ["settings", "public"],
    queryFn: () => api.get<SiteSettings>("/settings"),
  });
  const { data: pages } = useQuery({
    queryKey: ["pages", "public"],
    queryFn: () => api.get<StaticPageSummary[]>("/pages"),
  });

  const navPages = (pages ?? []).filter((p) => p.show_in_nav);
  const footerPages = (pages ?? []).filter((p) => p.show_in_footer);

  useEffect(() => {
    if (settings?.accent) document.documentElement.style.setProperty("--primary", settings.accent);
    if (settings?.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = settings.favicon_url;
    }
  }, [settings?.accent, settings?.favicon_url]);

  useEffect(() => {
    if (!settings?.analytics_script) return;
    const marker = "data-journal-analytics";
    if (document.querySelector(`[${marker}]`)) return;
    const container = document.createElement("div");
    container.innerHTML = settings.analytics_script;
    const nodes = Array.from(container.childNodes);
    nodes.forEach((node) => {
      if (node instanceof HTMLScriptElement) {
        const script = document.createElement("script");
        Array.from(node.attributes).forEach((attr) => script.setAttribute(attr.name, attr.value));
        script.text = node.text;
        script.setAttribute(marker, "true");
        document.head.appendChild(script);
      } else {
        (node as HTMLElement).setAttribute?.(marker, "true");
        document.head.appendChild(node);
      }
    });
  }, [settings?.analytics_script]);

  const navItems = (
    <>
      <NavLink to="/" end className={({ isActive }) => `${navLink} ${isActive ? "border-primary text-foreground" : ""}`}>
        Writing
      </NavLink>
      <NavLink to="/archive" className={({ isActive }) => `${navLink} ${isActive ? "border-primary text-foreground" : ""}`}>
        Archive
      </NavLink>
      <NavLink to="/about" className={({ isActive }) => `${navLink} ${isActive ? "border-primary text-foreground" : ""}`}>
        About
      </NavLink>
      {navPages.map((page) => (
        <Link key={page.id} to={pagePath(page.slug)} className={navLink}>
          {page.title}
        </Link>
      ))}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-20 w-full max-w-6xl items-baseline justify-between gap-4 px-5 pt-6 sm:px-6">
          <Link to="/" className="flex items-baseline gap-2.5 min-w-0">
            {settings?.logo_url ? <img src={settings.logo_url} alt="" className="h-6 w-auto self-center" /> : null}
            <span className="truncate font-display text-xl font-bold tracking-tighter sm:text-2xl">
              {settings?.site_name ?? "Journal"}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex md:gap-9">
            {navItems}
            <Link
              to="/search"
              aria-label="Search"
              className="text-muted-foreground transition-colors hover:text-primary"
            >
              ⌕
            </Link>
            <ThemeToggle defaultMode={settings?.theme_mode} />
          </nav>

          {/* Mobile controls */}
          <div className="flex items-center gap-2 md:hidden">
            <Link
              to="/search"
              aria-label="Search"
              className="grid size-9 place-items-center text-lg text-muted-foreground transition-colors hover:text-primary"
            >
              ⌕
            </Link>
            <ThemeToggle defaultMode={settings?.theme_mode} />
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              className="grid size-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <span className="text-base leading-none">{menuOpen ? "✕" : "☰"}</span>
            </button>
          </div>
        </div>

        {menuOpen && (
          <nav className="flex flex-col gap-4 border-t border-border bg-background px-5 py-5 md:hidden">
            {navItems}
          </nav>
        )}
      </header>

      <main className="flex-1 pt-10 sm:pt-16">{children}</main>

      <footer className="mt-24 border-t border-border sm:mt-32">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <p className="font-display text-xl font-bold tracking-tighter">{settings?.site_name ?? "Journal"}</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {settings?.description || settings?.tagline}
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Elsewhere</p>
            {SOCIAL_PLATFORMS.some((key) => settings?.social_links?.[key]) ? (
              SOCIAL_PLATFORMS.filter((key) => settings?.social_links?.[key]).map((key) => {
                const raw = settings!.social_links[key]!;
                const value = key === "email" ? decodeEmail(raw) : raw;
                const href = key === "email" ? (value.startsWith("mailto:") ? value : `mailto:${value}`) : value;
                return (
                  <a key={key} href={href} target="_blank" rel="noreferrer" className={metaLink}>
                    {SOCIAL_LABELS[key] ?? key}
                  </a>
                );
              })
            ) : (
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">No links yet</span>
            )}
            <a href="/rss.xml" className={metaLink}>
              RSS feed
            </a>
          </div>
          <div className="flex flex-col gap-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Fine print</p>
            {footerPages.map((page) => (
              <Link key={page.id} to={pagePath(page.slug)} className={metaLink}>
                {page.title}
              </Link>
            ))}
            <Link to="/about" className={metaLink}>
              About
            </Link>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl border-t border-border px-5 py-6 sm:px-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {settings?.footer_text ||
              `© ${new Date().getFullYear()} ${settings?.author_name || settings?.site_name || "Journal"}`}
          </p>
        </div>
      </footer>
    </div>
  );
}
