import { describe, expect, it } from "vitest";
import {
  canOpenImportExportWorkspace,
  groupedVisibleNavigationItems,
  visibleNavigationItems
} from "../lib/access-rules";
import { getEffectivePermissions } from "../lib/role-permissions";

describe("access rules", () => {
  const emptyClient = { rolePermission: { findMany: async () => [] } };
  const restrictedManagementHrefs = [
    "/payments/new",
    "/attendance/students",
    "/attendance/staff",
    "/leave/staff",
    "/substitutes",
    "/users",
    "/roles",
    "/settings",
    "/import-export",
    "/import-verification",
    "/pilot-acceptance"
  ];

  it("keeps role-specific self-service links out of privileged staff navigation", async () => {
    const permissions = await getEffectivePermissions(emptyClient as never, "SUPER_ADMIN");
    const superAdminHrefs = visibleNavigationItems(permissions, "SUPER_ADMIN").map((item) => item.href);
    expect(superAdminHrefs).not.toContain("/parent/class-x-documents");
    expect(superAdminHrefs).not.toContain("/teacher/analytics");
    expect(visibleNavigationItems(permissions, "PARENT").map((item) => item.href)).toContain("/parent/class-x-documents");
    expect(visibleNavigationItems(permissions, "TEACHER").map((item) => item.href)).toContain("/teacher/analytics");
  });

  it("shows only permitted sidebar navigation for practical roles", async () => {
    const directorNav = visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "DIRECTOR"));
    expect(directorNav.map((item) => item.href)).toContain("/users");
    expect(directorNav.map((item) => item.href)).not.toContain("/roles");

    const accountantNav = visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "ACCOUNTANT"));
    expect(accountantNav.map((item) => item.href)).toEqual(expect.arrayContaining([
      "/dashboard",
      "/payments",
      "/payments/new",
      "/pending-dues",
      "/daily-collection",
      "/ledger",
      "/receipt-audit",
      "/import-export"
    ]));
    expect(accountantNav.map((item) => item.href)).not.toContain("/users");
    expect(accountantNav.map((item) => item.href)).not.toContain("/roles");
    expect(accountantNav.map((item) => item.href)).not.toContain("/timetable");
    expect(accountantNav.map((item) => item.href)).not.toContain("/staff");
  });

  it("keeps Viewer/Auditor reports-only, Teacher operational access scoped, and Parent off internal ERP pages", async () => {
    const viewerNav = visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "VIEWER"), "VIEWER");
    expect(viewerNav.map((item) => item.href)).toEqual([
      "/dashboard",
      "/students/lifecycle",
      "/students/progression",
      "/udise",
      "/admission-crm/reports",
      "/staff",
      "/attendance/students/reports",
      "/attendance/staff/reports",
      "/leave/staff/reports",
      "/substitutes/reports",
      "/notices",
      "/notifications/reports",
      "/whatsapp",
      "/whatsapp/reports",
      "/sms-email",
      "/sms-email/reports",
      "/homework/reports",
      "/classwork",
      "/marks/reports",
      "/report-cards/reports",
      "/academic-reports",
      "/certificates/reports",
      "/class-x-documents/reports",
      "/id-cards/reports",
      "/teacher-analytics/reports",
      "/fee-register-ocr/reports",
      "/cloud-backup",
      "/cloud-backup/reports",
      "/website-admin",
      "/pending-dues",
      "/daily-collection",
      "/expenses",
      "/expenses/reports",
      "/budgets",
      "/budgets/reports",
      "/misc-income",
      "/misc-income/reports",
      "/books",
      "/books/reports",
      "/library",
      "/cash-book",
      "/cash-book/reports"
    ]);

    const teacherNav = visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "TEACHER"), "TEACHER");
    expect(teacherNav.map((item) => item.href)).toEqual(["/admission-crm", "/attendance/students", "/attendance/students/reports", "/leave/staff", "/substitutes", "/my-payroll", "/homework/reports", "/homework", "/classwork", "/exams", "/teacher/calendar", "/teacher/exam-assignments", "/marks", "/report-cards", "/teacher/analytics"]);

    const parentNav = visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "PARENT"), "PARENT");
    expect(parentNav.map((item) => item.href)).toEqual(["/my-classwork", "/parent/calendar", "/parent/class-x-documents"]);
  });

  it("groups privileged navigation without changing permission visibility", async () => {
    const directorGroups = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "DIRECTOR"));
    expect(directorGroups.map((group) => group.label)).toEqual([
      "Dashboard",
      "Students & Parents",
      "Fees & Reports",
      "Attendance",
      "Staff & Leave",
      "Timetable",
      "Communication",
      "Administration",
      "System"
    ]);
    expect(new Set(directorGroups.flatMap((group) => group.items.map((item) => item.href)))).toEqual(
      new Set(visibleNavigationItems(await getEffectivePermissions(emptyClient as never, "DIRECTOR")).map((item) => item.href))
    );
    expect(directorGroups.find((group) => group.label === "Administration")?.items.map((item) => item.href))
      .toEqual(["/udise", "/ai-assistant", "/website-admin", "/library", "/users", "/permission-profiles", "/access-history"]);
  });

  it("keeps grouped navigation safe for Parent, Teacher, and Viewer/Auditor roles", async () => {
    const parentGroups = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "PARENT"), "PARENT");
    expect(parentGroups.map((group) => group.label)).toEqual(["Students & Parents"]);
    expect(parentGroups[0]?.items.map((item) => item.href)).toEqual(["/my-classwork", "/parent/calendar", "/parent/class-x-documents"]);

    const teacherGroups = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "TEACHER"), "TEACHER");
    expect(teacherGroups.map((group) => group.label)).toEqual(["Students & Parents", "Attendance", "Staff & Leave", "Communication"]);
    expect(teacherGroups.flatMap((group) => group.items.map((item) => item.href))).toEqual([
      "/admission-crm",
      "/attendance/students",
      "/attendance/students/reports",
      "/leave/staff",
      "/substitutes",
      "/my-payroll",
      "/teacher/analytics",
      "/homework/reports",
      "/homework",
      "/classwork",
      "/exams",
      "/teacher/calendar",
      "/teacher/exam-assignments",
      "/marks",
      "/report-cards"
    ]);

    const viewerGroups = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "VIEWER"), "VIEWER");
    const viewerHrefs = viewerGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(viewerHrefs).toContain("/attendance/students/reports");
    expect(viewerHrefs).toContain("/students/lifecycle");
    expect(viewerHrefs).toContain("/udise");
    expect(viewerHrefs).toContain("/admission-crm/reports");
    expect(viewerHrefs).toContain("/attendance/staff/reports");
    expect(viewerHrefs).toContain("/leave/staff/reports");
    expect(viewerHrefs).toContain("/substitutes/reports");
    expect(viewerHrefs).toContain("/homework/reports");
    expect(viewerHrefs).toContain("/marks/reports");
    expect(viewerHrefs).toContain("/report-cards/reports");
    expect(viewerHrefs).not.toContain("/payments/new");
    expect(viewerHrefs).not.toContain("/attendance/students");
    expect(viewerHrefs).not.toContain("/attendance/staff");
    expect(viewerHrefs).not.toContain("/leave/staff");
    expect(viewerHrefs).not.toContain("/roles");
  });

  it("keeps Super Admin, Admin, Principal, and Accountant grouped navigation in their intended lanes", async () => {
    const superAdminHrefs = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "SUPER_ADMIN"))
      .flatMap((group) => group.items.map((item) => item.href));
    expect(superAdminHrefs).toEqual(expect.arrayContaining(["/roles", "/users", "/settings", "/payments/new", "/attendance/staff", "/substitutes"]));

    const adminHrefs = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "ADMIN"))
      .flatMap((group) => group.items.map((item) => item.href));
    expect(adminHrefs).toEqual(expect.arrayContaining(["/users", "/settings", "/import-export", "/payments", "/attendance/staff"]));
    expect(adminHrefs).not.toContain("/roles");

    const principalHrefs = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "PRINCIPAL"))
      .flatMap((group) => group.items.map((item) => item.href));
    expect(principalHrefs).toEqual(expect.arrayContaining(["/students", "/staff", "/attendance/students", "/attendance/staff", "/leave/staff", "/substitutes", "/timetable", "/notices", "/exams/configuration"]));
    expect(principalHrefs).not.toContain("/payments");
    expect(principalHrefs).not.toContain("/users");
    expect(principalHrefs).not.toContain("/roles");
    expect(principalHrefs).not.toContain("/settings");
    expect(principalHrefs).not.toContain("/import-export");

    const accountantHrefs = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "ACCOUNTANT"))
      .flatMap((group) => group.items.map((item) => item.href));
    expect(accountantHrefs).toEqual([
      "/dashboard",
      "/fee-register-ocr",
      "/fee-register-ocr/reports",
      "/payments",
      "/payments/new",
      "/pending-dues",
      "/daily-collection",
      "/ledger",
      "/receipt-audit",
      "/vendors",
      "/expenses",
      "/expenses/reports",
      "/budgets",
      "/budgets/reports",
      "/misc-income",
      "/misc-income/reports",
      "/books",
      "/books/reports",
      "/cash-book",
      "/cash-book/reports",
      "/payroll",
      "/payroll/reports",
      "/my-payroll",
      "/class-x-documents",
      "/class-x-documents/reports",
      "/import-export"
    ]);
    expect(accountantHrefs).not.toEqual(expect.arrayContaining([
      "/guardians",
      "/attendance/students",
      "/attendance/staff",
      "/leave/staff",
      "/substitutes",
      "/timetable",
      "/notices",
      "/users",
      "/roles",
      "/settings"
    ]));
  });

  it("does not expose restricted action or management links to Viewer/Auditor grouped navigation", async () => {
    const viewerHrefs = groupedVisibleNavigationItems(await getEffectivePermissions(emptyClient as never, "VIEWER"))
      .flatMap((group) => group.items.map((item) => item.href));

    for (const href of restrictedManagementHrefs) {
      expect(viewerHrefs).not.toContain(href);
    }
    expect(viewerHrefs).toEqual(expect.arrayContaining([
      "/attendance/students/reports",
      "/attendance/staff/reports",
      "/leave/staff/reports",
      "/substitutes/reports",
      "/pending-dues",
      "/daily-collection"
    ]));
  });

  it("opens import/export only when the role has workspace and at least one related action", () => {
    expect(canOpenImportExportWorkspace(["VIEW_IMPORT_EXPORT"])).toBe(true);
    expect(canOpenImportExportWorkspace(["VIEW_DASHBOARD"])).toBe(false);
    expect(canOpenImportExportWorkspace(["RUN_BACKUP"])).toBe(true);
  });
});
