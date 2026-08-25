import { describe, expect, it } from "vitest";
import { DEFAULT_SCHOOL_SETTINGS, type SchoolSettingsValue } from "../lib/school-settings";
import {
  buildUdiseChecklist,
  filterUdiseStaff,
  filterUdiseStudents,
  maskUdiseReference,
  UDISE_PLANNING_WARNING,
  UDISE_STAFF_ROW_LIMIT,
  UDISE_STUDENT_ROW_LIMIT,
  UDISE_VERIFICATION_WARNING,
  udiseChecklistCsv,
  udiseChecklistFilename,
  udiseSourceRegisterCsv,
  type UdiseStaffSource,
  type UdiseStudentSource
} from "../lib/udise-checklist";
import { UDISE_EVIDENCE, UDISE_EVIDENCE_REGISTER, UDISE_REGISTER_TOTALS } from "../lib/udise-evidence-register";

function student(overrides: Partial<UdiseStudentSource> = {}): UdiseStudentSource {
  return {
    admissionNo: "NPS-001",
    studentName: "Asha Student",
    fatherName: "Parent One",
    motherName: "Parent Two",
    phone1: "9999999999",
    phone2: null,
    whatsappNumber: "9999999999",
    className: "5",
    section: "A",
    status: "Active",
    dateOfBirth: new Date("2015-04-10"),
    address: "Available",
    aadhaarNo: "123412341234",
    guardians: [{ isPrimaryContact: true, guardian: { displayName: "Parent One", primaryMobile: "9999999999", alternateMobile: null } }],
    academicYearEnrollments: [{ academicYear: "2026-27", className: "5", section: "A", status: "ACTIVE", enrollmentDate: new Date("2026-06-10") }],
    lifecycleEvents: [],
    progressionDecisions: [],
    ...overrides
  };
}

function staff(overrides: Partial<UdiseStaffSource> = {}): UdiseStaffSource {
  return { staffCode: "T-01", fullName: "Asha Teacher", staffType: "TEACHING", designation: "Teacher", mobile: "9000000000", email: "asha@example.test", qualification: "B.Ed", status: "ACTIVE", ...overrides };
}

function report(students = [student()], staffRows = [staff()], school: SchoolSettingsValue | null = DEFAULT_SCHOOL_SETTINGS) {
  return buildUdiseChecklist({ students, staff: staffRows, school: school ? { ...school } : null });
}

