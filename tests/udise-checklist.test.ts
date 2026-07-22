import { describe, expect, it } from "vitest";
import { DEFAULT_SCHOOL_SETTINGS } from "../lib/school-settings";
import {
  buildUdiseChecklist,
  filterUdiseStaff,
  filterUdiseStudents,
  UDISE_PLANNING_WARNING,
  UDISE_VERIFICATION_WARNING,
  udiseChecklistCsv,
  udiseChecklistFilename,
  type UdiseStaffSource,
  type UdiseStudentSource
} from "../lib/udise-checklist";

function student(overrides: Partial<UdiseStudentSource> = {}): UdiseStudentSource {
  return {
    admissionNo: "NPS-001",
    studentName: "Asha Student",
    className: "5",
    section: "A",
    status: "Active",
    dateOfBirth: new Date("2015-04-10"),
    address: "Available",
    aadhaarNo: "123412341234",
    guardians: [{ isPrimaryContact: true, guardian: { primaryMobile: "9999999999" } }],
    academicYearEnrollments: [{ academicYear: "2026-27", className: "5", section: "A", status: "ACTIVE" }],
    lifecycleEvents: [{ eventType: "ENROLLED" }],
    progressionDecisions: [],
    ...overrides
  };
}

function staff(overrides: Partial<UdiseStaffSource> = {}): UdiseStaffSource {
  return { staffCode: "T-01", fullName: "Asha Teacher", staffType: "TEACHING", designation: "Teacher", mobile: "9000000000", email: "asha@example.test", qualification: "B.Ed", status: "ACTIVE", ...overrides };
}

function report(students = [student()], staffRows = [staff()]) {
  return buildUdiseChecklist({ academicYear: "2026-27", students, staff: staffRows, school: { ...DEFAULT_SCHOOL_SETTINGS } });
}

describe("UDISE planning checklist", () => {
  it("summarizes existing read-only ERP records and uses planning-only wording", () => {
    const value = report();
    expect(value.warning).toBe(UDISE_PLANNING_WARNING);
    expect(value.verificationWarning).toBe(UDISE_VERIFICATION_WARNING);
    expect(value.summary).toMatchObject({ activeStudentsChecked: 1, enrollmentsChecked: 1, lifecycleRecordsChecked: 1, staffRecordsChecked: 1 });
    expect(JSON.stringify(value)).not.toContain("officially compliant");
    expect(JSON.stringify(value)).not.toContain("legally required");
  });

  it("detects student basics, enrollment, lifecycle, guardian, contact, and address gaps", () => {
    const value = report([student({ dateOfBirth: null, section: null, address: null, guardians: [], academicYearEnrollments: [], lifecycleEvents: [] })]);
    const row = value.students[0];
    expect(row.gapTypes).toEqual(expect.arrayContaining(["missing-basics", "enrollment", "lifecycle", "guardian-link", "guardian-contact", "address"]));
    expect(row.dateOfBirthStatus).toBe("Missing");
    expect(row.guardianContactStatus).toBe("Missing");
    expect(value.summary.studentsWithMissingBasics).toBe(1);
    expect(value.summary.guardianContactGaps).toBe(1);
    expect(row.gapCount).toBe(row.gapTypes.filter((type) => type !== "privacy").length);
  });

  it("counts each visible gap type once when multiple missing fields share a category", () => {
    const value = report([student({ dateOfBirth: null, section: null })]);
    expect(value.students[0].gapTypes.filter((type) => type === "missing-basics")).toHaveLength(1);
    expect(value.students[0].gapCount).toBe(2);
  });

  it("flags duplicate active enrollment and strength mismatch for school verification", () => {
    const value = report([student({ academicYearEnrollments: [
      { academicYear: "2026-27", className: "5", section: "A", status: "ACTIVE" },
      { academicYear: "2026-27", className: "6", section: "A", status: "ACTIVE" }
    ] })]);
    expect(value.students[0].enrollmentStatus).toContain("Duplicate active enrollment");
    expect(value.categoryCounts["Enrollment/lifecycle"]["Needs school verification"]).toBeGreaterThan(0);
  });

  it("reports progression history if present without treating decisions as actions", () => {
    const value = report([student({ progressionDecisions: [{ decisionType: "PROMOTE" }] })]);
    expect(value.students[0].progressionHistory).toContain("1 progression decision");
    expect(value.students[0].enrollmentStatus).toContain("ACTIVE enrollment available");
  });

  it("marks unavailable staff and missing model fields without fabricating values", () => {
    const value = report([], [staff({ staffCode: null, mobile: null, email: null, qualification: null })]);
    expect(value.staff[0]).toMatchObject({ staffCode: "Missing", mobileStatus: "Missing", emailStatus: "Missing", qualificationStatus: "Missing", demographicStatus: "Not tracked in ERP" });
    expect(value.staff[0].attendanceFoundation).toBe("Available");
    expect(value.notTrackedFields).toContain("Official UDISE+ school identifiers");
  });

  it("never returns or exports a full Aadhaar number", () => {
    const value = report();
    expect(value.students[0].aadhaarStatus).toBe("Available in school records — needs verification");
    expect(JSON.stringify(value)).not.toContain("123412341234");
    expect(udiseChecklistCsv(value)).not.toContain("123412341234");
  });

  it("creates checklist-only, formula-safe CSV without internal IDs or secrets", () => {
    const value = report([student({ admissionNo: "=HYPERLINK(\"bad\")", studentName: "+Formula" })]);
    const csv = udiseChecklistCsv(value);
    expect(csv).toContain("Planning checklist only");
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("'+Formula");
    expect(csv).not.toMatch(/passwordHash|userId|studentId|guardianId|aadhaarNo|DATABASE_URL/i);
  });

  it("keeps category totals internally consistent and sanitizes the checklist filename", () => {
    const value = report();
    const totals = Object.fromEntries(Object.entries(value.categoryCounts).map(([category, counts]) => [
      category,
      Object.values(counts).reduce((sum, count) => sum + count, 0)
    ]));
    expect(totals).toEqual({
      "Student data": 8,
      "Enrollment/lifecycle": 5,
      "Guardian/contact": 2,
      "Staff data": 11,
      "School settings": 6,
      "Aadhaar/privacy caution": 2
    });
    expect(udiseChecklistFilename("2026/27\r\nunsafe")).toBe("udise-planning-checklist-gap-report-2026-27-unsafe.csv");
  });

  it("filters student and staff reports using safe display fields and gap types", () => {
    const value = report([student(), student({ admissionNo: "NPS-002", className: "6", section: "B", address: null })], [staff(), staff({ staffCode: "A-01", fullName: "Office", staffType: "ADMIN", email: null })]);
    expect(filterUdiseStudents(value.students, { className: "6", section: "B", gapType: "address" })).toHaveLength(1);
    expect(filterUdiseStaff(value.staff, { staffType: "ADMIN", gapType: "email" })).toHaveLength(1);
  });
});
