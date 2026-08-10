import { describe, expect, it } from "vitest";
import { createDryRunPlan } from "@/lib/onboarding";
import type { OnboardingWorkbookRows } from "@/lib/onboarding-types";

function rows(): OnboardingWorkbookRows {
  return {
    metadata: {},
    students: [{
      "Import Row Key": "STU-001", "Admission Number": "NPS-001", "Student Full Name": "विद्यार्थी One",
      "Father Name": "Guardian One", "Mother Name": "والدہ One", Phone: "9876543210",
      "Date of Birth": "2016-01-31", "Academic Year": "2026-27", Class: "I", Section: "A",
      "Roll Number": "1", "Student Status": "ACTIVE"
    }],
    guardians: [{
      "Guardian Row Key": "GUA-001", Name: "Guardian One", Relationship: "Father", Mobile: "9876543210",
      "Communication Preference": "MOBILE", "Parent Account Proposal": "YES"
    }],
    links: [{
      "Link Row Key": "LNK-001", "Student Row Key": "STU-001", "Guardian Row Key": "GUA-001",
      "Relationship to Student": "Father", "Primary Contact": "YES", "Can View Fees": "YES", "Can Receive Reminders": "YES"
    }],
    enrollments: [{
      "Enrollment Row Key": "ENR-001", "Student Row Key": "STU-001", "Academic Year": "2026-27",
      Class: "I", Section: "A", "Roll Number": "1", "Enrollment Date": "2026-06-01", Status: "ACTIVE"
    }],
    staff: [{
      "Staff Row Key": "STF-001", "Employee Code": "EMP-NEW", Name: "Teacher One", "Staff Type": "TEACHING",
      Designation: "Teacher", Department: "Academics", "Joining Date": "2026-06-01", Mobile: "9876543211",
      "Role Proposal": "TEACHER", "Portal Account Proposal": "YES", "Employment Status": "ACTIVE"
    }]
  };
}

function client(options: { existingStudent?: boolean; possibleStudents?: number } = {}) {
  const students = options.existingStudent
    ? [{ id: "student-existing", admissionNo: "NPS-001", studentName: "Existing", dateOfBirth: null, phone1: "9876543210", updatedAt: new Date("2026-08-01") }]
    : Array.from({ length: options.possibleStudents ?? 0 }, (_, index) => ({
        id: `student-candidate-${index + 1}`, admissionNo: `OTHER-${index + 1}`, studentName: `Candidate ${index + 1}`,
        dateOfBirth: null, phone1: "9876543210", updatedAt: new Date("2026-08-01")
      }));
  return {
    timetableClassSection: { findMany: async () => [{ academicYear: "2026-27", className: "I", section: "A", isActive: true, updatedAt: new Date("2026-08-01") }] },
    student: { findMany: async () => students },
    guardian: { findMany: async () => [] },
    staffMember: { findMany: async () => [{ id: "reference-staff", staffCode: "EMP-REF", fullName: "Reference", mobile: null, email: null, department: "Academics", designation: "Teacher", updatedAt: new Date("2026-08-01") }] },
    permissionProfile: { findMany: async () => [{ name: "Teacher", updatedAt: new Date("2026-08-01") }] }
  } as any;
}

const batch = { workbookSha256: "a".repeat(64), templateVersion: "1.0" };

