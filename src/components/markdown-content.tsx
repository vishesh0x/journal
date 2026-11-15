import { useEffect, useMemo, useRef, useState } from "react";
import { renderMarkdown } from "@/lib/markdown";

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
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
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

    void (async () => {
      const { default: mermaid } = await import("mermaid");
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
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
      for (const node of sources) {
        if (cancelled) return;
        const isFigure = node.classList.contains("mermaid-figure");
        const source = isFigure ? decodeURIComponent(node.dataset.source ?? "") : (node.textContent ?? "");
        const holder = isFigure ? node : node.parentElement;
        if (!holder) continue;
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
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [html, dark]);

  return <div ref={ref} className={`prose-journal ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
