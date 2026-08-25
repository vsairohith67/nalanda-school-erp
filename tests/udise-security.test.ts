import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("UDISE-15E-1C route, authorization and privacy boundaries", () => {
  it("separates aggregate/register access from masked row and export access", () => {
    for (const page of ["app/udise/page.tsx", "app/udise/register/page.tsx", "app/udise/summary/page.tsx"]) {
      expect(source(page), page).toContain('requirePermission("VIEW_UDISE_CHECKLIST")');
    }
    for (const page of ["app/udise/students/page.tsx", "app/udise/staff/page.tsx"]) {
      expect(source(page), page).toContain('requirePermission("VIEW_UDISE_MASKED_ROWS")');
    }
    for (const route of ["summary", "register"]) {
      expect(source(`app/api/udise/${route}/route.ts`), route).toContain('requireApiPermission("VIEW_UDISE_CHECKLIST")');
    }
    for (const route of ["students", "staff"]) {
      expect(source(`app/api/udise/${route}/route.ts`), route).toContain('requireApiPermission("VIEW_UDISE_MASKED_ROWS")');
    }
    expect(source("app/api/udise/export/route.ts")).toContain('requireApiPermission("EXPORT_UDISE_CHECKLIST")');
    expect(source("components/udise-nav.tsx")).toContain('key !== "students" && key !== "staff"');
  });

  it("keeps every UDISE route GET-only and free of operational mutations", () => {
    const routeFiles = ["summary", "register", "students", "staff", "export"].map((name) => `app/api/udise/${name}/route.ts`);
    for (const file of routeFiles) {
      const route = source(file);
      expect(route, file).toContain("export async function GET");
      expect(route, file).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
      expect(route, file).not.toMatch(/\.create\(|\.update\(|\.delete\(|\.upsert\(/);
    }
  });

  it("applies private/no-store and nosniff to JSON and CSV outputs", () => {
    const helper = source("lib/udise-http.ts");
    expect(helper).toContain('"cache-control": "private, no-store"');
    expect(helper).toContain('"x-content-type-options": "nosniff"');
    for (const route of ["summary", "register", "students", "staff"]) expect(source(`app/api/udise/${route}/route.ts`)).toContain("udisePrivateJson");
    const exportRoute = source("app/api/udise/export/route.ts");
    expect(exportRoute).toContain("UDISE_PRIVATE_HEADERS");
    expect(exportRoute).toContain("content-security-policy");
  });

  it("uses fixed filters, fixed columns, bounded rows and formula neutralisation", () => {
    const helper = source("lib/udise-checklist.ts");
    expect(helper).toContain("UDISE_STUDENT_ROW_LIMIT = 2_000");
    expect(helper).toContain("UDISE_STAFF_ROW_LIMIT = 500");
    expect(helper).toContain("UDISE_GUARDIAN_RELATION_LIMIT = 8");
    expect(helper).toContain("UDISE_ENROLLMENT_RELATION_LIMIT = 2");
    expect(helper).toContain("UDISE_LIFECYCLE_RELATION_LIMIT = 8");
    expect(helper).toContain("UDISE_PROGRESSION_RELATION_LIMIT = 8");
    expect(helper).toContain("take: UDISE_STUDENT_ROW_LIMIT");
    expect(helper).toContain("take: UDISE_STAFF_ROW_LIMIT");
    expect(helper).toContain("take: UDISE_GUARDIAN_RELATION_LIMIT");
    expect(helper).toContain("take: UDISE_ENROLLMENT_RELATION_LIMIT");
    expect(helper).toContain("take: UDISE_LIFECYCLE_RELATION_LIMIT");
    expect(helper).toContain("take: UDISE_PROGRESSION_RELATION_LIMIT");
    expect(helper).toContain("includeStudents");
    expect(helper).toContain("includeStaff");
    expect(helper).toContain("studentRowsTruncated");
    expect(helper).toContain("staffRowsTruncated");
    expect(helper).toContain("client.student.count");
    expect(helper).toContain("client.staffMember.count");
    expect(helper).toContain("slice(0, UDISE_STUDENT_ROW_LIMIT)");
    expect(helper).toContain("slice(0, UDISE_STAFF_ROW_LIMIT)");
    expect(helper).toContain("safeCsvCell");
    expect(helper).toContain("Opaque row reference");
    const exportRoute = source("app/api/udise/export/route.ts");
    expect(exportRoute.indexOf('requestedKind === "source-register"')).toBeLessThan(exportRoute.indexOf("loadUdiseChecklist(prisma)"));
    expect(helper).not.toMatch(/request\.json\(|searchParams\.entries\(|Object\.fromEntries\(.*searchParams/s);
  });

  it("does not render raw Aadhaar, names, contacts, addresses or operational mutation controls", () => {
    const pages = ["app/udise/page.tsx", "app/udise/register/page.tsx", "app/udise/students/page.tsx", "app/udise/staff/page.tsx", "app/udise/summary/page.tsx"].map(source).join("\n");
    expect(pages).not.toContain("aadhaarNo");
    expect(pages).not.toContain("studentName");
    expect(pages).not.toContain("staffName");
    expect(pages).not.toContain("primaryMobile");
    expect(pages).not.toContain('method="post"');
    expect(pages).not.toMatch(/create\(|update\(|delete\(|upsert\(/);
    expect(pages).not.toMatch(/\bComplete\b/);
  });

  it("keeps data selection allowlisted without IDs, hashes, credentials or arbitrary fields", () => {
    const helper = source("lib/udise-checklist.ts");
    const apiSources = ["summary", "register", "students", "staff", "export"].map((name) => source(`app/api/udise/${name}/route.ts`)).join("\n");
    expect(helper).toContain("select: {");
    expect(helper).not.toMatch(/passwordHash:\s*true|guardianId:\s*true|userId:\s*true/);
    expect(apiSources).not.toMatch(/passwordHash|DATABASE_URL|process\.env|portalPassword|portalCredential/i);
    expect(helper).not.toMatch(/process\.cwd|__dirname|file:\/\//);
  });

  it("preserves navigation and lifecycle/progression permission gates", () => {
    expect(source("lib/access-rules.ts")).toContain('{ href: "/udise", label: "UDISE Checklist", icon: "udise", permission: "VIEW_UDISE_CHECKLIST"');
    expect(source("app/students/lifecycle/page.tsx")).toContain('requirePermission("VIEW_STUDENT_LIFECYCLE")');
    expect(source("app/students/progression/page.tsx")).toContain('requirePermission("VIEW_STUDENT_PROGRESSION")');
  });

  it("labels every export as internal planning material rather than official submission", () => {
    const route = source("app/api/udise/export/route.ts");
    const helper = source("lib/udise-checklist.ts");
    expect(route).toContain("udiseChecklistFilename");
    expect(helper).toContain("udise-planning-masked-gap-report");
    expect(helper).toContain("udise-planning-source-register");
    expect(route).not.toContain("official-udise");
    expect(source("lib/udise-evidence-register.ts")).toContain("not official UDISE+ submission");
  });
});
