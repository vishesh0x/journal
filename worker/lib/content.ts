import GithubSlugger from "github-slugger";

export function slugify(input: string): string {
  const slugger = new GithubSlugger();
  const slug = slugger.slug(input || "untitled");
  return slug || "untitled";
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

export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
