import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { permissionDelegability } from "@/lib/iam/permission-governance";

const read = (file: string) => readFileSync(file, "utf8");
const releasePermissions = ["VIEW_RELEASE_OPERATIONS_SUMMARY", "VIEW_RELEASE_OPERATIONS", "APPROVE_RELEASE_CANDIDATE", "EXECUTE_RELEASE", "ROLLBACK_RELEASE", "MANAGE_RELEASE_FEATURE_FLAGS"] as const;

describe("Release Operations authorization and interface", () => {
  it("uses exact non-delegable leadership permissions and denies ordinary roles", () => {
    for (const permission of releasePermissions) expect(PERMISSIONS).toContain(permission);
    expect(permissionDelegability("VIEW_RELEASE_OPERATIONS")).toBe("SUPER_ADMIN_ONLY_NON_DELEGABLE");
    expect(permissionDelegability("EXECUTE_RELEASE")).toBe("SUPER_ADMIN_ONLY_NON_DELEGABLE");
    expect(permissionDelegability("ROLLBACK_RELEASE")).toBe("SUPER_ADMIN_ONLY_NON_DELEGABLE");
    expect(permissionDelegability("APPROVE_RELEASE_CANDIDATE")).toBe("LEADERSHIP_RESTRICTED");
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("VIEW_RELEASE_OPERATIONS_SUMMARY")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.DIRECTOR.has("VIEW_RELEASE_OPERATIONS")).toBe(false);
    for (const role of ["PRINCIPAL", "ADMIN", "ACCOUNTANT", "TEACHER", "PARENT", "STUDENT", "VIEWER"] as const) for (const permission of releasePermissions) expect(RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)).toBe(false);
  });

  it("keeps release APIs read-only, private/no-store and separately permissioned", () => {
    const route = read("app/api/release-operations/route.ts");
    expect(route).toContain('requireApiPermission("VIEW_RELEASE_OPERATIONS_SUMMARY")');
    expect(route).toContain('hasUserPermission(auth.user, "VIEW_RELEASE_OPERATIONS")');
    expect(route).toContain("private, no-store");
    expect(route).not.toContain("export async function POST");
  });

  it("renders accessible release, maintenance and PWA update boundaries", () => {
    const page = read("app/release-operations/page.tsx"), css = read("app/globals.css"), maintenance = read("app/maintenance/page.tsx"), pwa = read("components/pwa-runtime.tsx"), serviceWorker = read("lib/pwa-service-worker.ts");
    expect(page).toContain('aria-live="polite"');
    expect(page).toContain("Validation gates");
    expect(page).toContain("Append-only local release history");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("@media (max-width: 760px)");
    expect(maintenance).toContain("NALANDA PUBLIC SCHOOL");
    expect(css).toMatch(/\.maintenance-page h1[^}]*Georgia[^}]*font-weight:\s*700/s);
    expect(pwa).toContain("Update after saving");
    expect(pwa).toContain("hasUnsafeClientWork");
    expect(serviceWorker).toContain('url.pathname.startsWith("/api/")');
    expect(serviceWorker).not.toContain('caches.open("private")');
  });

  it("has a minimal safe public client-version endpoint and maintenance mutation refusal", () => {
    const route = read("app/api/release/client-version/route.ts"), clientContract = read("lib/release-client-version.ts"), middleware = read("middleware.ts");
    expect(route).toContain("publicClientVersionContract");
    expect(clientContract).toContain("no-store");
    expect(route).not.toMatch(/gitCommit|migration|database|sha256|path/i);
    expect(middleware).toContain("NALANDA_MAINTENANCE_MODE");
    expect(middleware).toContain("status: 503");
    expect(middleware).toContain('pathname === "/api/deployment-health"');
  });
});