describe("UDISE-15E-1C evidence and register", () => {
  it("pins the exact 2026-27 evidence metadata and preserves source conflicts", () => {
    const value = report();
    expect(value.warning).toBe(UDISE_PLANNING_WARNING);
    expect(value.verificationWarning).toBe(UDISE_VERIFICATION_WARNING);
    expect(value.evidence).toMatchObject({
      sourceId: "N1",
      academicCycle: "2026-27",
      publicFilename: "UDISE_DCF_Final_26_27_v3.pdf",
      internalVersion: "5.0",
      documentDate: "2026-07-15",
      reviewedDate: "2026-08-25",
      evidenceStatus: "UDISE_15E_EVIDENCE_PARTIAL"
    });
    expect(value.evidence.versionConflict).toContain("filename says v3");
    expect(value.evidence.portalVerificationWarning).toContain("Telangana workflow");
    expect(value.cycleStatus).toBe("CURRENT_CYCLE_MATCH");
    expect(report(undefined, undefined, { ...DEFAULT_SCHOOL_SETTINGS, academicYear: "2025-26" }).cycleStatus).toBe("SOURCE_CONFLICT");
  });

  it("reconciles 75 unique source groups and every required subtotal", () => {
    expect(UDISE_EVIDENCE_REGISTER).toHaveLength(75);
    expect(new Set(UDISE_EVIDENCE_REGISTER.map((row) => row.id)).size).toBe(75);
    expect(UDISE_REGISTER_TOTALS).toMatchObject({ total: 75, tracked: 8, partial: 21, notTracked: 23, sensitiveOrConditional: 17, portalOnlyOrUnverified: 6 });
    expect(UDISE_REGISTER_TOTALS.byDomain).toMatchObject({ SCHOOL: 18, FACILITY: 15, STUDENT: 27, STAFF: 14, BLOCK: 1 });
    expect(UDISE_EVIDENCE_REGISTER.every((row) => row.evidenceId === `${row.id === "ST27" ? "N7/N9/T3" : "N1"}:${row.id}` && row.sourceReference && !row.sourceReference.includes("source group") && row.currentErpMapping && row.recommendation)).toBe(true);
    expect(UDISE_EVIDENCE_REGISTER.find((row) => row.id === "S06")?.sourceReference).toBe("N1 DCF §1.12-1.15");
    expect(UDISE_EVIDENCE_REGISTER.find((row) => row.id === "ST20")?.sourceReference).toBe("N1 DCF §4.2.7");
    expect(UDISE_EVIDENCE_REGISTER.find((row) => row.id === "T14")?.sourceReference).toBe("N1 DCF §3.4-3.5");
    expect(UDISE_EVIDENCE_REGISTER.find((row) => row.id === "ST27")?.sourceReference).toContain("not a confirmed N1 DCF field");
    expect(Object.values(UDISE_REGISTER_TOTALS.byStatus).reduce((sum, count) => sum + count, 0)).toBe(75);
  });

  it("uses separate indicators and never emits a single compliance percentage", () => {
    const value = report();
    expect(value.indicators.erpDataPresence).toEqual({ presentCandidates: 20, partiallyTrackedCandidates: 4, missingOrNotTrackedCandidates: 3 });
    expect(value.indicators.schoolVerification).toEqual({ verifiedValues: 0, status: "NOT_IMPLEMENTED_IN_1C" });
    expect(value.indicators.officialEvidenceCoverage).toMatchObject({ attributedGroups: 75, totalGroups: 75, supportingManualsAndCodeLists: "PARTIAL" });
    expect(value.indicators.portalVerification).toEqual({ verifiedByAuthorisedHuman: 0, pendingGroups: 6 });
    expect(JSON.stringify(value)).not.toMatch(/compliancePercentage|overallPercentage|complianceScore/i);
  });

  it("fails closed when the official School Settings source row is missing", () => {
    const value = report(undefined, undefined, null);
    expect(value.cycleStatus).toBe("OFFICIAL_EVIDENCE_MISSING");
    expect(value.schoolAcademicYear).toBe("SOURCE_NOT_CONFIGURED");
    expect(Object.values(value.school).every((status) => status === "OFFICIAL_EVIDENCE_MISSING")).toBe(true);
  });
});

