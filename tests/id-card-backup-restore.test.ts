import { describe, expect, it } from "vitest";
import { createBackupDocument } from "@/lib/backup";
import { validateIdentityCardBackupRows } from "@/lib/id-card-backup";
import { parseAndValidateBackup } from "@/lib/restore";

const front = JSON.stringify({ title: "STUDENT ID CARD", fields: ["studentName","cardNumber","photoPlaceholder"] });
const back = JSON.stringify({ title: "SCHOOL ID CARD", fields: ["validFrom","validUntil","returnToSchool"] });
function rows() {
  return {
    identityCardNumberSeries: [{ id: "ser", seriesCode: "QA18C-SER", cardType: "STUDENT", nextNumber: 2, paddingLength: 4, prefix: "QA18C-", resetPolicy: "ACADEMIC_YEAR", status: "ACTIVE", isDefault: true }],
    identityCardTemplates: [{ id: "tpl", templateCode: "QA18C-TPL", cardType: "STUDENT", name: "QA", status: "ACTIVE", versionNumber: 1, frontDefinitionJson: front, backDefinitionJson: back, photoRequired: false, barcodeEnabled: true }],
    identityCardBatches: [{ id: "bat", batchNumber: "QA18C-BAT", cardType: "STUDENT", academicYear: "2026-27", templateId: "tpl", scopeType: "CLASS_SECTION", validFrom: "2026-06-01T00:00:00.000Z", validUntil: "2027-05-31T00:00:00.000Z", status: "ISSUED", expectedCount: 1, eligibleCount: 1, issuedCount: 1, skippedCount: 0, scopeSnapshotJson: "[]" }],
    identityCards: [{ id: "card", cardType: "STUDENT", batchId: "bat", templateId: "tpl", studentId: "stu", academicYear: "2026-27", cardNumber: "QA18C-0001", validFrom: "2026-06-01T00:00:00.000Z", validUntil: "2027-05-31T00:00:00.000Z", status: "ISSUED", currentVersionNumber: 1, draftDataJson: "{}", templateSnapshotJson: "{}" }],
    identityCardVersions: [{ id: "ver", identityCardId: "card", versionNumber: 1, versionType: "ORIGINAL", cardNumber: "QA18C-0001", snapshotJson: "{}", issuedAt: "2026-07-17T00:00:00.000Z" }],
    identityCardEvents: [{ id: "evt", batchId: "bat", identityCardId: "card", versionId: "ver", eventType: "CARD_ISSUED", eventDate: "2026-07-17T00:00:00.000Z" }]
  };
}
function backup() {
  return createBackupDocument({ generatedAt: new Date("2026-07-17"), generatedBy: "QA18C", students: [{ id: "stu", admissionNo: "QA18C-S", academicYear: "2026-27", studentName: "QA", fatherName: "QA", className: "10", phone1: "000", status: "Active", studentType: "Normal", discountPercent: 0, startMonth: "June" }], feeStructures: [], payments: [], paymentAudits: [], users: [{ id: "u", username: "qa18c", passwordHash: "secret" }], ...rows() });
}

describe("Prompt 18C backup version 29", () => {
  it("includes all six arrays and excludes actors/password hashes", () => {
    const value = backup(); expect(value.metadata.backupVersion).toBe(38);
    for (const key of Object.keys(rows())) expect((value as any)[key]).toHaveLength(1);
    expect(JSON.stringify(value)).not.toContain("passwordHash"); expect(JSON.stringify(value)).not.toContain("createdByUserId");
  });
  it("validates exact Student/Staff ownership, template/batch/version/event links", () => {
    expect(() => validateIdentityCardBackupRows(rows(), { studentIds: new Set(["stu"]), staffMemberIds: new Set() })).not.toThrow();
    expect(() => validateIdentityCardBackupRows(rows(), { studentIds: new Set(["other"]), staffMemberIds: new Set() })).toThrow(/ownership/);
  });
  it("isolates duplicate card, batch, template, and series identities before restore", () => {
    for (const key of ["identityCardNumberSeries","identityCardTemplates","identityCardBatches","identityCards"] as const) {
      const value: any = rows(); value[key].push({ ...value[key][0], id: "duplicate" });
      expect(() => validateIdentityCardBackupRows(value, { studentIds: new Set(["stu"]), staffMemberIds: new Set() }), key).toThrow(/duplicate/);
    }
  });
  it("rejects broken immutable versions and personal photo paths", () => {
    const broken: any = rows(); broken.identityCardVersions[0].identityCardId = "missing";
    expect(() => validateIdentityCardBackupRows(broken, { studentIds: new Set(["stu"]), staffMemberIds: new Set() })).toThrow(/invalid card/);
    const photo: any = rows(); photo.identityCards[0].draftDataJson = JSON.stringify({ photoUrl: "https://example.test/p.jpg" });
    expect(() => validateIdentityCardBackupRows(photo, { studentIds: new Set(["stu"]), staffMemberIds: new Set() })).toThrow(/photo path|remote URL/);
  });
  it("keeps older version-28 backups compatible when all ID-card arrays are absent", () => {
    const old: any = backup(); old.metadata.backupVersion = 28;
    for (const key of Object.keys(rows())) { delete old[key]; delete old.metadata.counts[key]; }
    const parsed = parseAndValidateBackup(old);
    expect(parsed.identityCards).toEqual([]); expect(parsed.identityCardVersions).toEqual([]);
  });
});
