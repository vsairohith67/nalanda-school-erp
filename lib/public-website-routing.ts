export const PUBLIC_WEBSITE_EXACT_PATHS = new Set([
  "/", "/about", "/academics", "/admissions", "/facilities", "/student-life",
  "/news", "/contact", "/school-app", "/privacy", "/accessibility", "/terms",
  "/mandatory-disclosure", "/robots.txt", "/sitemap.xml"
]);

export const PRIVATE_ROBOTS_EXCLUSIONS = [
  "/api", "/website-admin", "/ai-assistant", "/attendance", "/books", "/budgets",
  "/cash-book", "/certificates", "/change-password", "/class-x-documents",
  "/cloud-backup", "/daily-collection", "/dashboard", "/exams", "/expenses",
  "/fee-register-ocr", "/guardians", "/homework", "/id-cards", "/import-export",
  "/import-verification", "/install-app", "/leave", "/ledger", "/library", "/login",
  "/marks", "/misc-income", "/notices", "/notifications", "/offline", "/parent",
  "/payments", "/pending-dues", "/pilot-acceptance", "/receipt-audit", "/receipts",
  "/report-cards", "/roles", "/settings", "/setup", "/sms-email", "/staff",
  "/students", "/substitutes", "/teacher", "/teacher-analytics", "/timetable",
  "/udise", "/unauthorized", "/users", "/vendors", "/whatsapp"
] as const;

export function isPublicWebsitePath(pathname: string) {
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return PUBLIC_WEBSITE_EXACT_PATHS.has(normalized) || /^\/news\/[a-z0-9-]+$/.test(normalized);
}
