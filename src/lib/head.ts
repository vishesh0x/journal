import { useEffect } from "react";

function setMetaTag(name: string, content: string, attr: "name" | "property" = "name") {
  if (!content) return;
  let tag = document.querySelector<HTMLMetaElement>(`meta[${attr}="${name}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, name);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

function setLinkTag(rel: string, href: string) {
  let tag = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement("link");
    tag.setAttribute("rel", rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute("href", href);
}

function removeMetaTag(name: string, attr: "name" | "property" = "name") {
  document.querySelector(`meta[${attr}="${name}"]`)?.remove();
}

function removeLinkTag(rel: string) {
  document.querySelector(`link[rel="${rel}"]`)?.remove();
}

/**
 * Sets document.title, description/og meta tags, the robots noindex tag,
 * and a canonical link for the current page. Pass `noindex: true` to add
 * <meta name="robots" content="noindex">; omit/false removes it (so
 * navigating from a noindex'd page to a normal one doesn't leave it stuck).
 */
export function useDocumentMeta(meta: {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  noindex?: boolean | number | null;
  canonicalUrl?: string | null;
}) {
  useEffect(() => {
    if (meta.title) document.title = meta.title;
    if (meta.description) {
      setMetaTag("description", meta.description);
      setMetaTag("og:description", meta.description, "property");
    }
    if (meta.title) setMetaTag("og:title", meta.title, "property");
    if (meta.image) setMetaTag("og:image", meta.image, "property");

    if (meta.noindex) {
      setMetaTag("robots", "noindex, nofollow");
    } else {
      removeMetaTag("robots");
    }

    if (meta.canonicalUrl) {
      setLinkTag("canonical", meta.canonicalUrl);
    } else {
      removeLinkTag("canonical");
    }
  }, [meta.title, meta.description, meta.image, meta.noindex, meta.canonicalUrl]);
}