describe("governed onboarding dry-run planning", () => {
  it("builds a deterministic, all-or-nothing plan without activating accounts", async () => {
    const first = await createDryRunPlan(client(), batch, rows());
    const second = await createDryRunPlan(client(), batch, rows());
    expect(first.summary.blockingErrorCount).toBe(0);
    expect(first.summary.unresolvedDecisionCount).toBe(0);
    expect(first.summary.accountProposalCount).toBe(2);
    expect(first.summary.executionMode).toBe("ALL_OR_NOTHING");
    expect(first.planHash).toBe(second.planHash);
    expect(first.normalized.students[0].studentName).toBe("विद्यार्थी One");
  });

  it("requires a recorded duplicate decision and refuses create-new for an existing identifier", async () => {
    const unresolved = await createDryRunPlan(client({ existingStudent: true }), batch, rows());
    expect(unresolved.issues.some((issue) => issue.code === "STUDENT_ADMISSION_EXISTS" && issue.severity === "REQUIRES_USER_DECISION")).toBe(true);

    const unsafe = await createDryRunPlan(client({ existingStudent: true }), batch, rows(), {
      "STU-001": { decision: "CREATE_NEW", reason: "Operator confirmed a second record" }
    });
    expect(unsafe.issues.some((issue) => issue.code === "CREATE_DUPLICATE_REFUSED")).toBe(true);

    const linked = await createDryRunPlan(client({ existingStudent: true }), batch, rows(), {
      "STU-001": { decision: "LINK_EXISTING", reason: "Admission number matches the governed Student" }
    });
    expect(linked.summary.blockingErrorCount).toBe(0);
    expect(linked.summary.unresolvedDecisionCount).toBe(0);
  });

  it("supports explicit create or link decisions for one possible Student match", async () => {
    const unresolved = await createDryRunPlan(client({ possibleStudents: 1 }), batch, rows());
    expect(unresolved.issues.some((issue) => issue.code === "POSSIBLE_STUDENT_MATCH" && issue.severity === "REQUIRES_USER_DECISION")).toBe(true);

    const created = await createDryRunPlan(client({ possibleStudents: 1 }), batch, rows(), {
      "STU-001": { decision: "CREATE_NEW", reason: "The side-by-side record is a different person" }
    });
    expect(created.summary.blockingErrorCount).toBe(0);
    expect(created.summary.unresolvedDecisionCount).toBe(0);

    const linked = await createDryRunPlan(client({ possibleStudents: 1 }), batch, rows(), {
      "STU-001": { decision: "LINK_EXISTING", reason: "The side-by-side record is the same person" }
    });
    expect(linked.summary.blockingErrorCount).toBe(0);
    expect((linked.normalized.students[0] as any).candidateId).toBe("student-candidate-1");
  });

  it("refuses ambiguous links, missing reasons, and unauthorised update decisions", async () => {
    const ambiguous = await createDryRunPlan(client({ possibleStudents: 2 }), batch, rows(), {
      "STU-001": { decision: "LINK_EXISTING", reason: "Link requested" }
    });
    expect(ambiguous.issues.some((issue) => issue.code === "AMBIGUOUS_LINK_REFUSED")).toBe(true);

    const missingReason = await createDryRunPlan(client({ possibleStudents: 1 }), batch, rows(), {
      "STU-001": { decision: "CREATE_NEW", reason: "" }
    });
    expect(missingReason.issues.some((issue) => issue.code === "DECISION_REASON_REQUIRED")).toBe(true);

    const update = await createDryRunPlan(client({ possibleStudents: 1 }), batch, rows(), {
      "STU-001": { decision: "UPDATE_EXISTING", reason: "Change the existing row" }
    });
    expect(update.issues.some((issue) => issue.code === "UPDATE_MODE_NOT_AUTHORISED")).toBe(true);
  });

  it("blocks duplicate Guardian contacts and duplicate roll numbers inside one workbook", async () => {
    const duplicateRows = rows();
    duplicateRows.guardians.push({ ...duplicateRows.guardians[0], "Guardian Row Key": "GUA-002", Name: "Guardian Two" });
    duplicateRows.enrollments.push({ ...duplicateRows.enrollments[0], "Enrollment Row Key": "ENR-002", "Student Row Key": "STU-OTHER" });
    const planned = await createDryRunPlan(client(), batch, duplicateRows);
    expect(planned.issues.some((issue) => issue.code === "DUPLICATE_GUARDIAN_CONTACT_IN_WORKBOOK")).toBe(true);
    expect(planned.issues.some((issue) => issue.code === "DUPLICATE_ROLL_NUMBER")).toBe(true);
  });

  it("blocks relationships and enrollments that depend on a skipped Student", async () => {
    const planned = await createDryRunPlan(client({ existingStudent: true }), batch, rows(), {
      "STU-001": { decision: "SKIP", reason: "Existing Student will be handled outside this batch" }
    });
    expect(planned.issues.filter((issue) => issue.code === "SKIPPED_STUDENT_DEPENDENCY")).toHaveLength(2);
    expect(planned.summary.rollbackFeasible).toBe(false);
  });

  it("rejects impossible calendar dates instead of normalizing them", async () => {
    const invalid = rows();
    invalid.students[0]["Date of Birth"] = "2026-02-30";
    const planned = await createDryRunPlan(client(), batch, invalid);
    expect(planned.issues.some((issue) => issue.code === "DATE_INVALID")).toBe(true);
  });
});