describe("UDISE-15E-1C Student correction logic", () => {
  it("replaces Complete wording with precise candidate and partial states", () => {
    const value = report();
    expect(value.students[0].dateOfBirthStatus).toBe("ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED");
    expect(value.students[0].addressStatus).toBe("PARTIALLY_TRACKED");
    expect(JSON.stringify(value)).not.toMatch(/\bComplete\b/);
    expect(udiseChecklistCsv(value, new Date("2026-08-25T00:00:00Z"))).not.toMatch(/\bComplete\b/);
  });

  it("uses only current-cycle enrollmentDate as a partial admission-date candidate", () => {
    expect(report().students[0]).toMatchObject({ admissionDateStatus: "PARTIALLY_TRACKED" });
    expect(report([student({ academicYearEnrollments: [{ academicYear: "2026-27", className: "5", section: "A", status: "ACTIVE", enrollmentDate: null }] })]).students[0]).toMatchObject({ admissionDateStatus: "NOT_TRACKED" });
    const wrongCycle = report([student({ academicYearEnrollments: [{ academicYear: "2025-26", className: "4", section: "A", status: "ACTIVE", enrollmentDate: new Date("2025-06-01") }] })]).students[0];
    expect(wrongCycle.admissionDateStatus).toBe("NOT_TRACKED");
    expect(wrongCycle.admissionDateExplanation).toContain("createdAt is never substituted");
  });

  it("reconciles direct and Guardian parent/contact sources without exposing values", () => {
    const directOnly = report([student({ guardians: [] })]).students[0];
    expect(directOnly).toMatchObject({ parentSourceStatus: "DIRECT_ONLY", contactSourceStatus: "DIRECT_ONLY" });

    const guardianOnly = report([student({ fatherName: "", motherName: null, phone1: "", phone2: null, whatsappNumber: null })]).students[0];
    expect(guardianOnly).toMatchObject({ parentSourceStatus: "GUARDIAN_ONLY", contactSourceStatus: "GUARDIAN_ONLY" });

    const both = report().students[0];
    expect(both).toMatchObject({ parentSourceStatus: "BOTH_CONSISTENT", contactSourceStatus: "BOTH_CONSISTENT" });

    const conflict = report([student({ guardians: [{ isPrimaryContact: true, guardian: { displayName: "Different Parent", primaryMobile: "8888888888", alternateMobile: null } }] })]).students[0];
    expect(conflict).toMatchObject({ parentSourceStatus: "BOTH_CONFLICT", contactSourceStatus: "BOTH_CONFLICT" });
    expect(conflict.gapTypes).toContain("source-conflict");

    const none = report([student({ fatherName: "", motherName: null, phone1: "", phone2: null, whatsappNumber: null, guardians: [] })]).students[0];
    expect(none).toMatchObject({ parentSourceStatus: "NONE", contactSourceStatus: "NONE" });

    const serialized = JSON.stringify([directOnly, guardianOnly, both, conflict, none]);
    for (const secretValue of ["9999999999", "8888888888", "Parent One", "Different Parent"]) expect(serialized).not.toContain(secretValue);
  });

  it("keeps free-text address partial and structured PIN/geography visibly missing", () => {
    const present = report().students[0];
    expect(present.addressStatus).toBe("PARTIALLY_TRACKED");
    expect(present.addressExplanation).toContain("structured PIN and geography are not tracked");
    const absent = report([student({ address: null })]).students[0];
    expect(absent.addressStatus).toBe("NOT_TRACKED");
    expect(absent.gapTypes).toContain("address");
  });

  it("treats Aadhaar as a non-display privacy boundary and never creates a sentinel", () => {
    const held = report([student({ aadhaarNo: "999999999999" })]);
    expect(held.students[0]).toMatchObject({ aadhaarStatus: "SENSITIVE_CONDITIONAL" });
    expect(held.students[0].aadhaarExplanation).toContain("not displayed, validated or counted");
    const absent = report([student({ aadhaarNo: null })]);
    expect(absent.students[0].aadhaarExplanation).toContain("no placeholder is created");
    for (const output of [JSON.stringify(held), udiseChecklistCsv(held, new Date("2026-08-25T00:00:00Z"))]) {
      expect(output).not.toContain("999999999999");
      expect(output).not.toContain("123412341234");
    }
  });

  it("makes lifecycle and progression gaps conditional by cycle and eligibility", () => {
    const newAdmission = report().students[0];
    expect(newAdmission.lifecycleStatus).toBe("NOT_APPLICABLE_TO_SCHOOL");
    expect(newAdmission.progressionStatus).toBe("NOT_APPLICABLE_TO_SCHOOL");
    expect(newAdmission.gapTypes).not.toContain("lifecycle");

    const continuing = report([student({ academicYearEnrollments: [
      { academicYear: "2025-26", className: "4", section: "A", status: "ACTIVE", enrollmentDate: new Date("2025-06-01") },
      { academicYear: "2026-27", className: "5", section: "A", status: "ACTIVE", enrollmentDate: new Date("2026-06-01") }
    ] })]).students[0];
    expect(continuing.lifecycleStatus).toBe("APPLICABILITY_UNCONFIRMED");
    expect(continuing.progressionStatus).toBe("APPLICABILITY_UNCONFIRMED");

    const exited = report([student({ status: "LEFT", lifecycleEvents: [] })]).students[0];
    expect(exited.lifecycleStatus).toBe("MISSING");
    expect(exited.gapTypes).toContain("lifecycle");

    const withEvent = report([student({ status: "LEFT", lifecycleEvents: [{ academicYear: "2026-27", eventType: "LEFT" }] })]).students[0];
    expect(withEvent.lifecycleStatus).toBe("ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED");

    const undatedEvent = report([student({ status: "LEFT", lifecycleEvents: [{ academicYear: null, eventType: "LEFT" }] })]);
    expect(undatedEvent.students[0].lifecycleStatus).toBe("MISSING");
    expect(undatedEvent.summary.lifecycleRecordsChecked).toBe(0);

    const finalised = report([student({ progressionDecisions: [{ academicYear: "2025-26", decisionType: "PROMOTE", status: "FINALIZED", toAcademicYear: "2026-27" }] })]).students[0];
    expect(finalised.progressionStatus).toBe("TRACKED_BUT_REQUIRES_VERIFICATION");
  });
});

