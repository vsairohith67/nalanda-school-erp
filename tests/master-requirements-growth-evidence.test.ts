import { it } from "vitest";
import assert from "node:assert/strict";
import { calculateTeacherAnalyticsSnapshot } from "@/lib/teacher-analytics";
import { TEACHER_ANALYTICS_METRIC_VERSION } from "@/lib/teacher-analytics-definitions";

// Synthetic in-memory evidence for the reconciled growth capability; no database or provider.
const calculatedAt = new Date("2026-07-17T00:00:00.000Z");
const cycle = {
  id: "synthetic-growth-cycle",
  academicYear: "2026-27",
  periodStart: new Date("2026-04-01T00:00:00.000Z"),
  periodEnd: new Date("2026-06-30T00:00:00.000Z"),
  minimumStudentCohort: 5,
  metricDefinitionVersion: TEACHER_ANALYTICS_METRIC_VERSION,
};

function assessment(code: string, score: number, cohortSize: number, maxMarks = 100) {
  return {
    academicYear: cycle.academicYear,
    className: "VI",
    section: "A",
    subjectName: "Mathematics",
    assessmentType: "WRITTEN",
    componentName: "TEST",
    maxMarks,
    passMarks: maxMarks * 0.4,
    entryStatus: "LOCKED",
    examCycle: { examCode: code, status: "LOCKED" },
    marks: Array.from({ length: cohortSize }, (_, index) => ({
      studentId: `synthetic-private-student-${index}`,
      entryStatus: "PRESENT",
      marksObtained: score,
    })),
    events: [],
  };
}

function memoryClient(assessments: ReturnType<typeof assessment>[]) {
  const staff = {
    id: "synthetic-teacher",
    staffCode: "SYNTHETIC-TEACHER",
    fullName: "Synthetic Teacher",
    displayName: null,
    staffType: "TEACHING",
    status: "ACTIVE",
    designation: "Teacher",
    department: "Academics",
    primarySubject: "Mathematics",
    userId: "synthetic-user",
    timetableTeacherId: "synthetic-timetable-teacher",
    timetableTeacher: {
      assignments: [{
        academicYear: cycle.academicYear,
        classSection: { className: "VI", section: "A" },
        subject: { name: "Mathematics" },
        subjectId: "synthetic-subject",
        periodsPerWeek: 5,
      }],
    },
  };
  return {
    staffMember: { findUnique: async () => staff },
    staffAttendanceSession: { count: async () => 0 },
    staffAttendanceRecord: { findMany: async () => [] },
    staffLeaveRequest: { findMany: async () => [] },
    substituteAssignment: { count: async () => 0 },
    homeworkAssignment: { findMany: async () => [] },
    examAssessment: { findMany: async () => assessments },
    studentReportCard: { findMany: async () => [] },
    timetableDraft: { findFirst: async () => ({ id: "synthetic-timetable" }) },
  };
}

async function outcome(assessments: ReturnType<typeof assessment>[]) {
  const snapshot = await calculateTeacherAnalyticsSnapshot(
    memoryClient(assessments) as unknown as Parameters<typeof calculateTeacherAnalyticsSnapshot>[0],
    cycle,
    "synthetic-teacher",
    calculatedAt,
  );
  const parsed = JSON.parse(snapshot.studentOutcomeJson);
  assert.equal(snapshot.studentOutcomeJson.includes("synthetic-private-student-"), false, "Outcome leaked a synthetic Student identifier");
  for (const forbidden of ["studentId", "studentName", "marksObtained", "admissionNo"]) {
    assert.equal(snapshot.studentOutcomeJson.includes(`${JSON.stringify(forbidden)}:`), false, `Outcome leaked field ${forbidden}`);
  }
  assert.equal(parsed.value.causationClaimed, false);
  assert.equal(parsed.value.studentIdentityStored, false);
  assert.equal(parsed.value.teacherRankGenerated, false);
  assert.equal(JSON.parse(snapshot.attendanceJson).completeness, "SOURCE_MISSING");
  assert.equal(JSON.parse(snapshot.dataQualityJson).zeroIsNotUsedForMissingSource, true);
  return parsed;
}

it("proves released contextual growth, small-cohort suppression and privacy", async () => {
  const paired = await outcome([assessment("BEFORE", 50, 5), assessment("AFTER", 60, 5)]);
  assert.equal(paired.value.trendComparisons.length, 1);
  assert.equal(paired.value.trendComparisons[0].state, "COMPLETE");
  assert.equal(paired.value.trendComparisons[0].cohortSize, 5);
  assert.equal(paired.value.trendComparisons[0].averagePercentagePointChange, 10);
  assert.equal(paired.value.trendComparisons[0].improving, 5);
  assert.equal(paired.value.trendComparisons[0].stable, 0);
  assert.equal(paired.value.trendComparisons[0].declining, 0);

  const small = await outcome([assessment("BEFORE", 50, 4), assessment("AFTER", 60, 4)]);
  assert.equal(small.value.trendComparisons.length, 1);
  assert.equal(small.value.trendComparisons[0].state, "INSUFFICIENT");
  assert.equal(small.value.trendComparisons[0].averagePercentagePointChange, undefined);
  assert.equal(small.value.trendComparisons[0].improving, undefined);

  const incompatible = await outcome([assessment("BEFORE", 50, 5, 100), assessment("AFTER", 30, 5, 50)]);
  assert.equal(incompatible.value.trendComparisons.length, 0);
  assert.equal(incompatible.value.incompatibleAssessmentExclusions, 1);

});
