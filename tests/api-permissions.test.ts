import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("API and direct route permission declarations", () => {
  it("keeps role permission APIs behind MANAGE_ROLE_PERMISSIONS", () => {
    expect(source("app/api/roles/permissions/route.ts")).toContain('requireApiPermission("MANAGE_ROLE_PERMISSIONS")');
    expect(source("app/api/roles/permissions/reset/route.ts")).toContain('requireApiPermission("MANAGE_ROLE_PERMISSIONS")');
  });

  it("keeps core API families behind their module permissions", () => {
    expect(source("app/api/payments/route.ts")).toContain('requireApiPermission("CREATE_PAYMENTS")');
    expect(source("app/api/payments/[id]/restore/route.ts")).toContain('requireApiPermission("RESTORE_PAYMENTS")');
    expect(source("app/api/import/students/route.ts")).toContain('requireApiPermission("IMPORT_STUDENTS")');
    expect(source("app/api/import/guardians/route.ts")).toContain('requireApiPermission("IMPORT_GUARDIANS")');
    expect(source("app/api/import/guardians/template/route.ts")).toContain('requireApiPermission("IMPORT_GUARDIANS")');
    expect(source("app/api/guardians/route.ts")).toContain('requireApiPermission("VIEW_GUARDIANS")');
    expect(source("app/api/guardians/route.ts")).toContain('requireApiPermission("MANAGE_GUARDIANS")');
    expect(source("app/api/guardians/[id]/students/route.ts")).toContain('requireApiPermission("MANAGE_GUARDIANS")');
    expect(source("app/api/guardians/[id]/students/route.ts")).toContain("This guardian is already linked to this student");
    expect(source("app/api/guardians/[id]/parent-user/route.ts")).toContain('requireApiPermission("MANAGE_GUARDIANS")');
    expect(source("app/api/import/payments/route.ts")).toContain('requireApiPermission("CREATE_PAYMENTS")');
    expect(source("app/api/backup/route.ts")).toContain('requireApiPermission("RUN_BACKUP")');
    expect(source("app/api/restore/route.ts")).toContain('requireApiPermission("RUN_RESTORE")');
    expect(source("app/api/users/route.ts")).toContain('requireApiPermission("VIEW_USERS")');
    expect(source("app/api/users/route.ts")).toContain('requireApiPermission("MANAGE_USERS")');
    expect(source("app/api/users/[id]/reset-password/route.ts")).toContain('requireApiPermission("RESET_USER_PASSWORDS")');
    expect(source("app/api/timetable/generate/route.ts")).toContain('requireApiPermission("RUN_TIMETABLE_GENERATOR")');
    expect(source("app/api/timetable/entries/route.ts")).toContain('requireApiPermission("MANAGE_TIMETABLE_BUILDER")');
    expect(source("app/api/parent/dashboard/route.ts")).toContain("requireUser()");
    expect(source("app/api/parent/dashboard/route.ts")).toContain('user.role !== "PARENT"');
    expect(source("app/api/notices/route.ts")).toContain('requireApiPermission("VIEW_NOTICES")');
    expect(source("app/api/notices/route.ts")).toContain('requireApiPermission("MANAGE_NOTICES")');
    expect(source("app/api/attendance/students/route.ts")).toContain('requireApiPermission("VIEW_STUDENT_ATTENDANCE")');
    expect(source("app/api/attendance/students/route.ts")).toContain('"SUBMIT_STUDENT_ATTENDANCE"');
    expect(source("app/api/attendance/students/route.ts")).toContain('"LOCK_STUDENT_ATTENDANCE"');
    expect(source("app/api/attendance/students/route.ts").match(/requireApiPermission\("MANAGE_STUDENT_ATTENDANCE"\)/g)?.length).toBeGreaterThanOrEqual(1);
    expect(source("app/api/attendance/staff/route.ts")).toContain('requireApiPermission("VIEW_STAFF_ATTENDANCE")');
    expect(source("app/api/attendance/staff/route.ts")).toContain('"SUBMIT_STAFF_ATTENDANCE"');
    expect(source("app/api/attendance/staff/route.ts")).toContain('"LOCK_STAFF_ATTENDANCE"');
    expect(source("app/api/attendance/staff/reports/export/route.ts")).toContain('requireApiPermission("VIEW_STAFF_ATTENDANCE_REPORTS")');
    expect(source("app/api/substitutes/route.ts")).toContain('requireApiPermission("VIEW_SUBSTITUTES")');
    expect(source("app/api/substitutes/route.ts")).toContain('requireApiPermission("MANAGE_SUBSTITUTES")');
    expect(source("app/api/substitutes/[id]/route.ts")).toContain('requireApiPermission("VIEW_SUBSTITUTES")');
    expect(source("app/api/substitutes/suggestions/route.ts")).toContain('requireApiPermission("ASSIGN_SUBSTITUTES")');
    expect(source("app/api/substitutes/reports/export/route.ts")).toContain('requireApiPermission("VIEW_SUBSTITUTE_REPORTS")');
    expect(source("app/api/students/progression/route.ts")).toContain('requireApiPermission("VIEW_STUDENT_PROGRESSION")');
    expect(source("app/api/students/progression/route.ts")).toContain('requireApiPermission("MANAGE_STUDENT_PROGRESSION")');
    expect(source("app/api/students/progression/[id]/route.ts")).toContain('"APPROVE_STUDENT_PROGRESSION"');
    expect(source("app/api/students/progression/[id]/route.ts")).toContain('"FINALIZE_STUDENT_PROGRESSION"');
  });

  it("keeps direct role pages redirecting to unauthorized when access is missing", () => {
    expect(source("app/roles/page.tsx")).toContain('requirePermission("MANAGE_ROLE_PERMISSIONS")');
    expect(source("app/guardians/page.tsx")).toContain('requirePermission("VIEW_GUARDIANS")');
    expect(source("app/guardians/[id]/page.tsx")).toContain('requirePermission("VIEW_GUARDIANS")');
    expect(source("app/parent/page.tsx")).toContain('requirePermission("VIEW_PARENT_PLACEHOLDER")');
    expect(source("app/notices/page.tsx")).toContain('requirePermission("VIEW_NOTICES")');
    expect(source("app/import-export/page.tsx")).toContain('redirect("/unauthorized")');
    expect(source("app/import-verification/page.tsx")).toContain('redirect("/unauthorized")');
    expect(source("app/import-verification/[id]/page.tsx")).toContain('redirect("/unauthorized")');
  });

  it("keeps parent-blocked internal pages behind staff permissions or unavailable routes", () => {
    const guardedPages = {
      "app/students/page.tsx": 'requirePermission("VIEW_STUDENTS")',
      "app/students/new/page.tsx": 'requirePermission("CREATE_STUDENTS")',
      "app/students/[id]/edit/page.tsx": 'requirePermission("EDIT_STUDENTS")',
      "app/payments/page.tsx": 'requirePermission("VIEW_PAYMENTS")',
      "app/payments/new/page.tsx": 'requirePermission("CREATE_PAYMENTS")',
      "app/payments/[id]/edit/page.tsx": 'requirePermission("EDIT_PAYMENTS")',
      "app/ledger/page.tsx": 'requirePermission("VIEW_LEDGER")',
      "app/ledger/print/page.tsx": 'requirePermission("PRINT_LEDGER")',
      "app/pending-dues/page.tsx": 'requirePermission("VIEW_PENDING_DUES")',
      "app/daily-collection/page.tsx": 'requirePermission("VIEW_DAILY_COLLECTION")',
      "app/receipt-audit/page.tsx": 'requirePermission("VIEW_RECEIPT_AUDIT")',
      "app/users/page.tsx": 'requirePermission("VIEW_USERS")',
      "app/roles/page.tsx": 'requirePermission("MANAGE_ROLE_PERMISSIONS")',
      "app/guardians/page.tsx": 'requirePermission("VIEW_GUARDIANS")',
      "app/notices/page.tsx": 'requirePermission("VIEW_NOTICES")',
      "app/settings/page.tsx": 'requirePermission("VIEW_SETTINGS")',
      "app/pilot-acceptance/page.tsx": 'requirePermission("RUN_PILOT_ACCEPTANCE")',
      "app/timetable/page.tsx": 'requirePermission("VIEW_TIMETABLE")',
      "app/timetable/builder/page.tsx": 'requirePermission("MANAGE_TIMETABLE_BUILDER")',
      "app/timetable/generate/page.tsx": 'requirePermission("RUN_TIMETABLE_GENERATOR")',
      "app/timetable/settings/page.tsx": 'requirePermission("MANAGE_TIMETABLE_MASTER")'
      ,"app/attendance/students/page.tsx": 'requirePermission("VIEW_STUDENT_ATTENDANCE")'
      ,"app/attendance/students/reports/page.tsx": 'requirePermission("VIEW_STUDENT_ATTENDANCE_REPORTS")'
      ,"app/students/lifecycle/page.tsx": 'requirePermission("VIEW_STUDENT_LIFECYCLE")'
      ,"app/students/[id]/lifecycle/page.tsx": 'requirePermission("VIEW_STUDENT_LIFECYCLE")'
      ,"app/students/progression/page.tsx": 'requirePermission("VIEW_STUDENT_PROGRESSION")'
      ,"app/students/progression/new/page.tsx": 'requirePermission("MANAGE_STUDENT_PROGRESSION")'
      ,"app/students/progression/[id]/page.tsx": 'requirePermission("VIEW_STUDENT_PROGRESSION")'
      ,"app/attendance/staff/page.tsx": 'requirePermission("VIEW_STAFF_ATTENDANCE")'
      ,"app/attendance/staff/reports/page.tsx": 'requirePermission("VIEW_STAFF_ATTENDANCE_REPORTS")'
      ,"app/substitutes/page.tsx": 'requirePermission("VIEW_SUBSTITUTES")'
      ,"app/substitutes/new/page.tsx": 'requirePermission("MANAGE_SUBSTITUTES")'
      ,"app/substitutes/planner/page.tsx": 'requirePermission("MANAGE_SUBSTITUTES")'
      ,"app/substitutes/reports/page.tsx": 'requirePermission("VIEW_SUBSTITUTE_REPORTS")'
    };

    for (const [path, expected] of Object.entries(guardedPages)) {
      expect(source(path), path).toContain(expected);
    }
  });

  it("protects lifecycle APIs server-side", () => {
    const overview = source("app/api/students/lifecycle/route.ts");
    const detail = source("app/api/students/[id]/lifecycle/route.ts");
    expect(overview).toContain('requireApiPermission("VIEW_STUDENT_LIFECYCLE")');
    expect(detail).toContain('requireApiPermission("VIEW_STUDENT_LIFECYCLE")');
    expect(overview).not.toContain("studentId: row.studentId");
    expect(detail).not.toContain("approvedByUserId: true");
    expect(detail).not.toContain("recordedByUserId: true");
  });

  it("keeps safe unauthorized API errors generic", () => {
    const auth = source("lib/auth.ts");
    expect(auth).toContain('"Authentication required"');
    expect(auth).toContain('"You do not have permission for this action"');
    expect(auth).toContain("sessionCredentialTagMatches(payload, user.passwordHash)");
    expect(auth).not.toContain("passwordHash: user.passwordHash");
  });

  it("keeps the parent portal read-only and free of internal ERP links", () => {
    const parentPage = source("app/parent/page.tsx");
    const parentHelper = source("lib/parent-portal.ts");
    expect(parentPage).toContain("No student is linked to this parent account yet. Please contact the school office.");
    expect(parentPage).toContain("This portal is read-only. Please contact the school office for payment or clarification.");
    expect(parentPage).toContain("No pending dues for this child.");
    expect(parentPage).toContain("data.notices");
    expect(parentHelper).toContain("getPublishedNoticesForChild(selectedChild, client)");
    expect(parentPage).toContain("No current notices.");
    for (const route of [
      "/students",
      "/payments",
      "/ledger",
      "/pending-dues",
      "/receipt-audit",
      "/users",
      "/roles",
      "/guardians",
      "/import-export",
      "/settings"
    ]) {
      expect(parentPage).not.toContain(`href="${route}"`);
    }
    expect(parentPage).not.toContain("method=\"post\"");
    expect(parentPage).not.toContain("/api/payments");
    expect(parentPage).not.toContain("Director Sir GPay");
    expect(parentPage).not.toContain("NPS Current Account UPI");
    expect(parentPage).not.toContain("NPS Bank Account");
  });

  it("keeps parent dashboard APIs and receipt print access server-side authorized", () => {
    const parentApi = source("app/api/parent/dashboard/route.ts");
    const receiptPrint = source("app/receipts/[receiptNo]/print/page.tsx");
    const loginForm = source("components/login-form.tsx");
    const middleware = source("middleware.ts");

    expect(parentApi).toContain("requireUser()");
    expect(parentApi).toContain('user.role !== "PARENT"');
    expect(parentApi).toContain("getParentDashboardData(user.id, studentId)");
    expect(parentApi).toContain("admissionNo");
    expect(receiptPrint).toContain("parentCanAccessReceiptRows");
    expect(receiptPrint).toContain("hasRolePermission");
    expect(receiptPrint).toContain('"PRINT_RECEIPTS"');
    expect(receiptPrint).toContain('user.role === "PARENT" ? "School Office" : receivedBy');
    expect(loginForm).toContain("defaultPathForRole");
    expect(middleware).toContain('pathname.startsWith("/api/")');
    expect(middleware).toContain('"Authentication required"');
  });

  it("keeps the student edit guardian helper text visible", () => {
    const studentEdit = source("app/students/[id]/edit/page.tsx");
    expect(studentEdit).toContain("Linked Guardians / Parents");
    expect(studentEdit).toContain("Student phone fields are operational contact fields; guardian links are for parent login and sibling grouping.");
  });
});
