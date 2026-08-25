import { describe, expect, it } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { validateClassXPackageBackupRows } from "../lib/class-x-package-backup";
import { parseAndValidateBackup } from "../lib/restore";

const definition = JSON.stringify({ documents: [{ itemKey: "TC", itemType: "TRANSFER_CERTIFICATE", issuerType: "SCHOOL", displayName: "Transfer Certificate", required: true, displayOrder: 1, parentVisible: true, serialNumberRequired: false, handoverRequired: true }], allowPartialApprovalWhileAwaitingBoard: false, parentReceiptVisible: false });
const snapshot = JSON.stringify({ templateCode: "QA18B-T", name: "Template", versionNumber: 1, schoolBoard: null, instructions: null, ...JSON.parse(definition) });
function classXRows() { return {
  classXPackageTemplates: [{ id: "t", templateCode: "QA18B-T", packageType: "CLASS_X_COMPLETION_PACKAGE", name: "Template", status: "ACTIVE", versionNumber: 1, documentDefinitionJson: definition }],
  classXDocumentPackages: [{ id: "p", packageNumber: "QA18B-P", packageType: "CLASS_X_COMPLETION_PACKAGE", studentId: "s", academicYear: "2026-27", templateId: "t", status: "COMPLETED", requestSource: "INTERNAL", templateSnapshotJson: snapshot, eligibilitySnapshotJson: "{}", paymentRequired: false }],
  classXPackageDocumentItems: [{ id: "i", packageId: "p", itemKey: "TC", itemType: "TRANSFER_CERTIFICATE", issuerType: "SCHOOL", displayName: "Transfer Certificate", status: "HANDED_OVER" }],
  classXPackageChargeRules: [{ id: "r", ruleCode: "QA18B-R", packageType: "CLASS_X_COMPLETION_PACKAGE", name: "Rule", amount: "0", miscellaneousIncomeItemCode: "CLASS-X-CERT" }],
  classXPackageCharges: [{ id: "c", packageId: "p", chargeRuleId: "r", chargeCode: "QA18B-C", originalAmount: "0", waivedAmount: "0", payableAmount: "0", paidAmount: "0", status: "NOT_REQUIRED" }],
  classXPackageHandovers: [{ id: "h", packageId: "p", handoverNumber: "QA18B-H", handoverDate: "2026-07-17T00:00:00.000Z", recipientType: "STUDENT", recipientName: "QA", recipientAcknowledgementText: "Received", itemSnapshotJson: "[]" }],
  classXPackageEvents: [{ id: "e", packageId: "p", documentItemId: "i", chargeId: "c", handoverId: "h", eventType: "PACKAGE_COMPLETED" }]
}; }
function backup() { const rows = classXRows(); return createBackupDocument({ generatedAt: new Date("2026-07-17"), generatedBy: "QA18B", students: [{ id: "s", admissionNo: "QA18B-S", academicYear: "2026-27", studentName: "QA", fatherName: "QA", className: "10", phone1: "000", status: "Active", studentType: "Normal", discountPercent: 0, startMonth: "June" }], feeStructures: [], payments: [], paymentAudits: [], users: [{ id: "u", username: "qa18b", passwordHash: "secret" }], ...rows }); }

describe("Class X package backup version 28", () => {
  it("includes all seven arrays and excludes actors/password hashes", () => { const value = backup(); expect(value.metadata.backupVersion).toBe(44); for (const key of Object.keys(classXRows())) expect((value as any)[key]).toHaveLength(1); expect(JSON.stringify(value)).not.toContain("passwordHash"); expect(JSON.stringify(value)).not.toContain("createdByUserId"); });
  it("keeps older backups compatible when Class X arrays are absent", () => { const old: any = backup(); old.metadata.backupVersion = 27; for (const key of Object.keys(classXRows())) { delete old[key]; delete old.metadata.counts[key]; } expect(parseAndValidateBackup(old).classXDocumentPackages).toEqual([]); });
  it("rejects duplicate package, charge, and handover identities", () => { const rows: any = classXRows(), context = { studentIds: new Set(["s"]), guardianIds: new Set<string>(), certificateIds: new Set<string>(), certificateVersionIds: new Set<string>(), miscReceiptIds: new Set<string>() }; rows.classXDocumentPackages.push({ ...rows.classXDocumentPackages[0], id: "p2" }); expect(() => validateClassXPackageBackupRows(rows, context)).toThrow(/duplicate/); });
  it("rejects unrelated Student and broken receipt links", () => { const rows: any = classXRows(); expect(() => validateClassXPackageBackupRows(rows, { studentIds: new Set(["other"]), guardianIds: new Set(), certificateIds: new Set(), certificateVersionIds: new Set(), miscReceiptIds: new Set() })).toThrow(/Student/); rows.classXPackageCharges[0].status = "PAID"; rows.classXPackageCharges[0].linkedMiscIncomeReceiptId = "missing"; expect(() => validateClassXPackageBackupRows(rows, { studentIds: new Set(["s"]), guardianIds: new Set(), certificateIds: new Set(), certificateVersionIds: new Set(), miscReceiptIds: new Set() })).toThrow(/Miscellaneous Income/); });
});
