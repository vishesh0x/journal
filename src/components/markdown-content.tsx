import { useMemo } from "react";
import { renderMarkdown } from "@/lib/markdown";

export function MarkdownContent({ markdown, className = "" }: { markdown: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(markdown), [markdown]);
  return <div className={`prose-journal ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}
