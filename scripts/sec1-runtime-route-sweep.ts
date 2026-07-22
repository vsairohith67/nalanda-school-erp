import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { getEffectivePermissions } from "../lib/role-permissions";
import { ROLES, type Role } from "../lib/permissions";
import { PUBLIC_WEBSITE_EXACT_PATHS } from "../lib/public-website-routing";

type RouteKind = "page" | "api";
type RouteEntry = {
  kind: RouteKind;
  route: string;
  probeRoute: string;
  file: string;
  methods: string[];
  permission: string;
  requiredRole: Role | "";
  publicState: "PUBLIC" | "PRIVATE";
  expectedUnauthenticated: string;
  expectedBlocked: string;
  expectedCache: string;
  indexing: string;
  allowedRoles: Role[];
  blockedRoles: Role[];
};
type SweepResult = {
  role: Role | "UNAUTHENTICATED";
  route: string;
  kind: RouteKind;
  status: number;
  location: string;
  cacheControl: string;
  contentType: string;
  durationMs: number;
  error?: string;
};

const APP_DIR = path.join(process.cwd(), "app");
const MARKER = process.env.SEC1_QA_MARKER ?? "QASEC1";
if (!/^QASEC1(?:QA)?$/.test(MARKER)) {
  throw new Error("SEC-1 route-sweep marker must be QASEC1 or QASEC1QA.");
}
const PREFIX = `${MARKER.toLowerCase()}-`;
const RUNTIME_ROOT = process.env.SEC1_RUNTIME_ROOT ??
  path.join(process.cwd(), "tmp", "sec1-runtime");
const OUTPUT_DIR = path.join(RUNTIME_ROOT, "route-sweep");
const MATRIX_PATH = process.env.SEC1_QA_MATRIX_PATH ??
  path.join(process.cwd(), "docs", "SEC_1_RUNTIME_ROUTE_API_MATRIX.csv");
const BASE_URL = process.env.SEC1_BASE_URL ?? "http://127.0.0.1:3011";
const PASSWORD = process.env.SEC1_QA_PASSWORD ?? "Qasec1Runtime@2026";
const concurrency = 10;

