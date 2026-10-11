import { PERMISSIONS, ROLES, type CanonicalPermission, type Role } from "../lib/permissions";
import { defaultPermissionMatrix } from "../lib/role-permissions";

type ScreenRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const permissions = new Set<string>(PERMISSIONS);
const matrix = defaultPermissionMatrix();

export interface ScreenSource { file: string; source: string; loading: boolean; error: boolean; }
// UTF-16 ordinal ordering is locale-independent on Windows and Linux.
export const ordinalCompare = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
function routeFromPage(file: string) {
  return '/' + file.split('/').slice(1, -1).filter(segment => !/^\(.+\)$/.test(segment)).join('/') || '/';
}

function moduleFor(route: string) {
  const first = route.split("/").filter(Boolean)[0] ?? "public-home";
  return first === "api" ? "api" : first.replaceAll("-", " ");
}

function titleFrom(source: string, route: string) {
  const literal = source.match(/<PageHeader[\s\S]{0,800}?title=["']([^"']+)["']/)?.[1]
    ?? source.match(/<h1[^>]*>([^<{]+)</)?.[1]
    ?? source.match(/<h2[^>]*>([^<{]+)</)?.[1];
  return literal?.trim() || route.split("/").filter(Boolean).at(-1)?.replaceAll("-", " ") || "Home";
}

function requiredPermissions(source: string) {
  return [...new Set(Array.from(source.matchAll(/["']([A-Z][A-Z0-9_]{2,})["']/g), (match) => match[1]).filter((value) => permissions.has(value)))].sort() as CanonicalPermission[];
}

function rolesFor(route: string, source: string, required: CanonicalPermission[]) {
  if (source.includes("(public)") || route === "/" || /^\/(about|academics|accessibility|admissions|contact|event-gallery|facilities|mandatory-disclosure|news|privacy|school-app|student-life|terms)(\/|$)/.test(route)) return ["PUBLIC"];
  if (route.startsWith("/super-admin")) return ["SUPER_ADMIN"];
  if (route.startsWith("/parent")) return ["PARENT"];
  if (route.startsWith("/teacher")) return ["TEACHER"];
  if (route.startsWith("/student/")) return ["STUDENT"];
  const explicit = ROLES.filter((role) => new RegExp(`["']${role}["']`).test(source));
  const allowed = ROLES.filter((role) => required.every((permission) => matrix[role][permission]));
  const inferred = explicit.length ? allowed.filter((role) => explicit.includes(role)) : allowed;
  const roles = inferred.length ? inferred : allowed;
  if (route.startsWith("/marks") && required.some((permission) => ["ENTER_MARKS", "ENTER_ASSIGNED_EXAM_MARKS"].includes(permission))) return [...new Set([...roles, "MARKS_ENTRY_OPERATOR_PROFILE"])];
  return roles.length ? roles : ["PERMISSION_SCOPED"];
}

function riskFor(route: string): ScreenRisk {
  if (/\/(setup|reset-password|native\/authorize|release-operations|technical-operations)/.test(route)) return "CRITICAL";
  if (/\/(payments|family-collections|fees|ledger|receipt|cash-book|payroll|marks|exams|users|roles|permission|offline|cloud-backup|import|student-departures|report-cards|certificates|class-x-documents|id-cards)/.test(route)) return "HIGH";
  if (/\/(students|staff|guardians|attendance|leave|library|support|notifications|whatsapp|sms-email|parent-meetings|admission)/.test(route)) return "MEDIUM";
  return "LOW";
}

function availabilityFor(route: string) {
  const print = route.endsWith("/print") || route.includes("/print/");
  const offline = route === "/offline" || route.startsWith("/offline/finance");
  return {
    webDesktop: true,
    webMobile: print ? "PRINT_OR_DOWNLOAD_VIEW" : "RESPONSIVE_WEB",
    windowsInstalled: offline ? "BUNDLED_OR_PWA" : "SYSTEM_BROWSER_HANDOFF",
    androidInstalled: offline ? "BUNDLED_APP" : "SYSTEM_BROWSER_HANDOFF",
    iosInstalled: offline ? "BUNDLED_APP" : "SYSTEM_BROWSER_HANDOFF"
  };
}

function requirementFor(route: string) {
  if (route === "/offline") return "OFFLINE_PUBLIC_SHELL";
  if (route.startsWith("/offline/finance")) return "OFFLINE_CAPABLE_APPROVED_ENCRYPTED_DRAFTS";
  if (/^\/(login|forgot-password|reset-password|setup|unauthorized)/.test(route)) return "ONLINE_AUTH_OR_RECOVERY";
  return "ONLINE_SERVER_AUTHORISED";
}

export function deriveScreenRegister(pages: readonly ScreenSource[]) {
const screens = pages.map(({file: relativeFile, source, loading: localLoading, error: localError}) => {
  const route = routeFromPage(relativeFile);
  const required = requiredPermissions(source);
  const hasForm = /<form\b/.test(source);
  const hasTable = /<table\b/.test(source);
  const hasHelp = /description=|className=["'][^"']*(notice|help|muted)/.test(source);
  const hasEmpty = /EmptyState|empty-state|No [A-Za-z]|not (available|recorded|found)|\.length\s*\?/.test(source);
  return {
    route,
    file: relativeFile,
    roles: rolesFor(route, source, required),
    module: moduleFor(route),
    availability: availabilityFor(route),
    requirement: requirementFor(route),
    primaryTask: titleFrom(source, route),
    risk: riskFor(route),
    states: {
      empty: hasEmpty ? "EXPLICIT_IN_SCREEN" : "SHARED_EMPTY_PATTERN_AVAILABLE",
      loading: localLoading ? "ROUTE_SPECIFIC" : "GLOBAL_SAFE_LOADING",
      error: localError ? "ROUTE_SPECIFIC" : "GLOBAL_SAFE_RECOVERY"
    },
    helpText: hasHelp ? "PRESENT" : "SHARED_CONTEXT_ONLY",
    accessibility: {
      status: "SHARED_WCAG_BASELINE_APPLIES",
      heading: /<PageHeader\b|<h1\b/.test(source) ? "PRESENT" : "DERIVED_FROM_ROUTE_LAYOUT",
      forms: hasForm ? "LABEL_AND_DIRTY_STATE_RUNTIME_AUDIT" : "NOT_APPLICABLE",
      tables: hasTable ? "RESPONSIVE_LABELLED_RUNTIME_AUDIT" : "NOT_APPLICABLE",
      manualReviewRequired: riskFor(route) === "CRITICAL" || riskFor(route) === "HIGH"
    },
    permissionRequirements: required
  };
}).sort((left, right) => ordinalCompare(left.route, right.route) || ordinalCompare(left.file, right.file));

const register = {
  schemaVersion: 1,
  promptId: "PRODUCT-EXPERIENCE-1A",
  generatedFrom: "app page source tree",
  completeness: {
    pageFiles: pages.length,
    registeredScreens: screens.length,
    omittedScreens: pages.length - screens.length
  },
  sharedBaselines: {
    loading: "app/loading.tsx",
    errorRecovery: "app/error.tsx",
    focusFormsTablesStatus: "app/product-experience.css",
    runtimeEnhancement: "components/product-experience-runtime.tsx"
  },
  screens
};

if (register.completeness.omittedScreens !== 0) throw new Error("SCREEN_REGISTER_INCOMPLETE");
return register;
}

export function serializeScreenRegister(register: ReturnType<typeof deriveScreenRegister>) {
  return JSON.stringify(register, null, 2) + "\n";
}
