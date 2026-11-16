import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { renderMarkdown } from "@/lib/markdown";
import { api, type SiteSettings } from "@/lib/api";

let counter = 0;

// Mermaid's colour parser reads hex, so token colours (oklch) are converted through a canvas.
function tokenHex(name: string, fallback: string): string {
  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx || !raw) return fallback;
    ctx.fillStyle = raw;
    ctx.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
  } catch {
    return fallback;
  }
}

function isDark() {
  return document.documentElement.classList.contains("dark");
}

/**
 * Renders sanitised Markdown. Fenced ```mermaid blocks are turned into diagrams in the browser;
 * the renderer is loaded only when a post contains one and runs in its strict security mode.
 */
export function MarkdownContent({ markdown, className = "" }: { markdown: string; className?: string }) {
  const { data: settings } = useQuery({ queryKey: ["settings", "public"], queryFn: () => api.get<SiteSettings>("/settings") });
  const resizing = Boolean(settings?.image_resizing_enabled);
  const html = useMemo(() => renderMarkdown(markdown, resizing), [markdown, resizing]);
  const ref = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(isDark());
    const observer = new MutationObserver(() => setDark(isDark()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const sources = Array.from(root.querySelectorAll<HTMLElement>("pre > code.language-mermaid, .mermaid-figure[data-source]"));
    if (sources.length === 0) return;
    let cancelled = false;
    let ready: Promise<(typeof import("mermaid"))["default"]> | null = null;

    // The renderer is a large download, so it is fetched when a diagram is near the screen, not at page load.
    const load = () => {
      ready ??= import("mermaid").then(({ default: mermaid }) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          // dagre is the lightweight default; the ELK engine is a 1.5 MB download this site never needs.
          layout: "dagre",
          theme: "base",
          fontFamily: '"Paper Mono", ui-monospace, monospace',
          themeVariables: {
            background: tokenHex("--color-paper-2", "#ffffff"),
            primaryColor: tokenHex("--color-tile-a", "#e9c0e9"),
            primaryTextColor: tokenHex("--color-tile-a-ink", "#000000"),
            primaryBorderColor: tokenHex("--color-ink", "#20294c"),
            secondaryColor: tokenHex("--color-paper-3", "#e5e7ee"),
            tertiaryColor: tokenHex("--color-paper-2", "#ffffff"),
            lineColor: tokenHex("--color-ink", "#20294c"),
            textColor: tokenHex("--color-ink", "#20294c"),
            mainBkg: tokenHex("--color-tile-a", "#e9c0e9"),
            nodeBorder: tokenHex("--color-ink", "#20294c"),
            clusterBkg: tokenHex("--color-paper-3", "#e5e7ee"),
            clusterBorder: tokenHex("--color-ink", "#20294c"),
            edgeLabelBackground: tokenHex("--color-paper-2", "#ffffff"),
            noteBkgColor: tokenHex("--color-tile-c", "#d6a337"),
            noteTextColor: tokenHex("--color-tile-c-ink", "#000000"),
          },
        });
        return mermaid;
      });
      return ready;
    };

    const draw = async (node: HTMLElement) => {
      const mermaid = await load();
      if (cancelled) return;
      const isFigure = node.classList.contains("mermaid-figure");
      const source = isFigure ? decodeURIComponent(node.dataset.source ?? "") : (node.textContent ?? "");
      const holder = isFigure ? node : node.parentElement;
      if (!holder) return;
      try {
        const { svg } = await mermaid.render(`mmd-${++counter}`, source);
        if (cancelled) return;
        const figure = isFigure ? node : document.createElement("div");
        figure.className = "mermaid-figure";
        figure.setAttribute("data-source", encodeURIComponent(source));
        figure.setAttribute("role", "img");
        figure.setAttribute("aria-label", "Diagram");
        figure.innerHTML = svg;
        if (!isFigure) holder.replaceWith(figure);
      } catch {
        if (cancelled) return;
        holder.classList.add("mermaid-error");
        holder.setAttribute("data-note", "This diagram has a syntax error.");
      }
    };

    // Drawn one at a time so several diagrams never block the page together.
    let queue: Promise<void> = Promise.resolve();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          queue = queue.then(() => draw(entry.target as HTMLElement));
        }
      },
      { rootMargin: "600px 0px" },
    );
    sources.forEach((node) => observer.observe(node));

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [html, dark]);

  return <div ref={ref} className={`prose-journal ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
