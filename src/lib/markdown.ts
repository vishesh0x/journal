import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import GithubSlugger from "github-slugger";
import type { Element, Root } from "hast";

// Small hand-rolled rehype plugin: marks every <img> for lazy loading and
// async decoding. Runs after rehype-sanitize (whose default allowlist
// doesn't include these attributes) so they aren't stripped back out.
function rehypeLazyImages() {
  function visit(node: Element | Root) {
    if ("tagName" in node && node.tagName === "img") {
      node.properties = { ...node.properties, loading: "lazy", decoding: "async" };
    }
    for (const child of node.children ?? []) {
      if (child.type === "element") visit(child as Element);
    }
  }
  return (tree: Root) => {
    visit(tree);
  };
}

const WIDTHS = [480, 768, 1200, 1600];
const resized = (url: string, w: number) => `/cdn-cgi/image/width=${w},quality=60,format=auto${url}`;

// With Cloudflare Image Resizing on, our own uploads get a srcset so phones don't download full-size originals.
function rehypeResizedImages() {
  function visit(node: Element | Root) {
    if ("tagName" in node && node.tagName === "img") {
      const src = String(node.properties?.src ?? "");
      if (src.startsWith("/api/media/") && !/\.svg($|\?)/i.test(src)) {
        node.properties = {
          ...node.properties,
          src: resized(src, 1200),
          srcSet: WIDTHS.map((w) => `${resized(src, w)} ${w}w`).join(", "),
          sizes: "(min-width: 64rem) 720px, calc(100vw - 3rem)",
        };
      }
    }
    for (const child of node.children ?? []) if (child.type === "element") visit(child as Element);
  }
  return (tree: Root) => visit(tree);
}

const build = (resizing: boolean) =>
  unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeLazyImages)
    .use(resizing ? rehypeResizedImages : () => undefined)
    // Runs after sanitising, so the token classes it adds are kept. Mermaid source stays plain for the diagram renderer.
    .use(rehypeHighlight, { detect: false, plainText: ["mermaid", "text", "plain"] })
    .use(rehypeSlug)
    .use(rehypeStringify);

const processors = { plain: build(false), resized: build(true) };

export function renderMarkdown(markdown: string, resizing = false): string {
  const processor = resizing ? processors.resized : processors.plain;
  if (!markdown) return "";
  return String(processor.processSync(markdown));
}

export function readingMinutes(markdown: string): number {
  const words = markdown.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function makeExcerpt(markdown: string, length = 180): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= length) return plain;
  return plain.slice(0, length).replace(/\s+\S*$/, "") + "…";
}

export function slugify(input: string): string {
  const slugger = new GithubSlugger();
  const slug = slugger.slug(input || "untitled");
  return slug || "untitled";
}

export type TocItem = { id: string; text: string; depth: number };

export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger();
  const items: TocItem[] = [];
  let inFence = false;
  for (const line of markdown.split("\n")) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*$/.exec(line);
    if (!match) continue;
    const text = (match[2] ?? "").replace(/[*_`]/g, "");
    items.push({ id: slugger.slug(text), text, depth: (match[1] ?? "##").length });
  }
  return items;
}
