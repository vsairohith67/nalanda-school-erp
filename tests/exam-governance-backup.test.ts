import { describe, expect, it } from "vitest";
import {
  emptyExamGovernanceBackup,
  examGovernanceRecordCount,
  restoreExamGovernanceBackup,
  validateExamGovernanceBackup
} from "../lib/exam-governance-backup";

const at = "2026-07-31T00:00:00.000Z";

function fixture() {
  return {
    ...emptyExamGovernanceBackup(),
    examinations: [{
      id: "exam", examCode: "EXAM2QA", academicYear: "2026-27", name: "QA", examType: "TERM",
      startDate: at, endDate: at, status: "ACTIVE", createdByUserId: "principal", createdAt: at, updatedAt: at
    }],
    examinationClassScopes: [{
      id: "scope", examinationId: "exam", academicYear: "2026-27", className: "X", section: "A",
      timetableClassSectionId: "class", status: "ACTIVE", createdByUserId: "principal", createdAt: at, updatedAt: at
    }],
    examSubjectPapers: [{
      id: "paper", examinationId: "exam", classScopeId: "scope", academicYear: "2026-27",
      className: "X", section: "A", timetableSubjectId: "subject", subjectNameSnapshot: "Mathematics",
      paperCode: "P1", paperName: "Paper 1", displayOrder: 1, status: "ACTIVE",
      createdByUserId: "principal", createdAt: at, updatedAt: at
    }],
    examinationSchemeVersions: [{
      id: "scheme", examinationId: "exam", classScopeId: "scope", academicYear: "2026-27",
      className: "X", section: "A", scopeKey: "paper", subjectPaperId: "paper", versionNumber: 1,
      calculationMode: "RAW_SUM", roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2",
      markDecimalPlaces: 2, absentTreatment: "ZERO", exemptTreatment: "EXCLUDE",
      notApplicableTreatment: "EXCLUDE", passFailEnabled: false, rankEnabled: false,
      rankTiePolicy: "COMPETITION_SHARED_STABLE_ADMISSION", status: "ACTIVE", version: 1,
      createdByUserId: "principal", createdAt: at, updatedAt: at
    }],
    examinationComponents: [{
      id: "component", schemeVersionId: "scheme", componentCode: "WRITTEN", name: "Written",
      componentKind: "THEORY", displayOrder: 1, maximumMarks: "100", contributionWeight: null,
      isRequired: true, createdAt: at, updatedAt: at
    }],
    teacherExamAssignments: [{
      id: "assignment", examinationId: "exam", classScopeId: "scope", timetableClassSectionId: "class",
      subjectPaperId: "paper", schemeVersionId: "scheme", componentId: "component",
      academicYear: "2026-27", className: "X", section: "A", staffMemberId: "staff",
      timetableTeacherId: "teacher", timetableAssignmentId: "timetable-assignment",
      assignmentRole: "PRIMARY", status: "ACTIVE", version: 1, assignmentReason: "QA",
      assignedByUserId: "principal", createdAt: at, updatedAt: at
    }],
    examMarkSheets: [{
      id: "sheet", logicalSheetKey: "logical", currentKey: "logical", versionNumber: 1,
      examinationId: "exam", classScopeId: "scope", subjectPaperId: "paper", componentId: "component",
      schemeVersionId: "scheme", primaryAssignmentId: "assignment", academicYear: "2026-27",
      className: "X", section: "A", status: "LOCKED", optimisticVersion: 3,
      assignmentSnapshotJson: "{}", createdByUserId: "teacher-user", createdAt: at, updatedAt: at
    }],
    examMarkEntries: [
      {
        id: "entry-zero", sheetId: "sheet", studentId: "student-zero", entryState: "PRESENT",
        marksObtained: "0", rowVersion: 1, enteredByUserId: "teacher-user", enteredAt: at,
        createdAt: at, updatedAt: at
      },
      {
        id: "entry-absent", sheetId: "sheet", studentId: "student-absent", entryState: "ABSENT",
        marksObtained: null, rowVersion: 1, enteredByUserId: "teacher-user", enteredAt: at,
        createdAt: at, updatedAt: at
      }
    ],
    examinationSchemeAudits: [{
      id: "audit", eventKey: "event", examinationId: "exam", schemeVersionId: "scheme",
      assignmentId: "assignment", eventType: "MARKS_LOCKED", targetType: "ExamMarkSheet",
      targetId: "sheet", actorUserId: "principal", actorRole: "PRINCIPAL",
      snapshotJson: "{}", eventDate: at, createdAt: at
    }],
    studentResultSnapshots: [{
      id: "snapshot", calculationRunId: "run", inputFingerprint: "fingerprint", runNumber: 1,
      runStatus: "LOCKED", examinationId: "exam", classScopeId: "scope", studentId: "student-zero",
      schemeVersionId: "scheme", snapshotVersion: 1, totalObtained: "0", totalMaximum: "100",
      percentage: "0", formulaVersion: "RC_CALC_V1_PAPER_NORMALIZED",
      roundingPolicyVersion: "RC05_V1_DECIMAL6_HALF_UP2", warningsJson: "[]",
      sourceSheetVersionsJson: "[]", sourceSchemeVersionsJson: "[]", snapshotJson: "{}",
      calculatedByUserId: "principal", calculatedAt: at, createdAt: at
    }]
  };
}

