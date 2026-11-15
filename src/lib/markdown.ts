import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
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

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeLazyImages)
  .use(rehypeSlug)
  .use(rehypeStringify);

export function renderMarkdown(markdown: string): string {
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