function requireIsolation() {
  if (process.env.QA20C_ISOLATED_DATABASE !== "true") {
    throw new Error("QASEC1_COPIED_DATABASE_REQUIRED");
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

function actualRoute(relative: string) {
  const withoutFile = relative
    .replace(/\/page\.tsx$/, "")
    .replace(/\/route\.ts$/, "")
    .replace(/^page\.tsx$/, "")
    .replace(/^route\.ts$/, "");
  const route = withoutFile
    .split("/")
    .filter((segment) => !/^\(.+\)$/.test(segment))
    .join("/");
  return `/${route}`.replace(/\/$/, "") || "/";
}

function substituteDynamicSegments(route: string) {
  const values: Record<string, string> = {
    admissionNo: `${MARKER}-STUDENT-001`,
    assessmentId: `${PREFIX}assessment-missing`,
    batchId: `${PREFIX}batch-missing`,
    channel: "SMS",
    code: MARKER,
    date: "2026-07-19",
    deliveryId: `${PREFIX}delivery-missing`,
    id: `${PREFIX}object-missing`,
    kind: "students",
    pageId: `${PREFIX}page-missing`,
    postId: `${PREFIX}post-missing`,
    profileCode: MARKER,
    resource: "teachers",
    rowId: `${PREFIX}row-missing`,
    runId: `${PREFIX}run-missing`,
    slug: `${PREFIX}missing`,
    studentId: `${PREFIX}student-linked`,
    type: "students",
    userId: `${PREFIX}user-viewer`,
    version: "1"
  };
  return route.replace(/\[([^\]]+)\]/g, (_, name: string) =>
    encodeURIComponent(values[name] ?? `${PREFIX}${name.toLowerCase()}-missing`)
  );
}

function isPublicRoute(kind: RouteKind, route: string) {
  if (kind === "page") {
    return PUBLIC_WEBSITE_EXACT_PATHS.has(route) ||
      route === "/news/[slug]" ||
      /^\/news\/[a-z0-9-]+$/.test(route) ||
      ["/login", "/setup", "/offline", "/manifest.webmanifest"].includes(route);
  }
  return route === "/api/auth/login" ||
    route === "/api/setup" ||
    route.startsWith("/api/whatsapp/webhook/") ||
    route.startsWith("/api/sms-email/webhook/");
}

function permissionFromSource(source: string, kind: RouteKind, publicState: "PUBLIC" | "PRIVATE") {
  const matcher = kind === "api"
    ? /requireApiPermission\(\s*["']([^"']+)["']/
    : /requirePermission\(\s*["']([^"']+)["']/;
  return source.match(matcher)?.[1] ?? (publicState === "PUBLIC" ? "PUBLIC" : "AUTHENTICATED_OR_SCOPED");
}

async function inventory(): Promise<RouteEntry[]> {
  const rolePermissions = new Map<Role, ReadonlySet<string>>();
  for (const role of ROLES) rolePermissions.set(role, await getEffectivePermissions(prisma, role));
  return walk(APP_DIR)
    .map((file): RouteEntry | null => {
      const relative = path.relative(APP_DIR, file).replaceAll(path.sep, "/");
      if (!relative.endsWith("/page.tsx") && !relative.endsWith("/route.ts") &&
          relative !== "page.tsx" && relative !== "route.ts") return null;
      const kind: RouteKind = relative.startsWith("api/") ? "api" : "page";
      const route = actualRoute(relative);
      const source = readFileSync(file, "utf8");
      const methods = kind === "api"
        ? [...source.matchAll(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\b/g)]
            .map((match) => match[1])
        : ["GET"];
      const publicState = isPublicRoute(kind, route) ? "PUBLIC" : "PRIVATE";
      const permission = permissionFromSource(source, kind, publicState);
      const linkedStaffPreferenceRoute =
        /^\/(?:api\/)?teacher\/communication-preferences$/.test(route);
      const requiredRole: Role | "" = /^\/(?:api\/)?parent(?:\/|$)/.test(route)
        ? "PARENT"
        : /^\/(?:api\/)?teacher(?:\/|$)/.test(route) && !linkedStaffPreferenceRoute
          ? "TEACHER"
          : "";
      const permissionAllowedRoles = permission === "PUBLIC" || permission === "AUTHENTICATED_OR_SCOPED"
        ? [...ROLES]
        : ROLES.filter((role) => rolePermissions.get(role)?.has(permission));
      const allowedRoles = requiredRole
        ? permissionAllowedRoles.filter((role) => role === requiredRole)
        : permissionAllowedRoles;
      return {
        kind,
        route,
        probeRoute: substituteDynamicSegments(route),
        file: relative,
        methods,
        permission,
        requiredRole,
        publicState,
        expectedUnauthenticated: publicState === "PUBLIC"
          ? "PUBLIC_HANDLER_STATUS"
          : kind === "page"
            ? "307_TO_LOGIN"
            : "401",
        expectedBlocked: blockedStatus(kind, allowedRoles.length),
        expectedCache: route === "/offline"
          ? "public static offline content"
          : kind === "api"
            ? "private, no-store"
            : publicState === "PUBLIC" &&
          (PUBLIC_WEBSITE_EXACT_PATHS.has(route) || route.startsWith("/news/"))
          ? "public, max-age=0, must-revalidate"
          : "private, no-store",
        indexing: kind === "page" && publicState === "PUBLIC" &&
          (PUBLIC_WEBSITE_EXACT_PATHS.has(route) || route.startsWith("/news/"))
          ? "INDEX"
          : "NOINDEX",
        allowedRoles,
        blockedRoles: ROLES.filter((role) => !allowedRoles.includes(role))
      };
    })
    .filter((entry): entry is RouteEntry => Boolean(entry))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.route.localeCompare(b.route));
}

function blockedStatus(kind: RouteKind, allowedRoleCount: number) {
  if (allowedRoleCount === ROLES.length) return "NOT_APPLICABLE";
  return kind === "page" ? "307_TO_UNAUTHORIZED_OR_404" : "403_OR_404";
}

async function login(role: Role) {
  const identifier = `${PREFIX}${role.toLowerCase().replaceAll("_", "-")}`;
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", origin: BASE_URL },
    body: JSON.stringify({ identifier, password: PASSWORD }),
    signal: AbortSignal.timeout(15_000)
  });
  if (response.status !== 200) throw new Error(`${MARKER} login failed for ${role}: ${response.status}`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error(`${MARKER} login did not return a cookie for ${role}`);
  return cookie;
}

async function probe(entry: RouteEntry, role: Role | "UNAUTHENTICATED", cookie?: string): Promise<SweepResult> {
  const started = performance.now();
  try {
    const response = await fetch(`${BASE_URL}${entry.probeRoute}`, {
      method: "GET",
      redirect: "manual",
      headers: {
        accept: entry.kind === "api" ? "application/json" : "text/html",
        ...(cookie ? { cookie } : {})
      },
      signal: AbortSignal.timeout(entry.route === "/api/backup" ? 60_000 : 15_000)
    });
    await response.body?.cancel();
    return {
      role,
      route: entry.route,
      kind: entry.kind,
      status: response.status,
      location: response.headers.get("location") ?? "",
      cacheControl: response.headers.get("cache-control") ?? "",
      contentType: response.headers.get("content-type") ?? "",
      durationMs: Math.round(performance.now() - started)
    };
  } catch (error) {
    return {
      role,
      route: entry.route,
      kind: entry.kind,
      status: 0,
      location: "",
      cacheControl: "",
      contentType: "",
      durationMs: Math.round(performance.now() - started),
      error: error instanceof Error ? error.name : "request_failed"
    };
  }
}

async function mapBounded<T, R>(values: T[], worker: (value: T) => Promise<R>) {
  const results: R[] = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = cursor++;
      if (index >= values.length) break;
      results[index] = await worker(values[index]);
    }
  }));
  return results;
}

