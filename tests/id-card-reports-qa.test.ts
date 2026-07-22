import { describe, expect, it } from "vitest";
import { identityCardReport } from "@/lib/id-card-reports";

const template = { name: "QA18C Template" };
const numberSeries = { seriesCode: "QA18C-SERIES" };
const base = {
  academicYear: "2026-27",
  validFrom: new Date("2026-06-01T00:00:00.000Z"),
  currentVersionNumber: 1,
  template,
  numberSeries,
  draftDataJson: JSON.stringify({ identity: { className: "10", section: "A" } }),
  student: null,
  staffMember: null,
  replacesCardId: null
};

describe("Prompt 18C report totals", () => {
  it("calculates exact type, status, coverage, expiry, correction, replacement, and batch totals", async () => {
    const cards: any[] = [
      { ...base, id: "s-active", cardType: "STUDENT", studentId: "s1", staffMemberId: null, status: "ISSUED", validUntil: new Date("2099-05-31"), student: { studentName: "Student", admissionNo: "S1" } },
      { ...base, id: "s-revoked", cardType: "STUDENT", studentId: "s2", staffMemberId: null, status: "REVOKED", validUntil: new Date("2099-05-31"), student: { studentName: "Revoked", admissionNo: "S2" } },
      { ...base, id: "staff-expired", cardType: "STAFF", studentId: null, staffMemberId: "t1", status: "ISSUED", validUntil: new Date("2020-05-31"), staffMember: { fullName: "Expired Staff", staffCode: "T1", designation: "Teacher" } },
      { ...base, id: "staff-replacement", cardType: "STAFF", studentId: null, staffMemberId: "t2", status: "ISSUED", validUntil: new Date("2099-05-31"), replacesCardId: "old", staffMember: { fullName: "Replacement", staffCode: "T2", designation: "Teacher" } },
      { ...base, id: "cancelled", cardType: "STUDENT", studentId: "s3", staffMemberId: null, status: "CANCELLED", validUntil: new Date("2099-05-31"), student: { studentName: "Cancelled", admissionNo: "S3" } }
    ];
    const client: any = {
      identityCard: { findMany: async () => cards },
      identityCardVersion: { findMany: async () => [{ versionType: "ORIGINAL", supersedesVersionId: null }, { versionType: "CORRECTION", supersedesVersionId: "v1" }] },
      identityCardBatch: { findMany: async () => [{ skippedCount: 2 }, { skippedCount: 1 }] },
      identityCardEvent: { findMany: async () => [{ eventType: "LOOKUP_PERFORMED" }, { eventType: "CARD_ISSUED" }] },
      identityCardTemplate: { findMany: async () => [{ id: "tpl", name: "QA18C Template" }] },
      identityCardNumberSeries: { findMany: async () => [{ id: "series", seriesCode: "QA18C-SERIES", nextNumber: 4 }] },
      academicYearEnrollment: { count: async () => 4 },
      staffMember: { count: async () => 3 }
    };
    const report = await identityCardReport(client);
    expect(report.summary).toMatchObject({
      total: 5, student: 3, staff: 2, active: 2, expired: 1, revoked: 1, cancelled: 1,
      supersededVersions: 1, replacements: 1, corrections: 1,
      activeStudentCoverage: 1, activeStudentMissing: 3,
      activeStaffCoverage: 2, activeStaffMissing: 1,
      lookupEvents: 1, batches: 2, batchSkipped: 3, templates: 1, series: 1
    });
    expect(report.groups.academicYear).toEqual([{ label: "Academic year", value: "2026-27", count: 5 }]);
    expect(report.groups.classSection).toEqual([{ label: "Class / section", value: "10 / A", count: 3 }]);
  });
});
