import fs from "node:fs"; import path from "node:path"; import { describe, expect, it } from "vitest";
const source = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");
describe("staff UI and access safety", () => {
  it("protects staff pages and APIs and keeps parent/teacher defaults out", () => {
    expect(source("app/staff/page.tsx")).toContain('requirePermission("VIEW_STAFF")');
    expect(source("app/api/staff/route.ts")).toContain('requireApiPermission("VIEW_STAFF")');
    expect(source("app/api/staff/route.ts")).toContain('requireApiPermission("MANAGE_STAFF")');
    expect(source("app/api/import/staff/route.ts")).toContain('requireApiPermission("IMPORT_STAFF")');
  });
  it("routes teachers to a placeholder with linked staff basics", () => {
    expect(source("lib/navigation.ts")).toContain('if (role === "TEACHER") return "/teacher"');
    const page = source("app/teacher/page.tsx");
    expect(page).toContain('requirePermission("VIEW_TEACHER_PLACEHOLDER")');
    expect(page).toContain("Staff Profile Basics");
    expect(page).toContain("Exact-scope student attendance is available");
    expect(page).toContain("Permission alone never grants a cohort");
  });
  it("does not create users during import and keeps timetable linking optional", () => {
    const api = source("app/api/import/staff/route.ts");
    expect(api).not.toContain("user.create");
    expect(source("prisma/schema.prisma")).toMatch(/timetableTeacherId\s+String\?\s+@unique/);
  });
  it("creates login links atomically and rejects duplicate optional links clearly", () => {
    const links = source("app/api/staff/[id]/links/route.ts");
    expect(links).toContain("prisma.$transaction");
    expect(links).toContain("This Teacher login is already linked to another staff profile");
    expect(links).toContain("This timetable teacher is already linked to another staff profile");
    const shell = source("components/app-shell.tsx");
    expect(shell).toContain("teacherInternalNavItems.length === 0");
  });
});