describe("UDISE-15E-1C masked Staff and export behavior", () => {
  it("labels attendance and leave as internal foundations and excludes them from status totals", () => {
    const value = report();
    expect(value.staff[0]).toMatchObject({
      attendanceFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE",
      leaveFoundation: "INTERNAL_ERP_FOUNDATION_NOT_OFFICIAL_UDISE_EVIDENCE"
    });
    expect(Object.values(value.categoryCounts["Staff data"]).reduce((sum, count) => sum + count, 0)).toBe(9);
    expect(value.school).not.toHaveProperty("erpSettingsStatus");
    expect(Object.values(value.categoryCounts["School candidates"]).reduce((sum, count) => sum + count, 0)).toBe(5);
  });

  it("uses opaque and masked references without names, contacts, addresses or sensitive values", () => {
    const value = report([student({ admissionNo: "=HYPERLINK(\"bad\")", studentName: "+Formula" })], [staff({ staffCode: "@BAD", fullName: "Private Teacher" })]);
    const csv = udiseChecklistCsv(value, new Date("2026-08-25T00:00:00Z"));
    expect(value.students[0].rowReference).toMatch(/^STU-[A-F0-9]{16}$/);
    expect(value.staff[0].rowReference).toMatch(/^STF-[A-F0-9]{16}$/);
    expect(value.students[0].maskedAdmissionReference).toMatch(/^ADM-••••/);
    expect(value.staff[0].maskedStaffReference).toMatch(/^STAFF-••••/);
    for (const forbidden of ["Asha Student", "+Formula", "Private Teacher", "9999999999", "9000000000", "asha@example.test", "Available", "123412341234", "HYPERLINK"]) expect(csv).not.toContain(forbidden);
    expect(csv).not.toMatch(/passwordHash|userId|studentId|guardianId|aadhaarNo|DATABASE_URL/i);
    expect(csv).toContain("UDISE_15E_EVIDENCE_PARTIAL");
    expect(csv).toContain("Opaque row reference");
  });

  it("uses fresh random row references that cannot be recomputed from source identifiers", () => {
    const first = report();
    const second = report();
    expect(first.students[0].rowReference).not.toBe(second.students[0].rowReference);
    expect(first.staff[0].rowReference).not.toBe(second.staff[0].rowReference);
    expect(first.students[0].rowReference).not.toContain("NPS001");
    expect(first.staff[0].rowReference).not.toContain("T01");
  });

  it("enforces fixed row limits and fixed export names", () => {
    const value = report();
    value.students = Array.from({ length: UDISE_STUDENT_ROW_LIMIT + 1 }, () => value.students[0]);
    value.staff = Array.from({ length: UDISE_STAFF_ROW_LIMIT + 1 }, () => value.staff[0]);
    const csv = udiseChecklistCsv(value, new Date("2026-08-25T00:00:00Z"));
    expect((csv.match(/"Student"/g) ?? [])).toHaveLength(UDISE_STUDENT_ROW_LIMIT);
    expect((csv.match(/"Staff"/g) ?? [])).toHaveLength(UDISE_STAFF_ROW_LIMIT);
    expect(udiseChecklistFilename()).toBe("udise-planning-masked-gap-report-2026-27.csv");
    expect(udiseChecklistFilename("source-register")).toBe("udise-planning-source-register-2026-27.csv");
  });

  it("exports all 75 source groups without row-level values", () => {
    const csv = udiseSourceRegisterCsv(new Date("2026-08-25T00:00:00Z"));
    expect((csv.match(/"N1:/g) ?? [])).toHaveLength(74);
    expect(csv).toContain('"N7/N9/T3:ST27"');
    expect(csv).toContain("School identity and geography labels");
    expect(csv).toContain(UDISE_EVIDENCE.title);
    expect(csv).not.toContain("Asha Student");
    expect(csv).not.toContain("Asha Teacher");
  });

  it("filters only allowlisted safe row properties", () => {
    const value = report(
      [student(), student({ admissionNo: "NPS-002", className: "6", section: "B", address: null })],
      [staff(), staff({ staffCode: "A-01", fullName: "Office", staffType: "ADMIN", email: null })]
    );
    expect(filterUdiseStudents(value.students, { className: "6", section: "B", gapType: "address" })).toHaveLength(1);
    expect(filterUdiseStaff(value.staff, { staffType: "ADMIN", gapType: "email" })).toHaveLength(1);
    expect(maskUdiseReference("=DANGEROUS-01", "ADM")).toBe("ADM-••••01");
  });
});
