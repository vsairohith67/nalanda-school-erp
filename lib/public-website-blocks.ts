import { validateRegisteredImage } from "@/lib/public-website-assets";
import { safePublicUrl } from "@/lib/public-website-links";

export const PUBLIC_WEBSITE_BLOCK_TYPES = [
  "HERO", "RICH_TEXT", "FEATURE_GRID", "FACT_GRID", "CTA", "FAQ", "TIMELINE",
  "REGISTERED_IMAGE", "QUOTE_WITHOUT_PERSONAL_ATTRIBUTION", "CONTACT_DETAILS",
  "PORTAL_LOGIN", "NEWS_LIST"
] as const;

export type PublicWebsiteBlockType = (typeof PUBLIC_WEBSITE_BLOCK_TYPES)[number];
export type PublicWebsiteBlock = Record<string, unknown> & { type: PublicWebsiteBlockType };

const BLOCK_TYPES = new Set<string>(PUBLIC_WEBSITE_BLOCK_TYPES);
const HTML_OR_SCRIPT = /<\s*\/?\s*(?:script|iframe|style|object|embed|form|input|button|link|meta|svg|html|body|img|video|audio)\b|<[^>]+>|on[a-z]+\s*=|javascript:|data:|vbscript:|srcdoc\s*=/i;

function text(value: unknown, label: string, max = 1600, required = false) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new Error(`${label} is required.`);
  if (result.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (HTML_OR_SCRIPT.test(result)) throw new Error(`${label} contains unsafe HTML or scriptable content.`);
  return result;
}

function textArray(value: unknown, label: string, maxItems = 12) {
  if (!Array.isArray(value) || value.length > maxItems) throw new Error(`${label} must contain at most ${maxItems} items.`);
  return value.map((item, index) => text(item, `${label} item ${index + 1}`, 500, true));
}

function validateMarkdown(markdown: string) {
  if (HTML_OR_SCRIPT.test(markdown)) throw new Error("Rich text cannot contain HTML, scripts, iframes, forms or data URLs.");
  const links = [...markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)];
  for (const match of links) safePublicUrl(match[1]);
  const headingLevels = markdown.split(/\r?\n/).flatMap((line) => {
    const match = /^(#{2,6})\s+/.exec(line.trim());
    return match ? [match[1].length] : [];
  });
  let previous = 1;
  for (const level of headingLevels) {
    if (level > previous + 1) throw new Error("Rich-text headings must not skip levels.");
    previous = level;
  }
}

export function validatePublicWebsiteBlocks(input: unknown): PublicWebsiteBlock[] {
  if (!Array.isArray(input)) throw new Error("Website content must be a controlled block list.");
  if (!input.length || input.length > 30) throw new Error("Website content must contain between 1 and 30 blocks.");
  return input.map((raw, index) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`Block ${index + 1} must be an object.`);
    const source = raw as Record<string, unknown>;
    const type = String(source.type ?? "");
    if (!BLOCK_TYPES.has(type)) throw new Error(`Block ${index + 1} uses an unsupported block type.`);
    const base = { type: type as PublicWebsiteBlockType };
    if (type === "HERO") return { ...base, eyebrow: text(source.eyebrow, "Hero eyebrow", 80), heading: text(source.heading, "Hero heading", 120, true), body: text(source.body, "Hero body", 500, true), primaryLabel: text(source.primaryLabel, "Hero primary label", 60), primaryHref: source.primaryHref ? safePublicUrl(source.primaryHref, { allowLogin: true }) : "" };
    if (type === "RICH_TEXT") {
      const markdown = text(source.markdown, "Rich text", 12_000, true);
      validateMarkdown(markdown);
      return { ...base, markdown };
    }
    if (type === "FEATURE_GRID" || type === "FACT_GRID" || type === "TIMELINE") {
      return { ...base, heading: text(source.heading, "Section heading", 120, true), items: textArray(source.items, "Section items") };
    }
    if (type === "CTA") return { ...base, heading: text(source.heading, "CTA heading", 120, true), body: text(source.body, "CTA body", 500), label: text(source.label, "CTA label", 60, true), href: safePublicUrl(source.href, { allowLogin: true }) };
    if (type === "FAQ") {
      if (!Array.isArray(source.items) || source.items.length > 12) throw new Error("FAQ must contain at most 12 items.");
      return { ...base, heading: text(source.heading, "FAQ heading", 120, true), items: source.items.map((item, itemIndex) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`FAQ item ${itemIndex + 1} is invalid.`);
        const row = item as Record<string, unknown>;
        return { question: text(row.question, "FAQ question", 220, true), answer: text(row.answer, "FAQ answer", 1200, true) };
      }) };
    }
    if (type === "REGISTERED_IMAGE") return { ...base, ...validateRegisteredImage(source), caption: text(source.caption, "Image caption", 240) };
    if (type === "QUOTE_WITHOUT_PERSONAL_ATTRIBUTION") return { ...base, quote: text(source.quote, "Quote", 800, true) };
    if (type === "CONTACT_DETAILS") return { ...base, heading: text(source.heading, "Contact heading", 120, true) };
    if (type === "PORTAL_LOGIN") return { ...base, heading: text(source.heading, "Portal heading", 120, true), body: text(source.body, "Portal body", 500) };
    return { ...base, heading: text(source.heading, "News heading", 120, true), limit: Math.min(6, Math.max(1, Number(source.limit ?? 3))) };
  });
}

export function parsePublicWebsiteBlocks(json: string) {
  try {
    return validatePublicWebsiteBlocks(JSON.parse(json));
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Website blocks are invalid.");
  }
}
