import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { Prisma } from "@prisma/client";
import { can, PERMISSIONS } from "../lib/permissions";
import { parentDocumentStatus } from "../lib/class-x-document-items";
import { classXPackageCsv, classXPackageReport } from "../lib/class-x-package-reports";
import {
  buildClassXEligibilitySnapshot,
  createClassXPackage,
  transitionClassXPackage
} from "../lib/class-x-document-packages";
import { validateClassXChargeRuleInput, validateClassXTemplateDefinition } from "../lib/class-x-package-templates";
import { validateClassXTemplateSnapshot } from "../lib/class-x-template-definition";

const definition = { documents: [
  { itemKey: "TC", itemType: "TRANSFER_CERTIFICATE", issuerType: "SCHOOL", displayName: "Transfer Certificate", required: true, displayOrder: 1, parentVisible: true, serialNumberRequired: false, handoverRequired: true },
  { itemKey: "MIGRATION", itemType: "BOARD_MIGRATION_CERTIFICATE", issuerType: "BOARD", displayName: "Board Migration Certificate (external physical document)", required: true, displayOrder: 2, parentVisible: true, serialNumberRequired: false, handoverRequired: true }
], allowPartialApprovalWhileAwaitingBoard: false, parentReceiptVisible: true };

describe("Class X document package foundation", () => {
  it("strictly validates controlled template document items", () => {
    const parsed = validateClassXTemplateDefinition(definition);
    expect(parsed.documents).toHaveLength(2);
    expect(parsed.documents[1]).toMatchObject({ itemType: "BOARD_MIGRATION_CERTIFICATE", issuerType: "BOARD" });
    expect(() => validateClassXTemplateDefinition({ ...definition, script: "nope" })).toThrow(/unsupported field/);
    expect(() => validateClassXTemplateDefinition({ ...definition, documents: [{ ...definition.documents[0], displayName: "<script>alert(1)</script>" }] })).toThrow(/unsafe/);
  });
  it("blocks issuer/type mismatches and uncontrolled OTHER labels", () => {
    expect(() => validateClassXTemplateDefinition({ ...definition, documents: [{ ...definition.documents[0], issuerType: "BOARD" }] })).toThrow(/must use SCHOOL/);
    expect(() => validateClassXTemplateDefinition({ ...definition, documents: [{ ...definition.documents[1], itemType: "OTHER_BOARD_DOCUMENT", displayName: "Other Board Document" }] })).toThrow(/controlled specific/);
  });
  it("validates immutable snapshot metadata separately from the strict definition", () => {
    const snapshot = validateClassXTemplateSnapshot({ templateCode: "QA18B-TEMPLATE", name: "QA Class X Package", versionNumber: 1, schoolBoard: "Configured Board", instructions: "External Board custody records only.", ...definition });
    expect(snapshot.templateCode).toBe("QA18B-TEMPLATE");
    expect(snapshot.documents).toHaveLength(2);
    expect(() => validateClassXTemplateSnapshot({ templateCode: "QA18B-TEMPLATE", name: "QA", versionNumber: 1, schoolBoard: null, instructions: null, ...definition, extra: true })).toThrow(/unsupported field/);
  });
  it("validates non-negative configurable charge rules without hard-coded prices", () => {
    const rule = validateClassXChargeRuleInput({ ruleCode: "class x 2026", name: "Service", amount: "125.50", miscellaneousIncomeItemCode: "CLASS-X-CERT", paymentRequired: true, waiverAllowed: true });
    expect(rule.ruleCode).toBe("CLASS-X-2026");
    expect(rule.amount.toFixed(2)).toBe("125.50");
    expect(() => validateClassXChargeRuleInput({ ruleCode: "bad", name: "Bad", amount: "-1" })).toThrow();
  });
  it("maps internal Board custody statuses to Parent-safe wording", () => {
    expect(parentDocumentStatus("AWAITING_BOARD")).toBe("Awaiting Board");
    expect(parentDocumentStatus("UNDER_VERIFICATION")).toBe("Received by School");
    expect(parentDocumentStatus("READY_FOR_HANDOVER")).toBe("Ready for Collection");
  });
  it("adds the complete conservative permission matrix", () => {
    for (const permission of ["VIEW_CLASS_X_PACKAGES","MANAGE_CLASS_X_PACKAGES","REVIEW_CLASS_X_PACKAGES","APPROVE_CLASS_X_PACKAGES","MANAGE_CLASS_X_DOCUMENT_CUSTODY","CONFIGURE_CLASS_X_PACKAGE_TEMPLATES","CONFIGURE_CLASS_X_PACKAGE_CHARGES","APPROVE_CLASS_X_PACKAGE_CHARGES","COLLECT_CLASS_X_PACKAGE_PAYMENTS","WAIVE_CLASS_X_PACKAGE_CHARGES","HANDOVER_CLASS_X_DOCUMENTS","VIEW_CLASS_X_PACKAGE_REPORTS","EXPORT_CLASS_X_PACKAGE_REPORTS","REQUEST_OWN_CHILD_CLASS_X_PACKAGE","VIEW_OWN_CHILD_CLASS_X_PACKAGE"]) expect(PERMISSIONS).toContain(permission);
    expect(can("PRINCIPAL", "APPROVE_CLASS_X_PACKAGES")).toBe(true);
    expect(can("PRINCIPAL", "COLLECT_CLASS_X_PACKAGE_PAYMENTS")).toBe(false);
    expect(can("ADMIN", "MANAGE_CLASS_X_PACKAGES")).toBe(true);
    expect(can("ADMIN", "APPROVE_CLASS_X_PACKAGES")).toBe(false);
    expect(can("ACCOUNTANT", "COLLECT_CLASS_X_PACKAGE_PAYMENTS")).toBe(true);
    expect(can("ACCOUNTANT", "HANDOVER_CLASS_X_DOCUMENTS")).toBe(false);
    expect(can("VIEWER", "VIEW_CLASS_X_PACKAGE_REPORTS")).toBe(true);
    expect(can("VIEWER", "EXPORT_CLASS_X_PACKAGE_REPORTS")).toBe(false);
    expect(can("TEACHER", "VIEW_CLASS_X_PACKAGES")).toBe(false);
    expect(can("PARENT", "VIEW_OWN_CHILD_CLASS_X_PACKAGE")).toBe(true);
  });
  it("keeps package collection separate from fee Payment and reuses Miscellaneous Income", () => {
    const source = readFileSync("lib/class-x-package-payments.ts", "utf8");
    expect(source).toContain("miscIncomeReceipt.create");
    expect(source).toContain("linkedMiscIncomeReceiptId: null");
    expect(source).not.toContain(".payment.create");
    expect(source).not.toContain(".payment.update");
  });
  it("builds exact reconciliation metrics and formula-safe privacy CSV", () => {
    const decimal = (value: string) => new Prisma.Decimal(value);
    const rows: any[] = [{ packageNumber: "=X", academicYear: "2026-27", requestSource: "PARENT_PORTAL", status: "COMPLETED", totalRequiredItems: 1, readyItems: 0, handedOverItems: 1, createdAt: new Date("2026-07-01"), completedAt: new Date("2026-07-03"), eligibilitySnapshotJson: JSON.stringify({ student: { lifecycleStatus: "Active" } }), student: { studentName: "+Name", admissionNo: "A1" }, items: [{ issuerType: "BOARD", itemType: "BOARD_MIGRATION_CERTIFICATE", status: "HANDED_OVER" }], charge: { status: "PAID", originalAmount: decimal("100.00"), paidAmount: decimal("100.00"), linkedMiscIncomeReceipt: { status: "ACTIVE", netAmount: decimal("100.00") } } }];
    const report = classXPackageReport(rows); expect(report.mismatchCount).toBe(0); expect(report.averageTurnaroundDays).toBe(2);
    const csv = classXPackageCsv(rows); expect(csv).toContain("'=X"); expect(csv).toContain("'+Name"); expect(csv).not.toContain("guardian"); expect(csv).not.toContain("actor");
  });

  it("requires an exact-year Class X enrollment and does not fabricate manual review", async () => {
    const client: any = {
      student: { findFirst: async () => ({ id: "student-1", admissionNo: "A1", studentName: "Student", className: "X", section: "A", status: "Active" }) },
      academicYearEnrollment: { findMany: async () => [{ id: "e1", academicYear: "2025-26", className: "X", section: "A", status: "COMPLETED", enrollmentDate: new Date(), exitDate: null }] },
      studentLifecycleEvent: { findMany: async () => [] },
      studentProgressionDecision: { findMany: async () => [] },
      studentReportCard: { findMany: async () => [] },
      studentCertificate: { findMany: async () => [] }
    };
    await expect(buildClassXEligibilitySnapshot(client, "student-1", "2026-27")).rejects.toThrow(/exact Class X enrollment for 2026-27/i);
    client.academicYearEnrollment.findMany = async () => [{ id: "e2", academicYear: "2026-27", className: "X", section: "A", status: "ACTIVE", enrollmentDate: new Date(), exitDate: null }];
    const snapshot: any = await buildClassXEligibilitySnapshot(client, "student-1", "2026-27");
    expect(snapshot.sourceStatus).toBe("EXACT_YEAR_CLASS_X_ENROLLMENT");
    expect(snapshot).not.toHaveProperty("manuallyReviewed");
    expect(snapshot).not.toHaveProperty("reviewedAt");
  });

  it("rejects a duplicate active package inside the creation transaction", async () => {
    const client: any = {
      $transaction: async (work: any) => work(client),
      classXDocumentPackage: { findFirst: async () => ({ packageNumber: "CXP-EXISTING" }) }
    };
    await expect(createClassXPackage(client, {
      studentId: "student-1", academicYear: "2026-27", templateId: "template-1"
    }, { id: "user-1", source: "INTERNAL" })).rejects.toThrow(/active Class X package already exists.*CXP-EXISTING/i);
  });

  it("requires approval authority after approval and blocks cancellation after partial handover", async () => {
    const makeClient = (status: string) => {
      const client: any = {
        $transaction: async (work: any) => work(client),
        classXDocumentPackage: { findUnique: async () => ({ id: "package-1", status, updatedAt: new Date(), items: [], charge: null }) }
      };
      return client;
    };
    await expect(transitionClassXPackage(makeClient("APPROVED"), "package-1", "cancel", "user-1", { reason: "Correction" })).rejects.toThrow(/approval authority/i);
    await expect(transitionClassXPackage(makeClient("PARTIALLY_HANDED_OVER"), "package-1", "cancel", "user-1", { reason: "Correction", postApprovalAuthorized: true })).rejects.toThrow(/partially handed-over/i);
    const route = readFileSync("app/api/class-x-documents/[id]/workflow/route.ts", "utf8");
    expect(route).toContain('requireApiPermission("APPROVE_CLASS_X_PACKAGES")');
    expect(route).toContain("postApprovalAuthorized");
  });

  it("bounds Class X report and export queries", () => {
    for (const file of ["app/class-x-documents/reports/page.tsx", "app/api/class-x-documents/reports/route.ts", "app/api/class-x-documents/reports/export/route.ts"]) {
      expect(readFileSync(file, "utf8")).toContain("take: CLASS_X_REPORT_ROW_LIMIT");
    }
  });
});