function memoryClient() {
  const stores = Object.fromEntries([
    "examination", "examinationClassScope", "examSubjectPaper", "examinationSchemeVersion",
    "examinationComponent", "examSubjectGroup", "examSubjectGroupMember", "gradeScaleVersion",
    "gradeScaleBand", "coScholasticSchemeVersion", "coScholasticItem", "examTemplateFamilyBinding",
    "teacherExamAssignment", "examinationSchemeAudit", "examMarkSheet", "examMarkEntry",
    "studentResultSnapshot"
  ].map((key) => [key, new Map<string, Record<string, unknown>>()]));
  const client = Object.fromEntries(Object.entries(stores).map(([key, store]) => [key, {
    findUnique: async ({ where: { id } }: { where: { id: string } }) => store.get(id) ?? null,
    create: async ({ data }: { data: Record<string, unknown> }) => {
      store.set(String(data.id), data);
      return data;
    }
  }]));
  return { client, stores };
}

describe("version-37 examination governance backup", () => {
  it("preserves PRESENT zero separately from ABSENT and restores idempotently", async () => {
    const backup = validateExamGovernanceBackup(fixture());
    expect(backup.examMarkEntries.map((row) => [row.entryState, row.marksObtained])).toEqual([
      ["PRESENT", "0"],
      ["ABSENT", null]
    ]);
    const memory = memoryClient();
    const studentMap = new Map([["student-zero", "local-zero"], ["student-absent", "local-absent"]]);
    const first = await restoreExamGovernanceBackup(memory.client, backup, studentMap);
    const second = await restoreExamGovernanceBackup(memory.client, backup, studentMap);
    expect(first.errors).toEqual([]);
    expect(first.created).toBe(examGovernanceRecordCount(backup));
    expect(second).toMatchObject({ created: 0, skipped: examGovernanceRecordCount(backup), errors: [] });
    expect(memory.stores.examMarkEntry.get("entry-zero")).toMatchObject({
      studentId: "local-zero", entryState: "PRESENT", marksObtained: "0"
    });
  });

  it("rejects unsafe snapshots, unknown states, and duplicate Student/component rows", () => {
    const secret = fixture();
    secret.studentResultSnapshots[0].snapshotJson = '{"passwordHash":"forbidden"}';
    expect(() => validateExamGovernanceBackup(secret)).toThrow(/credential field/);

    const state = fixture();
    state.examMarkEntries[0].entryState = "MISSING";
    expect(() => validateExamGovernanceBackup(state)).toThrow(/unsupported/);

    const duplicate = fixture();
    duplicate.examMarkEntries.push({ ...duplicate.examMarkEntries[0], id: "entry-duplicate" });
    expect(() => validateExamGovernanceBackup(duplicate)).toThrow(/duplicate Student\/component/);
  });

  it("keeps older version-37 documents compatible when the additive collection is absent", () => {
    expect(validateExamGovernanceBackup(undefined)).toEqual(emptyExamGovernanceBackup());
  });
});
