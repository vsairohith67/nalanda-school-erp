const RESERVED_ROOTS = new Set([
  "api", "website-admin", "ai-assistant", "cloud-backup", "fee-register-ocr",
  "settings", "students", "staff", "guardians", "payments", "parent", "teacher",
  "roles", "users", "login", "setup", "offline", "dashboard", "notifications",
  "whatsapp", "sms-email", "attendance", "marks", "report-cards", "certificates",
  "library", "cash-book", "expenses", "budgets", "import-export", "receipts"
]);

export const CORE_PUBLIC_SLUGS = [
  "about", "academics", "admissions", "facilities", "student-life", "contact",
  "school-app", "privacy", "accessibility", "terms", "mandatory-disclosure"
] as const;

const SAFE_INTERNAL = new Set([
  "/", "/about", "/academics", "/admissions", "/facilities", "/student-life",
  "/news", "/contact", "/school-app", "/privacy", "/accessibility", "/terms",
  "/mandatory-disclosure", "/login"
]);

const APPROVED_EXTERNAL_HOSTS = new Set([
  "nalandaps.com", "www.nalandaps.com", "maps.google.com", "www.google.com"
]);

export function normalizePublicSlug(value: unknown) {
  const slug = String(value ?? "").trim().toLowerCase()
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-");
  if (!slug || slug.length > 100) throw new Error("Use a public slug between 1 and 100 characters.");
  if (RESERVED_ROOTS.has(slug.split("/")[0])) throw new Error("That slug is reserved for a private or system route.");
  return slug;
}

export function safePublicUrl(value: unknown, options: { allowLogin?: boolean; directions?: boolean } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.startsWith("//") || /^(javascript|data|vbscript):/i.test(raw)) throw new Error("Unsafe URL protocol.");
  if (raw.startsWith("/")) {
    const url = new URL(raw, "https://nalandaps.com");
    if (url.origin !== "https://nalandaps.com" || url.username || url.password) throw new Error("Unsafe internal URL.");
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const isNewsDetail = /^\/news\/[a-z0-9-]+$/.test(path);
    if ((!SAFE_INTERNAL.has(path) && !isNewsDetail) || (path === "/login" && !options.allowLogin)) {
      throw new Error("Only approved public routes are allowed.");
    }
    if ([...url.searchParams.keys()].some((key) => !["utm_source"].includes(key))) {
      throw new Error("Unsafe URL query parameters are not allowed.");
    }
    return `${path}${url.search}`;
  }
  const url = new URL(raw);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("External links must use plain HTTPS URLs.");
  if (!APPROVED_EXTERNAL_HOSTS.has(url.hostname.toLowerCase())) throw new Error("External destination is not approved.");
  if (options.directions && !["maps.google.com", "www.google.com"].includes(url.hostname.toLowerCase())) {
    throw new Error("Directions links must use an approved maps host.");
  }
  return url.toString();
}

export function publicPathForSlug(slug: string) {
  return slug ? `/${slug}` : "/";
}
