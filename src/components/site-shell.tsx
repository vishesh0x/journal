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
    // "#c4633c" is the old terracotta default; treat it as unset so the new navy signal shows
    if (settings?.accent && settings.accent.toLowerCase() !== "#c4633c") {
      document.documentElement.style.setProperty("--primary", settings.accent);
    }
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

  const closeMenu = () => setMenuOpen(false);

  const navItems = (
    <>
      <NavLink to="/" end className="nav-link" onClick={closeMenu}>
        Writing
      </NavLink>
      <NavLink to="/archive" className="nav-link" onClick={closeMenu}>
        Archive
      </NavLink>
      <NavLink to="/about" className="nav-link" onClick={closeMenu}>
        About
      </NavLink>
      {navPages.map((page) => (
        <NavLink key={page.id} to={pagePath(page.slug)} className="nav-link" onClick={closeMenu}>
          {page.title}
        </NavLink>
      ))}
      <NavLink to="/search" className="nav-link" onClick={closeMenu}>
        Search
      </NavLink>
    </>
  );

  const siteName = settings?.site_name ?? "Journal";
  const socials = SOCIAL_PLATFORMS.filter((key) => settings?.social_links?.[key]);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="site-header">
        <div className="container">
          <div className="nav">
            <Link to="/" className="nav-brand wordmark">
              {settings?.logo_url ? <img src={settings.logo_url} alt="" /> : null}
              <span>{siteName}</span>
            </Link>

            <nav aria-label="Main" className="nav-links">
              {navItems}
              <ThemeToggle defaultMode={settings?.theme_mode} />
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle defaultMode={settings?.theme_mode} />
              <button
                type="button"
                className="nav-btn nav-menu-btn"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? "Close" : "Menu"}
              </button>
            </div>
          </div>

          {menuOpen ? (
            <nav id="mobile-menu" aria-label="Mobile" className="nav nav-panel">
              {navItems}
            </nav>
          ) : null}
        </div>
      </header>

      <main className="page-main flex-1">{children}</main>

      <footer className="site-footer">
        <div className="container">
          <div className="foot-grid">
            <div>
              <p className="wordmark mast">{siteName}</p>
              {settings?.description || settings?.tagline ? (
                <p className="muted mt-5 max-w-sm">{settings?.description || settings?.tagline}</p>
              ) : null}
            </div>
            <div className="foot-col">
              <h2>Elsewhere</h2>
              {socials.length ? (
                socials.map((key) => {
                  const raw = settings!.social_links[key]!;
                  const value = key === "email" ? decodeEmail(raw) : raw;
                  const href = key === "email" ? (value.startsWith("mailto:") ? value : `mailto:${value}`) : value;
                  return (
                    <a key={key} href={href} target="_blank" rel="noreferrer" className="text-link">
                      {SOCIAL_LABELS[key] ?? key}
                    </a>
                  );
                })
              ) : (
                <span className="small">No links yet</span>
              )}
              <a href="/rss.xml" className="text-link">
                RSS feed
              </a>
            </div>
            <div className="foot-col">
              <h2>Fine print</h2>
              {footerPages.map((page) => (
                <Link key={page.id} to={pagePath(page.slug)} className="text-link">
                  {page.title}
                </Link>
              ))}
              <Link to="/about" className="text-link">
                About
              </Link>
            </div>
          </div>
          <div className="foot-end">
            <p className="small">
              {settings?.footer_text ||
                `© ${new Date().getFullYear()} ${settings?.author_name || settings?.site_name || "Journal"}`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
