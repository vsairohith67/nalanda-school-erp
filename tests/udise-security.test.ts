import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const source = (file: string) => fs.readFileSync(path.join(root, file), "utf8");

describe("UDISE checklist route and privacy boundaries", () => {
  it("guards every page and API server-side", () => {
    for (const page of ["app/udise/page.tsx", "app/udise/students/page.tsx", "app/udise/staff/page.tsx", "app/udise/summary/page.tsx"]) expect(source(page), page).toContain('requirePermission("VIEW_UDISE_CHECKLIST")');
    for (const route of ["app/api/udise/summary/route.ts", "app/api/udise/students/route.ts", "app/api/udise/staff/route.ts"]) expect(source(route), route).toContain('requireApiPermission("VIEW_UDISE_CHECKLIST")');
    expect(source("app/api/udise/export/route.ts")).toContain('requireApiPermission("EXPORT_UDISE_CHECKLIST")');
    for (const route of ["summary", "students", "staff", "export"]) {
      const routeSource = source(`app/api/udise/${route}/route.ts`);
      expect(routeSource).toContain("export async function GET");
      expect(routeSource).not.toMatch(/export async function (POST|PUT|PATCH|DELETE)/);
    }
  });

  it("uses allowlisted query fields and keeps internal IDs, hashes, and secrets out of payload shaping", () => {
    const helper = source("lib/udise-checklist.ts");
    const apiSources = ["summary", "students", "staff"].map((name) => source(`app/api/udise/${name}/route.ts`)).join("\n");
    expect(helper).toContain("select: {");
    expect(helper).not.toMatch(/passwordHash:\s*true|guardianId:\s*true|userId:\s*true/);
    expect(apiSources).not.toMatch(/passwordHash|DATABASE_URL|process\.env/);
    expect(helper).not.toMatch(/process\.cwd|__dirname|file:\/\//);
  });

  it("does not render Aadhaar values or operational mutation controls", () => {
    const pages = ["app/udise/page.tsx", "app/udise/students/page.tsx", "app/udise/staff/page.tsx", "app/udise/summary/page.tsx"].map(source).join("\n");
    expect(pages).not.toContain("aadhaarNo");
    expect(pages).not.toContain('method="post"');
    expect(pages).not.toMatch(/create\(|update\(|delete\(|upsert\(/);
  });

  it("keeps navigation permission-gated and preserves lifecycle/progression guards", () => {
    expect(source("lib/access-rules.ts")).toContain('{ href: "/udise", label: "UDISE Checklist", icon: "udise", permission: "VIEW_UDISE_CHECKLIST"');
    expect(source("app/students/lifecycle/page.tsx")).toContain('requirePermission("VIEW_STUDENT_LIFECYCLE")');
    expect(source("app/students/progression/page.tsx")).toContain('requirePermission("VIEW_STUDENT_PROGRESSION")');
  });

  it("labels export as a checklist gap report rather than official submission", () => {
    const route = source("app/api/udise/export/route.ts");
    expect(route).toContain("udiseChecklistFilename");
    expect(source("lib/udise-checklist.ts")).toContain("udise-planning-checklist-gap-report");
    expect(route).not.toContain("official-udise");
  });
});
