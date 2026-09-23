/**
 * The mentor may only link to URLs that came from verified, stored records.
 * Any other URL in model output is stripped to plain text and flagged, so an
 * invented link can never look trustworthy.
 */

const MARKDOWN_LINK = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
const BARE_URL = /(?<![(\[])\bhttps?:\/\/[^\s<>()\]]+/g;

export function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("/")) s = s.slice(0, -1);
    return s.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function guardUrls(
  text: string,
  allowed: Iterable<string>,
): { text: string; removed: string[] } {
  const allow = new Set([...allowed].map(normalizeUrl));
  const removed: string[] = [];
  const isAllowed = (url: string) => {
    const trimmed = url.replace(/[.,;:!?]+$/, "");
    return allow.has(normalizeUrl(trimmed));
  };

  let out = text.replace(MARKDOWN_LINK, (match, label: string, url: string) => {
    if (isAllowed(url)) return match;
    removed.push(url);
    return `${label} (unverified link removed)`;
  });

  out = out.replace(BARE_URL, (match) => {
    // Sentence punctuation directly after a URL is not part of it.
    const trailing = match.match(/[.,;:!?]+$/)?.[0] ?? "";
    const url = match.slice(0, match.length - trailing.length);
    if (isAllowed(url)) return match;
    removed.push(url);
    return `(unverified link removed)${trailing}`;
  });

  return { text: out, removed };
}
