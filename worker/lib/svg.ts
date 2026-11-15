// SVG is markup, so an uploaded file is checked against an allowlist before it is stored.
// Anything not on the list rejects the whole upload (nothing is rewritten silently).
// Defence in depth: the file is only ever shown through <img>, where scripts never run, and the
// media route serves it with a sandboxing CSP.

const MAX_SVG_BYTES = 1024 * 1024;

const ALLOWED_ELEMENTS = new Set([
  "svg", "g", "defs", "title", "desc", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "text", "tspan", "textpath", "lineargradient", "radialgradient", "stop", "clippath", "mask", "pattern",
  "symbol", "use", "image", "marker", "style", "filter", "fegaussianblur", "feoffset", "feblend",
  "fecolormatrix", "feflood", "fecomposite", "femerge", "femergenode", "fedropshadow",
]);

export type SvgResult = { ok: true; text: string } | { ok: false; reason: string };

function safeRef(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("#")) return true;
  return /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(v);
}

function safeCss(css: string): boolean {
  const lower = css.toLowerCase();
  if (/@import|expression\s*\(|javascript:|vbscript:|behavior\s*:|-moz-binding|\\/.test(lower)) return false;
  for (const m of lower.matchAll(/url\(\s*(['"]?)([^)'"]*)\1\s*\)/g)) {
    if (!safeRef(m[2] ?? "")) return false;
  }
  return true;
}

export function checkSvg(bytes: Uint8Array): SvgResult {
  if (bytes.byteLength > MAX_SVG_BYTES) return { ok: false, reason: "SVG files can be 1MB at most." };
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false }).decode(bytes);
  } catch {
    return { ok: false, reason: "The SVG is not valid UTF-8 text." };
  }
  const body = text.replace(/^\uFEFF/, "").replace(/^\s*<\?xml[^>]*\?>/i, "").replace(/<!--[\s\S]*?-->/g, "").trim();
  if (!/^<svg[\s>]/i.test(body) || !/<\/svg>\s*$/i.test(body)) return { ok: false, reason: "That file is not a plain SVG image." };
  if (/<!doctype|<!entity|<!\[cdata\[|<\?/i.test(body)) return { ok: false, reason: "SVGs with a DOCTYPE, entities, CDATA or processing instructions are not accepted." };

  const tagRe = /<(\/?)([a-zA-Z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>/g;
  let cursor = 0;
  let styleDepth = 0;
  let styleText = "";
  for (const match of body.matchAll(tagRe)) {
    const index = match.index ?? 0;
    const between = body.slice(cursor, index);
    if (styleDepth > 0) styleText += between;
    else if (between.includes("<")) return { ok: false, reason: "The SVG contains markup that could not be checked." };
    cursor = index + match[0].length;

    const closing = match[1] === "/";
    const name = (match[2] ?? "").toLowerCase();
    if (!ALLOWED_ELEMENTS.has(name)) return { ok: false, reason: `The element <${name}> is not allowed in uploaded SVGs.` };
    if (name === "style") {
      if (closing) {
        styleDepth = 0;
        if (!safeCss(styleText)) return { ok: false, reason: "The SVG stylesheet uses something that is not allowed." };
        styleText = "";
      } else if (!match[4]) styleDepth = 1;
    }
    if (closing) continue;

    for (const attr of (match[3] ?? "").matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
      const attrName = (attr[1] ?? "").toLowerCase();
      const value = attr[2] ?? attr[3] ?? attr[4] ?? "";
      if (attrName.startsWith("on")) return { ok: false, reason: "Event handler attributes are not allowed in SVGs." };
      if (/&#|&(?!amp;|lt;|gt;|quot;|apos;)/i.test(value)) return { ok: false, reason: "Encoded characters in attributes are not allowed in SVGs." };
      if (attrName === "href" || attrName === "xlink:href") {
        if (!safeRef(value)) return { ok: false, reason: "SVGs can only link to shapes inside the same file." };
      } else if (attrName === "style") {
        if (!safeCss(value)) return { ok: false, reason: "An inline style in the SVG is not allowed." };
      } else if (/javascript:|vbscript:|data:text|<script/i.test(value) || (/url\(/i.test(value) && !safeCss(`x{a:${value}}`))) {
        return { ok: false, reason: "An attribute in the SVG is not allowed." };
      }
    }
  }
  if (styleDepth > 0) return { ok: false, reason: "The SVG has an unclosed <style>." };
  if (body.slice(cursor).trim() !== "") return { ok: false, reason: "The SVG has content after its closing tag." };
  return { ok: true, text: body };
}