function csv(value: unknown) {
  const text = Array.isArray(value) ? value.join("|") : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

async function compile(entries: RouteEntry[]) {
  const roles = ["UNAUTHENTICATED", ...ROLES] as const;
  const resultMaps = new Map<string, Map<string, SweepResult>>();
  for (const role of roles) {
    const resultPath = path.join(OUTPUT_DIR, `${role.toLowerCase()}.json`);
    const rows = JSON.parse(readFileSync(resultPath, "utf8")) as SweepResult[];
    resultMaps.set(role, new Map(rows.map((row) => [`${row.kind}:${row.route}`, row])));
  }
  const headings = [
    "kind", "route", "probe_route", "methods", "public_state", "required_permission",
    "required_role", "allowed_roles", "expected_blocked_roles", "expected_unauthenticated",
    "expected_blocked", "expected_cache", "indexing", "source_file",
    ...roles.map((role) => `${role.toLowerCase()}_status`)
  ];
  const lines = [headings.map(csv).join(",")];
  for (const entry of entries) {
    const key = `${entry.kind}:${entry.route}`;
    lines.push([
      entry.kind, entry.route, entry.probeRoute, entry.methods, entry.publicState, entry.permission,
      entry.requiredRole, entry.allowedRoles, entry.blockedRoles, entry.expectedUnauthenticated,
      entry.expectedBlocked, entry.expectedCache, entry.indexing, entry.file,
      ...roles.map((role) => resultMaps.get(role)?.get(key)?.status ?? "")
    ].map(csv).join(","));
  }
  writeFileSync(MATRIX_PATH, `${lines.join("\n")}\n`, "utf8");

  const allResults = roles.flatMap((role) => [...(resultMaps.get(role)?.values() ?? [])]);
  const summary = {
    pages: entries.filter((entry) => entry.kind === "page").length,
    apis: entries.filter((entry) => entry.kind === "api").length,
    roles: roles.length,
    requests: allResults.length,
    networkErrors: allResults.filter((row) => row.status === 0).length,
    serverErrors: allResults.filter((row) => row.status >= 500).length,
    privateCacheViolations: allResults.filter((row) => {
      const entry = entries.find((item) => item.kind === row.kind && item.route === row.route);
      return entry?.expectedCache === "private, no-store" && !row.cacheControl.includes("no-store");
    }).length,
    matrix: path.relative(process.cwd(), MATRIX_PATH).replaceAll(path.sep, "/")
  };
  writeFileSync(path.join(OUTPUT_DIR, "summary.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

async function main() {
  requireIsolation();
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const entries = await inventory();
  const roleArg = process.argv.find((arg) => arg.startsWith("--role="))?.split("=")[1]?.toUpperCase();
  if (process.argv.includes("--compile")) {
    await compile(entries);
    return;
  }
  const role = roleArg === "UNAUTHENTICATED"
    ? "UNAUTHENTICATED"
    : ROLES.find((candidate) => candidate === roleArg);
  if (!role) throw new Error("Use --role=UNAUTHENTICATED or one of the supported roles.");
  const cookie = role === "UNAUTHENTICATED" ? undefined : await login(role);
  const results = await mapBounded(entries, (entry) => probe(entry, role, cookie));
  const resultPath = path.join(OUTPUT_DIR, `${role.toLowerCase()}.json`);
  writeFileSync(resultPath, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({
    role,
    routes: results.length,
    statuses: Object.fromEntries([...new Set(results.map((row) => row.status))]
      .sort((a, b) => a - b)
      .map((status) => [status, results.filter((row) => row.status === status).length])),
    slowest: [...results].sort((a, b) => b.durationMs - a.durationMs).slice(0, 5)
      .map((row) => ({ kind: row.kind, route: row.route, status: row.status, ms: row.durationMs }))
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "SEC-1B route sweep failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
