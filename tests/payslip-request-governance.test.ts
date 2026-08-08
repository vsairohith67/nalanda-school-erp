import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";
import { requestEventLabel } from "@/lib/payslip-request";

const source = (file: string) => readFileSync(path.join(process.cwd(), file), "utf8");

describe("HR-PAYSLIP-REQ-1 governed workflow", () => {
  it("keeps payroll calculation operationally independent", () => {
    const service = source("lib/payslip-request.ts");
    expect(service).not.toMatch(/calculateSalary|calculatePayroll|netSalary|\bEPF\b|\bESI\b|\bTDS\b|CashBook|bank posting/i);
    expect(service).not.toContain("generatePayslipPdf");
    expect(service).toContain("HISTORICAL_RECORD");
    expect(service).toContain("latestCompletedSalaryMonth");
  });

  it("enforces the default permission separation", () => {
    const newPermissions = ["PREPARE_PAYSLIP_REQUEST", "UPLOAD_PAYSLIP_DOCUMENT", "ISSUE_PAYSLIP_DOCUMENT", "REPLACE_PAYSLIP_DOCUMENT", "VIEW_PAYSLIP_REQUEST_AUDIT", "MANAGE_PAYSLIP_MONTH_AVAILABILITY"] as const;
    for (const role of ["SUPER_ADMIN", "DIRECTOR"] as const) for (const permission of newPermissions) expect(RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)).toBe(true);
    for (const role of ["ACCOUNTANT", "PRINCIPAL", "ADMIN", "VIEWER"] as const) for (const permission of newPermissions) expect(RECOMMENDED_ROLE_PERMISSIONS[role].has(permission)).toBe(false);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("VIEW_OWN_PAYSLIP_REQUESTS")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.TEACHER.has("REQUEST_OWN_PAYSLIP")).toBe(true);
    expect(RECOMMENDED_ROLE_PERMISSIONS.PARENT.has("VIEW_OWN_PAYSLIP_REQUESTS")).toBe(false);
  });

  it("keeps password reveal Staff-owned, reauthenticated, rate-limited, and private", () => {
    const service = source("lib/payslip-request.ts"), route = source("app/api/my-payslip-requests/documents/[documentKey]/password/route.ts"), api = source("lib/payslip-request-api.ts");
    expect(service).toContain('actor.user.role !== "TEACHER"');
    expect(service).toContain('request: { staffMemberId: staff.id }');
    expect(service).toContain("requireCriticalReauthentication");
    expect(service).toContain("assertRevealRate");
    expect(route).toContain('"TEACHER"');
    expect(api).toContain("unsafeRequestOriginAllowed");
    expect(source("lib/payslip-request-notifications.ts")).not.toMatch(/passwordCiphertext|openingPassword|ownerPassword|salary|deductions/i);
  });

  it("uses qpdf through stdin without a shell and fails closed", () => {
    const pdf = source("lib/payslip-request-pdf.ts");
    expect(pdf).toContain('spawn(executable, ["@-"]');
    expect(pdf).toContain("shell: false");
    expect(pdf).toContain("windowsHide: true");
    expect(pdf).toContain("PDF_PROTECTION_UNAVAILABLE");
    expect(pdf).toContain('"--bits=256"');
    expect(pdf).toContain('"--modify=none"');
    expect(pdf).toContain('"--print=full"');
    expect(pdf).not.toMatch(/spawn\([^\n]+openingPassword|spawn\([^\n]+ownerPassword/);
  });

  it("keeps delivery private, session-bound, no-store, and outside PWA caching", () => {
    const download = source("app/api/my-payslip-requests/documents/[documentKey]/download/route.ts");
    expect(download).toContain("verifyPayslipDownload");
    expect(download).toContain('"Accept-Ranges": "none"');
    expect(source("lib/payslip-request.ts")).toContain('status: "ACTIVE", request: { staffMemberId: staff.id }');
    expect(source("lib/pwa-service-worker.ts")).not.toMatch(/payslip-request|my-payslip/i);
  });

  it("has one additive migration with append-only and immutable issue evidence", () => {
    const migration = source("prisma/migrations/20260808213000_staff_payslip_request_secure_delivery/migration.sql");
    for (const name of ["StaffPayslipRequest_no_delete", "StaffPayslipRequestEvent_no_update", "StaffPayslipDocumentVersion_issued_immutable", "StaffPayslipDocumentVersion_no_delete", "StaffPayslipAccessEvent_no_update"]) expect(migration).toContain(name);
    expect(migration).toContain("StaffPayslipRequestMonth_activeOverlapKey_key");
    expect(migration).toContain("StaffPayslipDocumentVersion_supersedesVersionId_key");
  });

  it("never silently overwrites an issued document", () => {
    const service = source("lib/payslip-request.ts");
    expect(service).toContain('status: "REPLACED"');
    expect(service).toContain("REPLACEMENT_CONFLICT");
    expect(service).toContain("supersedesVersionId");
    expect(service).toContain("generateDocumentPassword()");
  });

  it("never exposes raw workflow event enums to Staff", () => {
    expect(requestEventLabel("DOCUMENT_APPROVED_FOR_ISSUE")).toBe("Document approved for issue");
    expect(requestEventLabel("UNRECOGNISED_EVENT")).toBe("Workflow event");
  });
});
