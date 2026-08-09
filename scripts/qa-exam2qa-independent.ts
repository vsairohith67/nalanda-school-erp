import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import {
  loadExamGovernanceBackup,
  restoreExamGovernanceBackup
} from "../lib/exam-governance-backup";
import { hashPassword } from "../lib/password";
import { parseAndValidateBackup } from "../lib/restore";
import {
  ExamMarksError,
  loadTeacherMarksWorkspace,
  moderateMarkSheet,
  requestMarkCorrection,
  reviewMarkCorrection,
  saveAssignedMarkDraft,
  submitAssignedMarkSheet
} from "../lib/exam-marks";
import {
  ExamMarksScopeError,
  requireExactExamMarkAssignment
} from "../lib/exam-marks-scope";
import {
  loadMarksModerationDashboard,
  lockExaminationCalculation,
  runExaminationCalculationPreview
} from "../lib/exam-calculations-v2";
import { can } from "../lib/permissions";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  databaseUrl,
  fileSha256
} from "./migration-check-utils";

const PREFIX = "EXAM2QA";
const STATE_PATH = path.join(QA_ROOT, "reports", `${PREFIX}-browser-state.json`);

type QaAccount = {
  username: string;
  password: string;
  role: string;
};

type BaseState = {
  databasePath: string;
  sourceHash: string;
  examinationId: string;
  classScopeId: string;
  principalUsername: string;
  principalPassword: string;
  teacherOneUsername: string;
  teacherOnePassword: string;
  teacherTwoUsername: string;
  teacherTwoPassword: string;
  independent?: {
    accounts: Record<string, QaAccount>;
    otherCurrentStudentId: string;
    otherYearStudentId: string;
    crossYearAssignmentId: string;
  };
};

type Actor = { id: string; name: string; role: any };

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM2QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as BaseState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function persistState(state: BaseState) {
  writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function password() {
  return `${PREFIX}-${randomBytes(24).toString("base64url")}!aA9`;
}

function actor(user: { id: string; name: string; role: string }): Actor {
  return { id: user.id, name: user.name, role: user.role };
}

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

async function expectError(
  action: () => Promise<unknown>,
  expected: { type: "scope" | "marks"; status?: number; code?: string }
) {
  try {
    await action();
  } catch (error) {
    if (expected.type === "scope") {
      if (!(error instanceof ExamMarksScopeError)) throw error;
      if (expected.status != null && error.status !== expected.status) throw error;
      return error;
    }
    if (!(error instanceof ExamMarksError)) throw error;
    if (expected.status != null && error.status !== expected.status) throw error;
    if (expected.code != null && error.code !== expected.code) throw error;
    return error;
  }
  throw new Error(`EXAM2QA_EXPECTED_${expected.type.toUpperCase()}_ERROR_MISSING`);
}

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function governanceHash(value: unknown) {
  return stableHash(JSON.parse(JSON.stringify(value)));
}

async function createAccount(client: PrismaClient, key: string, role: string, isActive = true) {
  const privatePassword = password();
  const user = await client.user.create({
    data: {
      name: `${PREFIX} ${key}`,
      username: `${PREFIX.toLowerCase()}-${key.toLowerCase().replaceAll("_", "-")}`,
      passwordHash: await hashPassword(privatePassword),
      role,
      isActive
    }
  });
  return {
    user,
    account: { username: user.username, password: privatePassword, role } satisfies QaAccount
  };
}

async function provision() {
  const state = readState();
  invariant(!state.independent, "EXAM2QA_INDEPENDENT_ALREADY_PROVISIONED");
  invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_DRIFT");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const created = Object.fromEntries(await Promise.all(
      [
        ["superAdmin", "SUPER_ADMIN"],
        ["director", "DIRECTOR"],
        ["unlinkedTeacher", "TEACHER"],
        ["inactiveTeacher", "TEACHER"],
        ["parent", "PARENT"],
        ["accountant", "ACCOUNTANT"],
        ["viewer", "VIEWER"]
      ].map(async ([key, role]) => [key, await createAccount(client, key, role)])
    )) as Record<string, Awaited<ReturnType<typeof createAccount>>>;

    const inactiveTimetableTeacher = await client.timetableTeacher.create({
      data: {
        name: `${PREFIX} Inactive Teacher`,
        shortName: "EX2QA-INACTIVE",
        department: `${PREFIX} Synthetic`,
        maxPeriodsPerWeek: 30,
        maxPeriodsPerDay: 8,
        isActive: false
      }
    });
    await client.staffMember.create({
      data: {
        staffCode: `${PREFIX}-INACTIVE`,
        fullName: `${PREFIX} Inactive Teacher`,
        displayName: `${PREFIX} Inactive Teacher`,
        designation: "Synthetic inactive Teacher",
        department: `${PREFIX} Synthetic`,
        staffType: "TEACHING",
        status: "INACTIVE",
        userId: created.inactiveTeacher.user.id,
        timetableTeacherId: inactiveTimetableTeacher.id
      }
    });

    const [classB, priorClass, teacherTwoUser, mathSubject] = await Promise.all([
      client.timetableClassSection.findFirstOrThrow({
        where: { academicYear: "2026-27", className: `${PREFIX}B`, section: "QB" }
      }),
      client.timetableClassSection.findFirstOrThrow({
        where: { academicYear: "2025-26", className: `${PREFIX}A`, section: "QA" }
      }),
      client.user.findUniqueOrThrow({
        where: { username: state.teacherTwoUsername },
        include: { staffMember: { include: { timetableTeacher: true } } }
      }),
      client.timetableSubject.findFirstOrThrow({ where: { shortName: "EX2QA-MATH" } })
    ]);
    invariant(teacherTwoUser.staffMember?.timetableTeacher, "EXAM2QA_TEACHER_TWO_LINK_MISSING");

    const otherCurrent = await client.student.create({
      data: {
        admissionNo: `${PREFIX}-OTHER-001`,
        studentName: `${PREFIX} Other Section Student`,
        fatherName: `${PREFIX} Synthetic Parent`,
        academicYear: "2026-27",
        className: `${PREFIX}B`,
        section: "QB",
        rollNo: "1",
        phone1: "0000000000",
        status: "Active"
      }
    });
    await client.academicYearEnrollment.create({
      data: {
        studentId: otherCurrent.id,
        academicYear: "2026-27",
        className: `${PREFIX}B`,
        section: "QB",
        rollNo: "1",
        status: "ACTIVE"
      }
    });
    const otherYear = await client.student.create({
      data: {
        admissionNo: `${PREFIX}-OLD-001`,
        studentName: `${PREFIX} Prior Year Student`,
        fatherName: `${PREFIX} Synthetic Parent`,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        rollNo: "1",
        phone1: "0000000000",
        status: "Active"
      }
    });
    await client.academicYearEnrollment.create({
      data: {
        studentId: otherYear.id,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        rollNo: "1",
        status: "ACTIVE"
      }
    });

    const priorTimetableAssignment = await client.timetableAssignment.create({
      data: {
        academicYear: "2025-26",
        classSectionId: priorClass.id,
        subjectId: mathSubject.id,
        teacherId: teacherTwoUser.staffMember.timetableTeacher.id,
        periodsPerWeek: 4,
        notes: `${PREFIX} cross-year exact-scope control`
      }
    });
    const principal = await client.user.findUniqueOrThrow({ where: { username: state.principalUsername } });
    const priorExam = await client.examination.create({
      data: {
        examCode: `${PREFIX}-OLD`,
        academicYear: "2025-26",
        name: `${PREFIX} Prior Year Control`,
        examType: "TERM",
        startDate: new Date("2025-09-01T00:00:00.000Z"),
        endDate: new Date("2025-09-10T00:00:00.000Z"),
        status: "ACTIVE",
        createdByUserId: principal.id,
        activatedByUserId: principal.id,
        activatedAt: new Date("2025-08-15T00:00:00.000Z")
      }
    });
    const priorScope = await client.examinationClassScope.create({
      data: {
        examinationId: priorExam.id,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        timetableClassSectionId: priorClass.id,
        status: "ACTIVE",
        createdByUserId: principal.id
      }
    });
    const priorPaper = await client.examSubjectPaper.create({
      data: {
        examinationId: priorExam.id,
        classScopeId: priorScope.id,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        timetableSubjectId: mathSubject.id,
        subjectNameSnapshot: mathSubject.name,
        paperCode: "MATH-OLD",
        paperName: "Prior Mathematics",
        displayOrder: 1,
        status: "ACTIVE",
        createdByUserId: principal.id
      }
    });
    const frozenAt = new Date("2025-08-15T01:00:00.000Z");
    const priorScheme = await client.examinationSchemeVersion.create({
      data: {
        examinationId: priorExam.id,
        classScopeId: priorScope.id,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        scopeKey: "BASE",
        versionNumber: 1,
        calculationMode: "RAW_SUM",
        markDecimalPlaces: 0,
        status: "ACTIVE",
        createdByUserId: principal.id,
        activatedByUserId: principal.id,
        activatedAt: frozenAt,
        frozenAt,
        marksEntryOpenedAt: frozenAt,
        components: {
          create: {
            componentCode: "WRITTEN",
            name: "Written",
            componentKind: "WRITTEN",
            displayOrder: 1,
            maximumMarks: new Prisma.Decimal(100),
            isRequired: true
          }
        }
      },
      include: { components: true }
    });
    const priorAssignment = await client.teacherExamAssignment.create({
      data: {
        examinationId: priorExam.id,
        classScopeId: priorScope.id,
        timetableClassSectionId: priorClass.id,
        subjectPaperId: priorPaper.id,
        schemeVersionId: priorScheme.id,
        componentId: priorScheme.components[0].id,
        academicYear: "2025-26",
        className: `${PREFIX}A`,
        section: "QA",
        staffMemberId: teacherTwoUser.staffMember.id,
        timetableTeacherId: teacherTwoUser.staffMember.timetableTeacher.id,
        timetableAssignmentId: priorTimetableAssignment.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        status: "ACTIVE",
        assignmentReason: `${PREFIX} cross-year control`,
        assignedByUserId: principal.id
      }
    });

    state.independent = {
      accounts: Object.fromEntries(Object.entries(created).map(([key, value]) => [key, value.account])),
      otherCurrentStudentId: otherCurrent.id,
      otherYearStudentId: otherYear.id,
      crossYearAssignmentId: priorAssignment.id
    };
    persistState(state);
    console.log("EXAM2QA independent roles, inactive/unlinked controls, cross-section Students, and prior-year exact assignment provisioned.");
  } finally {
    await client.$disconnect();
  }
  invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_CHANGED_DURING_PROVISION");
}

async function exercise() {
  const state = readState();
  invariant(state.independent, "EXAM2QA_INDEPENDENT_NOT_PROVISIONED");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const accountUsernames = state.independent.accounts;
    const [
      principalUser,
      teacherOneUser,
      teacherTwoUser,
      unlinkedUser,
      inactiveUser,
      students
    ] = await Promise.all([
      client.user.findUniqueOrThrow({ where: { username: state.principalUsername } }),
      client.user.findUniqueOrThrow({ where: { username: state.teacherOneUsername } }),
      client.user.findUniqueOrThrow({ where: { username: state.teacherTwoUsername } }),
      client.user.findUniqueOrThrow({ where: { username: accountUsernames.unlinkedTeacher.username } }),
      client.user.findUniqueOrThrow({ where: { username: accountUsernames.inactiveTeacher.username } }),
      client.student.findMany({
        where: { admissionNo: { in: ["EXAM2QA-001", "EXAM2QA-002", "EXAM2QA-003", "EXAM2QA-004"] } },
        orderBy: { admissionNo: "asc" }
      })
    ]);
    invariant(students.length === 4, "EXAM2QA_EXACT_COHORT_MISSING");
    const principal = actor(principalUser);
    const teacherOne = actor(teacherOneUser);
    const teacherTwo = actor(teacherTwoUser);
    const unlinkedTeacher = actor(unlinkedUser);
    const inactiveTeacher = actor(inactiveUser);

    const [oneWorkspace, twoWorkspace, unlinkedWorkspace, inactiveWorkspace] = await Promise.all([
      loadTeacherMarksWorkspace(client, teacherOne),
      loadTeacherMarksWorkspace(client, teacherTwo),
      loadTeacherMarksWorkspace(client, unlinkedTeacher),
      loadTeacherMarksWorkspace(client, inactiveTeacher)
    ]);
    invariant(oneWorkspace.assignments.length === 4, "EXAM2QA_TEACHER_A_ASSIGNMENT_SCOPE_FAILED");
    invariant(twoWorkspace.assignments.length === 4, "EXAM2QA_TEACHER_B_ASSIGNMENT_SCOPE_FAILED");
    invariant(!unlinkedWorkspace.assignments.length && !unlinkedWorkspace.selectedWorkspace, "EXAM2QA_UNLINKED_TEACHER_NOT_EMPTY");
    invariant(!inactiveWorkspace.assignments.length && !inactiveWorkspace.selectedWorkspace, "EXAM2QA_INACTIVE_TEACHER_NOT_EMPTY");

    const allAssignments = [...oneWorkspace.assignments, ...twoWorkspace.assignments];
    const assignment = (paper: string, component: string, role = "PRIMARY_SUBMITTER") =>
      allAssignments.find((row: any) =>
        row.examination.id === state.examinationId &&
        row.paper.code === paper &&
        row.component.code === component &&
        row.role === role
      );
    const mathWritten = assignment("MATH", "WRITTEN")!;
    const mathInternal = assignment("MATH", "INTERNAL")!;
    const scienceTheory = assignment("SCI", "THEORY")!;
    const sciencePractical = assignment("SCI", "PRACTICAL")!;
    const socialWritten = assignment("SOC", "WRITTEN")!;
    const socialInternal = assignment("SOC", "INTERNAL")!;
    const contributor = assignment("MATH", "WRITTEN", "CONTRIBUTOR")!;
    for (const [label, value] of Object.entries({
      mathWritten,
      mathInternal,
      scienceTheory,
      sciencePractical,
      socialWritten,
      socialInternal,
      contributor
    })) invariant(value, `EXAM2QA_ASSIGNMENT_MISSING_${label}`);

    await expectError(
      () => requireExactExamMarkAssignment(client, teacherOne, socialWritten.id),
      { type: "scope", status: 404 }
    );
    await expectError(
      () => requireExactExamMarkAssignment(client, teacherOne, state.independent!.crossYearAssignmentId),
      { type: "scope", status: 404 }
    );
    const deniedWorkspace = await loadTeacherMarksWorkspace(client, teacherOne, socialWritten.id);
    invariant(!deniedWorkspace.assignments.length && !deniedWorkspace.selectedWorkspace, "EXAM2QA_DENIED_WORKSPACE_LEAKED_DATA");
    invariant(can("PARENT", "ENTER_ASSIGNED_EXAM_MARKS") === false, "EXAM2QA_PARENT_MUTATION_PERMISSION");
    invariant(can("ACCOUNTANT", "ENTER_ASSIGNED_EXAM_MARKS") === false, "EXAM2QA_ACCOUNTANT_MUTATION_PERMISSION");
    invariant(can("VIEWER", "VIEW_EXAM_MODERATION") === false, "EXAM2QA_VIEWER_MODERATION_PERMISSION");

    const initialMath = await loadTeacherMarksWorkspace(client, teacherOne, mathWritten.id);
    const initialMathComponent = initialMath.selectedWorkspace?.components.find((row: any) => row.assignment.id === mathWritten.id);
    invariant(initialMathComponent, "EXAM2QA_MATH_COMPONENT_NOT_LOADED");
    const row = (index: number, entryState: string, marksObtained: unknown) => ({
      studentId: students[index].id,
      entryState,
      marksObtained,
      expectedRowVersion: initialMathComponent.entries[index].rowVersion
    });
    const invalidCases = [
      row(0, "UNKNOWN", 1),
      row(0, "PRESENT", 81),
      row(0, "PRESENT", -1),
      row(0, "PRESENT", "1.25")
    ];
    for (const [index, invalid] of invalidCases.entries()) {
      await expectError(() => saveAssignedMarkDraft(client, mathWritten.id, {
        requestKey: `EXAM2QA:INVALID:${index}:0001`,
        rows: [invalid]
      }, teacherOne), { type: "marks", status: 400 });
    }
    await expectError(() => saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:DUPLICATE:0001",
      rows: [row(0, "PRESENT", 1), row(0, "PRESENT", 2)]
    }, teacherOne), { type: "marks", status: 400 });
    await expectError(() => saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:CROSS-SECTION:0001",
      rows: [{
        studentId: state.independent!.otherCurrentStudentId,
        entryState: "PRESENT",
        marksObtained: 1,
        expectedRowVersion: 1
      }]
    }, teacherOne), { type: "scope", status: 404 });
    await expectError(() => saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:PARTIAL-ROLLBACK:0001",
      rows: [row(0, "PRESENT", 1), row(1, "PRESENT", 999)]
    }, teacherOne), { type: "marks", status: 400 });
    invariant(await client.examMarkSheet.count({ where: { examinationId: state.examinationId } }) === 0, "EXAM2QA_INVALID_BATCH_LEFT_SHEET");

    const contributorDraft = await saveAssignedMarkDraft(client, contributor.id, {
      requestKey: "EXAM2QA:CONTRIBUTOR:SAVE:0001",
      rows: [row(0, "PRESENT", 0)]
    }, teacherTwo);
    invariant(contributorDraft.status === "DRAFT", "EXAM2QA_CONTRIBUTOR_DRAFT_FAILED");
    await expectError(() => submitAssignedMarkSheet(client, contributor.id, {
      requestKey: "EXAM2QA:CONTRIBUTOR:SUBMIT:0001",
      expectedSheetVersion: contributorDraft.sheetVersion,
      expectedOptimisticVersion: contributorDraft.optimisticVersion
    }, teacherTwo), { type: "scope", status: 403 });

    const partial = await saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:MATH-WRITTEN:PARTIAL:0001",
      expectedSheetVersion: contributorDraft.sheetVersion,
      expectedVersionNumber: 1,
      expectedOptimisticVersion: contributorDraft.optimisticVersion,
      rows: [
        { ...row(0, "PRESENT", 0), expectedRowVersion: contributorDraft.entries.find((entry: any) => entry.studentId === students[0].id).rowVersion },
        { ...row(1, "ABSENT", null), expectedRowVersion: contributorDraft.entries.find((entry: any) => entry.studentId === students[1].id).rowVersion }
      ]
    }, teacherOne);
    invariant(partial.status === "DRAFT", "EXAM2QA_PARTIAL_DRAFT_STATUS");
    const incomplete = await submitAssignedMarkSheet(client, mathWritten.id, {
      requestKey: "EXAM2QA:MATH-WRITTEN:INCOMPLETE:0001",
      expectedSheetVersion: partial.sheetVersion,
      expectedOptimisticVersion: partial.optimisticVersion
    }, teacherOne);
    invariant(!incomplete.submitted && incomplete.status === "VALIDATION_FAILED", "EXAM2QA_INCOMPLETE_SUBMISSION_ACCEPTED");

    const afterIncomplete = await loadTeacherMarksWorkspace(client, teacherOne, mathWritten.id);
    const afterIncompleteComponent = afterIncomplete.selectedWorkspace?.components.find((item: any) => item.assignment.id === mathWritten.id);
    invariant(afterIncompleteComponent?.sheet, "EXAM2QA_VALIDATION_FAILED_SHEET_MISSING");
    const completedMathWritten = await saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:MATH-WRITTEN:COMPLETE:0001",
      expectedSheetVersion: afterIncompleteComponent.sheet.version,
      expectedVersionNumber: 1,
      expectedOptimisticVersion: afterIncompleteComponent.sheet.optimisticVersion,
      rows: [
        {
          studentId: students[2].id,
          entryState: "EXEMPT",
          marksObtained: null,
          expectedRowVersion: afterIncompleteComponent.entries.find((entry: any) => entry.studentId === students[2].id).rowVersion
        },
        {
          studentId: students[3].id,
          entryState: "NOT_APPLICABLE",
          marksObtained: null,
          expectedRowVersion: afterIncompleteComponent.entries.find((entry: any) => entry.studentId === students[3].id).rowVersion
        }
      ]
    }, teacherOne);
    invariant(completedMathWritten.status === "READY_TO_SUBMIT", "EXAM2QA_ALL_STATES_NOT_READY");
    const retryMath = await saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:MATH-WRITTEN:COMPLETE:0001",
      expectedSheetVersion: afterIncompleteComponent.sheet.version,
      expectedVersionNumber: 1,
      expectedOptimisticVersion: afterIncompleteComponent.sheet.optimisticVersion,
      rows: [
        {
          studentId: students[2].id,
          entryState: "EXEMPT",
          marksObtained: null,
          expectedRowVersion: afterIncompleteComponent.entries.find((entry: any) => entry.studentId === students[2].id).rowVersion
        },
        {
          studentId: students[3].id,
          entryState: "NOT_APPLICABLE",
          marksObtained: null,
          expectedRowVersion: afterIncompleteComponent.entries.find((entry: any) => entry.studentId === students[3].id).rowVersion
        }
      ]
    }, teacherOne);
    invariant(stableHash(retryMath) === stableHash(completedMathWritten), "EXAM2QA_DRAFT_RETRY_NOT_IDEMPOTENT");

    async function fill(
      target: any,
      owner: Actor,
      marks: Array<number>
    ) {
      const workspace = await loadTeacherMarksWorkspace(client, owner, target.id);
      const component = workspace.selectedWorkspace?.components.find((item: any) => item.assignment.id === target.id);
      invariant(component, `EXAM2QA_COMPONENT_LOAD_FAILED:${target.id}`);
      return saveAssignedMarkDraft(client, target.id, {
        requestKey: `EXAM2QA:FILL:${target.id}:0001`,
        expectedSheetVersion: component.sheet?.version,
        expectedVersionNumber: component.sheet?.versionNumber,
        expectedOptimisticVersion: component.sheet?.optimisticVersion,
        rows: students.map((student, index) => {
          const entry = component.entries.find((item: any) => item.studentId === student.id);
          return {
            studentId: student.id,
            entryState: "PRESENT",
            marksObtained: marks[index],
            expectedRowVersion: entry.rowVersion
          };
        })
      }, owner);
    }

    let mathInternalDraft = await fill(mathInternal, teacherOne, [20, 20, 10, 5]);
    const concurrentRows = [{
      studentId: students[2].id,
      entryState: "PRESENT",
      marksObtained: 11,
      expectedRowVersion: mathInternalDraft.entries.find((entry: any) => entry.studentId === students[2].id).rowVersion
    }];
    const concurrentDrafts = await Promise.allSettled([
      saveAssignedMarkDraft(client, mathInternal.id, {
        requestKey: "EXAM2QA:CONCURRENT-DRAFT:A",
        expectedSheetVersion: mathInternalDraft.sheetVersion,
        expectedVersionNumber: mathInternalDraft.versionNumber,
        expectedOptimisticVersion: mathInternalDraft.optimisticVersion,
        rows: concurrentRows
      }, teacherOne),
      saveAssignedMarkDraft(client, mathInternal.id, {
        requestKey: "EXAM2QA:CONCURRENT-DRAFT:B",
        expectedSheetVersion: mathInternalDraft.sheetVersion,
        expectedVersionNumber: mathInternalDraft.versionNumber,
        expectedOptimisticVersion: mathInternalDraft.optimisticVersion,
        rows: [{ ...concurrentRows[0], marksObtained: 12 }]
      }, teacherOne)
    ]);
    invariant(concurrentDrafts.filter((result) => result.status === "fulfilled").length === 1, "EXAM2QA_CONCURRENT_DRAFT_SUCCESS_COUNT");
    const rejectedDraft = concurrentDrafts.find((result) => result.status === "rejected") as PromiseRejectedResult;
    invariant(
      rejectedDraft.reason instanceof ExamMarksError &&
      rejectedDraft.reason.status === 409,
      "EXAM2QA_CONCURRENT_DRAFT_NOT_CONFLICT"
    );
    const normalizeInternal = await loadTeacherMarksWorkspace(client, teacherOne, mathInternal.id);
    const normalizeComponent = normalizeInternal.selectedWorkspace?.components.find((item: any) => item.assignment.id === mathInternal.id);
    invariant(normalizeComponent?.sheet, "EXAM2QA_INTERNAL_NORMALIZE_LOAD");
    mathInternalDraft = await saveAssignedMarkDraft(client, mathInternal.id, {
      requestKey: "EXAM2QA:INTERNAL:NORMALIZE:0001",
      expectedSheetVersion: normalizeComponent.sheet.version,
      expectedVersionNumber: normalizeComponent.sheet.versionNumber,
      expectedOptimisticVersion: normalizeComponent.sheet.optimisticVersion,
      rows: [{
        studentId: students[2].id,
        entryState: "PRESENT",
        marksObtained: 10,
        expectedRowVersion: normalizeComponent.entries.find((entry: any) => entry.studentId === students[2].id).rowVersion
      }]
    }, teacherOne);

    const filled = new Map<any, any>([
      [mathWritten, completedMathWritten],
      [mathInternal, mathInternalDraft],
      [scienceTheory, await fill(scienceTheory, teacherOne, [70, 70, 0, 56])],
      [sciencePractical, await fill(sciencePractical, teacherOne, [30, 30, 0, 24])],
      [socialWritten, await fill(socialWritten, teacherTwo, [64, 64, 0, 72])],
      [socialInternal, await fill(socialInternal, teacherTwo, [16, 16, 0, 18])]
    ]);
    invariant([...filled.values()].every((item) => item.status === "READY_TO_SUBMIT"), "EXAM2QA_READY_STATE_FAILED");
    invariant(await client.examinationSchemeAudit.count({
      where: { examinationId: state.examinationId, eventType: { in: ["SHEET_SUBMITTED", "SHEET_RESUBMITTED"] } }
    }) === 0, "EXAM2QA_HIDDEN_FINAL_SUBMISSION");

    const mathSubmitInput = {
      expectedSheetVersion: completedMathWritten.sheetVersion,
      expectedOptimisticVersion: completedMathWritten.optimisticVersion
    };
    const concurrentSubmissions = await Promise.allSettled([
      submitAssignedMarkSheet(client, mathWritten.id, {
        ...mathSubmitInput,
        requestKey: "EXAM2QA:CONCURRENT-SUBMIT:A"
      }, teacherOne),
      submitAssignedMarkSheet(client, mathWritten.id, {
        ...mathSubmitInput,
        requestKey: "EXAM2QA:CONCURRENT-SUBMIT:B"
      }, teacherOne)
    ]);
    invariant(concurrentSubmissions.some((result) => result.status === "fulfilled"), "EXAM2QA_CONCURRENT_SUBMIT_NO_SUCCESS");
    invariant(await client.examinationSchemeAudit.count({
      where: { assignmentId: mathWritten.id, eventType: "SHEET_SUBMITTED" }
    }) === 1, "EXAM2QA_DUPLICATE_FINAL_SUBMISSION_EVENT");
    const submittedMath = concurrentSubmissions.find((result) => result.status === "fulfilled") as PromiseFulfilledResult<any>;
    const duplicateSubmit = await submitAssignedMarkSheet(client, mathWritten.id, {
      ...mathSubmitInput,
      requestKey: submittedMath.value.submitted
        ? (concurrentSubmissions[0].status === "fulfilled" ? "EXAM2QA:CONCURRENT-SUBMIT:A" : "EXAM2QA:CONCURRENT-SUBMIT:B")
        : "EXAM2QA:CONCURRENT-SUBMIT:A"
    }, teacherOne);
    invariant(duplicateSubmit.submitted, "EXAM2QA_DUPLICATE_SUBMIT_NOT_IDEMPOTENT");

    for (const [target, saved] of filled) {
      if (target.id === mathWritten.id) continue;
      const owner = ["SOC"].includes(target.paper.code) ? teacherTwo : teacherOne;
      const submitted = await submitAssignedMarkSheet(client, target.id, {
        requestKey: `EXAM2QA:SUBMIT:${target.id}:0001`,
        expectedSheetVersion: saved.sheetVersion,
        expectedOptimisticVersion: saved.optimisticVersion
      }, owner);
      invariant(submitted.submitted, `EXAM2QA_SUBMISSION_FAILED:${target.id}`);
    }

    const scienceCorrection = await requestMarkCorrection(client, sciencePractical.id, {
      requestKey: "EXAM2QA:CORRECTION:REJECT:REQUEST",
      reason: "Independent QA rejection-path request."
    }, teacherOne);
    await expectError(() => requestMarkCorrection(client, scienceTheory.id, {
      requestKey: "EXAM2QA:CORRECTION:TOO-LONG",
      reason: "x".repeat(501)
    }, teacherOne), { type: "marks", status: 400 });
    const rejectedCorrection = await reviewMarkCorrection(client, scienceCorrection.requestId, {
      action: "reject",
      requestKey: "EXAM2QA:CORRECTION:REJECT:REVIEW",
      expectedSheetVersion: scienceCorrection.sheetVersion,
      reason: "Independent QA rejected the synthetic request."
    }, principal);
    invariant(rejectedCorrection.status === "REJECTED", "EXAM2QA_CORRECTION_REJECT_FAILED");

    const submittedSheets = await client.examMarkSheet.findMany({
      where: { examinationId: state.examinationId, currentKey: { not: null } }
    });
    for (const sheet of submittedSheets) {
      if (!["SUBMITTED", "RESUBMITTED"].includes(sheet.status)) continue;
      await moderateMarkSheet(client, sheet.id, {
        requestKey: `EXAM2QA:MODERATE:${sheet.id}:0001`,
        expectedSheetVersion: sheet.optimisticVersion,
        reason: "Independent QA source moderation."
      }, principal);
    }

    const beforeMissingPreview = await client.studentResultSnapshot.count({ where: { examinationId: state.examinationId } });
    invariant(beforeMissingPreview === 0, "EXAM2QA_PREVIEW_CREATED_EARLY");
    const weightedComponent = await client.examinationComponent.findUniqueOrThrow({
      where: { id: sciencePractical.component.id }
    });
    await client.examinationComponent.update({
      where: { id: weightedComponent.id },
      data: { contributionWeight: new Prisma.Decimal(20) }
    });
    await expectError(() => runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:INVALID-WEIGHTS:PREVIEW",
      reason: "Invalid frozen weight refusal verification."
    }, principal), { type: "marks", status: 409, code: "CALCULATION_NOT_READY" });
    await client.examinationComponent.update({
      where: { id: weightedComponent.id },
      data: { contributionWeight: new Prisma.Decimal(30) }
    });
    const rawComponent = await client.examinationComponent.findUniqueOrThrow({
      where: { id: mathInternal.component.id }
    });
    await client.examinationComponent.update({
      where: { id: rawComponent.id },
      data: { maximumMarks: new Prisma.Decimal(0) }
    });
    await expectError(() => runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:ZERO-DENOMINATOR:PREVIEW",
      reason: "Unsafe zero denominator refusal verification."
    }, principal), { type: "marks", status: 409, code: "CALCULATION_NOT_READY" });
    await client.examinationComponent.update({
      where: { id: rawComponent.id },
      data: { maximumMarks: new Prisma.Decimal(20) }
    });

    const previewOne = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:CALCULATION:PREVIEW:ONE",
      reason: "Independent hand-calculated preview one."
    }, principal);
    invariant(previewOne.snapshots.length === 4, "EXAM2QA_PREVIEW_COHORT_COUNT");
    const byStudent = new Map(previewOne.snapshots.map((snapshot: any) => [snapshot.studentId, snapshot]));
    const expected = new Map([
      [students[0].id, { percentage: "66.67", rank: 1, grade: "B", pass: "PASS" }],
      [students[1].id, { percentage: "66.67", rank: 1, grade: "B", pass: "PASS" }],
      [students[2].id, { percentage: "16.67", rank: 4, grade: "D", pass: "FAIL" }],
      [students[3].id, { percentage: "65.00", rank: 3, grade: "B", pass: "PASS" }]
    ]);
    for (const [studentId, values] of expected) {
      const snapshot: any = byStudent.get(studentId);
      invariant(snapshot, `EXAM2QA_SNAPSHOT_MISSING:${studentId}`);
      invariant(snapshot.percentage === values.percentage, `EXAM2QA_PERCENTAGE_MISMATCH:${studentId}:${snapshot.percentage}`);
      invariant(snapshot.rank === values.rank, `EXAM2QA_RANK_MISMATCH:${studentId}`);
      invariant(snapshot.gradeCode === values.grade, `EXAM2QA_GRADE_MISMATCH:${studentId}`);
      invariant(snapshot.passResult === values.pass, `EXAM2QA_PASS_MISMATCH:${studentId}`);
      invariant(snapshot.details.cohortAverage === "53.75", `EXAM2QA_AVERAGE_MISMATCH:${studentId}`);
      invariant(snapshot.details.cohortHighest === "66.67", `EXAM2QA_HIGHEST_MISMATCH:${studentId}`);
      invariant(snapshot.details.groups.length === 1, `EXAM2QA_GROUP_COUNT_MISMATCH:${studentId}`);
      invariant(snapshot.details.groups[0].groupCode === "SCI_SOC", `EXAM2QA_IMPLICIT_GROUP_RULE:${studentId}`);
      invariant(
        snapshot.details.attendanceReference.totalLockedDays === 2 &&
        snapshot.details.attendanceReference.recordedDays === 2,
        `EXAM2QA_ATTENDANCE_RANGE:${studentId}`
      );
    }
    const zeroComponent = (byStudent.get(students[0].id) as any).details.papers
      .flatMap((paper: any) => paper.components)
      .find((component: any) => component.code === "WRITTEN");
    invariant(zeroComponent.state === "PRESENT" && zeroComponent.obtained === "0.00", "EXAM2QA_ZERO_LOST");
    const absentComponent = (byStudent.get(students[1].id) as any).details.papers
      .flatMap((paper: any) => paper.components)
      .find((component: any) => component.code === "WRITTEN");
    invariant(absentComponent.state === "ABSENT" && absentComponent.obtained === "0.00", "EXAM2QA_ABSENT_POLICY");
    const weightedPaper = (byStudent.get(students[3].id) as any).details.papers
      .find((paper: any) => paper.calculationMode === "WEIGHTED_NORMALIZED");
    invariant(
      weightedPaper.components[0].contribution === "56.00" &&
      weightedPaper.components[1].contribution === "24.00" &&
      weightedPaper.percentage === "80.00",
      "EXAM2QA_WEIGHTED_FORMULA_MISMATCH"
    );

    const previewRepeat = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:CALCULATION:PREVIEW:REPEAT",
      reason: "Independent deterministic preview rerun."
    }, principal);
    invariant(previewRepeat.idempotent && previewRepeat.id === previewOne.id, "EXAM2QA_PREVIEW_NOT_DETERMINISTIC");

    const attendanceRecord = await client.studentAttendanceRecord.findFirstOrThrow({
      where: { studentId: students[0].id, session: { status: "LOCKED" } }
    });
    await client.studentAttendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: { status: "ABSENT" }
    });
    await expectError(() => lockExaminationCalculation(client, previewOne.id, {
      requestKey: "EXAM2QA:LOCK:STALE-ATTENDANCE",
      reason: "Stale attendance fingerprint refusal."
    }, principal), { type: "marks", status: 409, code: "EXPECTED_VERSION_CONFLICT" });
    await client.studentAttendanceRecord.update({
      where: { id: attendanceRecord.id },
      data: { status: attendanceRecord.status }
    });
    const concurrentLocks = await Promise.allSettled([
      lockExaminationCalculation(client, previewOne.id, {
        requestKey: "EXAM2QA:LOCK:ONE:A",
        reason: "Independent concurrent lock A."
      }, principal),
      lockExaminationCalculation(client, previewOne.id, {
        requestKey: "EXAM2QA:LOCK:ONE:B",
        reason: "Independent concurrent lock B."
      }, principal)
    ]);
    invariant(concurrentLocks.some((result) => result.status === "fulfilled"), "EXAM2QA_CONCURRENT_LOCK_NO_SUCCESS");
    invariant(await client.examinationSchemeAudit.count({
      where: { targetId: previewOne.id, eventType: "CALCULATION_SNAPSHOT_LOCKED" }
    }) === 1, "EXAM2QA_DUPLICATE_LOCK_EVENT");
    const oldSnapshots = await client.studentResultSnapshot.findMany({
      where: { calculationRunId: previewOne.id },
      orderBy: { studentId: "asc" }
    });
    const oldSnapshotHash = stableHash(oldSnapshots.map((snapshot) => ({
      id: snapshot.id,
      version: snapshot.snapshotVersion,
      json: snapshot.snapshotJson,
      percentage: snapshot.percentage.toString()
    })));

    const correction = await requestMarkCorrection(client, mathWritten.id, {
      requestKey: "EXAM2QA:CORRECTION:REOPEN:REQUEST",
      reason: "Governed correction after the first moderated calculation."
    }, teacherOne);
    await client.$executeRawUnsafe(`
      CREATE TRIGGER "EXAM2QA_force_reopen_rollback"
      BEFORE INSERT ON "ExaminationSchemeAudit"
      WHEN NEW."eventType" = 'SHEET_REOPENED'
      BEGIN
        SELECT RAISE(ABORT, 'EXAM2QA forced rollback');
      END
    `);
    await expectError(() => reviewMarkCorrection(client, correction.requestId, {
      action: "reopen",
      requestKey: "EXAM2QA:CORRECTION:FORCED-ROLLBACK",
      expectedSheetVersion: correction.sheetVersion,
      reason: "Forced transaction rollback verification."
    }, principal), { type: "marks", status: 409 });
    await client.$executeRawUnsafe(`DROP TRIGGER "EXAM2QA_force_reopen_rollback"`);
    invariant(await client.examMarkSheet.count({
      where: { logicalSheetKey: { equals: (await client.examMarkSheet.findFirstOrThrow({ where: { primaryAssignmentId: mathWritten.id } })).logicalSheetKey } }
    }) === 1, "EXAM2QA_FORCED_REOPEN_DID_NOT_ROLL_BACK");
    const reopened = await reviewMarkCorrection(client, correction.requestId, {
      action: "reopen",
      requestKey: "EXAM2QA:CORRECTION:REOPEN:APPROVE",
      expectedSheetVersion: correction.sheetVersion,
      reason: "Principal approved independent synthetic correction."
    }, principal);
    invariant(reopened.versionNumber === 2, "EXAM2QA_REOPEN_VERSION_NOT_TWO");
    const repeatedReopen = await reviewMarkCorrection(client, correction.requestId, {
      action: "reopen",
      requestKey: "EXAM2QA:CORRECTION:REOPEN:REPEAT",
      expectedSheetVersion: correction.sheetVersion,
      reason: "Repeated reopen protection."
    }, principal);
    invariant(repeatedReopen.versionNumber === 1 || repeatedReopen.status === "APPROVED", "EXAM2QA_REPEATED_REOPEN_UNSAFE");
    invariant(await client.examMarkSheet.count({
      where: { logicalSheetKey: (await client.examMarkSheet.findFirstOrThrow({ where: { primaryAssignmentId: mathWritten.id } })).logicalSheetKey }
    }) === 2, "EXAM2QA_DUPLICATE_REOPEN_VERSION");

    const reopenedWorkspace = await loadTeacherMarksWorkspace(client, teacherOne, mathWritten.id);
    const reopenedComponent = reopenedWorkspace.selectedWorkspace?.components.find((item: any) => item.assignment.id === mathWritten.id);
    invariant(reopenedComponent?.sheet?.versionNumber === 2, "EXAM2QA_REOPENED_WORKSPACE_VERSION");
    const correctedDraft = await saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:CORRECTION:EDIT:0001",
      expectedSheetVersion: reopenedComponent.sheet.version,
      expectedVersionNumber: 2,
      expectedOptimisticVersion: reopenedComponent.sheet.optimisticVersion,
      rows: [{
        studentId: students[0].id,
        entryState: "PRESENT",
        marksObtained: 10,
        expectedRowVersion: reopenedComponent.entries.find((entry: any) => entry.studentId === students[0].id).rowVersion
      }]
    }, teacherOne);
    const resubmitted = await submitAssignedMarkSheet(client, mathWritten.id, {
      requestKey: "EXAM2QA:CORRECTION:RESUBMIT:0001",
      expectedSheetVersion: correctedDraft.sheetVersion,
      expectedOptimisticVersion: correctedDraft.optimisticVersion
    }, teacherOne);
    invariant(resubmitted.status === "RESUBMITTED", "EXAM2QA_RESUBMISSION_LINKAGE");
    const correctedSheet = await client.examMarkSheet.findFirstOrThrow({
      where: { primaryAssignmentId: mathWritten.id, currentKey: { not: null } }
    });
    await moderateMarkSheet(client, correctedSheet.id, {
      requestKey: "EXAM2QA:CORRECTION:MODERATE:0001",
      expectedSheetVersion: correctedSheet.optimisticVersion,
      reason: "Moderated corrected sheet version."
    }, principal);

    const previewTwo = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:CALCULATION:PREVIEW:TWO",
      reason: "Independent corrected calculation preview."
    }, principal);
    invariant(previewTwo.id !== previewOne.id, "EXAM2QA_CORRECTION_DID_NOT_CREATE_NEW_RUN");
    invariant(previewTwo.snapshots.every((snapshot: any) => snapshot.version === 2), "EXAM2QA_SNAPSHOT_VERSION_NOT_INCREMENTED");
    await lockExaminationCalculation(client, previewTwo.id, {
      requestKey: "EXAM2QA:LOCK:TWO",
      reason: "Lock corrected calculation snapshot."
    }, principal);
    const afterCorrectionOld = await client.studentResultSnapshot.findMany({
      where: { calculationRunId: previewOne.id },
      orderBy: { studentId: "asc" }
    });
    invariant(oldSnapshotHash === stableHash(afterCorrectionOld.map((snapshot) => ({
      id: snapshot.id,
      version: snapshot.snapshotVersion,
      json: snapshot.snapshotJson,
      percentage: snapshot.percentage.toString()
    }))), "EXAM2QA_OLD_SNAPSHOT_MUTATED");
    const dashboard = await loadMarksModerationDashboard(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId
    });
    invariant(dashboard.calculationRuns.filter((run: any) => run.status === "LOCKED").length === 1, "EXAM2QA_ACTIVE_LOCKED_RUN_COUNT");
    invariant(dashboard.calculationRuns.some((run: any) => run.id === previewOne.id && run.status === "SUPERSEDED"), "EXAM2QA_OLD_RUN_NOT_SUPERSEDED");
    await expectError(() => saveAssignedMarkDraft(client, mathWritten.id, {
      requestKey: "EXAM2QA:POST-LOCK:EDIT",
      expectedSheetVersion: correctedDraft.sheetVersion,
      expectedVersionNumber: 2,
      expectedOptimisticVersion: correctedDraft.optimisticVersion,
      rows: [{
        studentId: students[0].id,
        entryState: "PRESENT",
        marksObtained: 1,
        expectedRowVersion: correctedDraft.entries.find((entry: any) => entry.studentId === students[0].id).rowVersion
      }]
    }, teacherOne), { type: "marks", status: 409 });

    await expectError(() => runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2QA:CALCULATION:RATE-LIMIT",
      reason: "Heavy calculation rate-limit verification."
    }, principal), { type: "marks", status: 429 });

    const superAdminUser = await client.user.findUniqueOrThrow({
      where: { username: state.independent.accounts.superAdmin.username }
    });
    const superAdmin = actor(superAdminUser);
    const superAdminCorrection = await requestMarkCorrection(client, socialInternal.id, {
      requestKey: "EXAM2QA:SUPER-ADMIN:CORRECTION:REQUEST",
      reason: "Synthetic Super Admin reason separation check."
    }, teacherTwo);
    await expectError(() => reviewMarkCorrection(client, superAdminCorrection.requestId, {
      action: "reject",
      requestKey: "EXAM2QA:SUPER-ADMIN:CORRECTION:MISSING-INTERVENTION",
      expectedSheetVersion: superAdminCorrection.sheetVersion,
      reason: "Ordinary governed rejection reason."
    }, superAdmin), { type: "marks", status: 400 });
    await reviewMarkCorrection(client, superAdminCorrection.requestId, {
      action: "reject",
      requestKey: "EXAM2QA:SUPER-ADMIN:CORRECTION:REJECT",
      expectedSheetVersion: superAdminCorrection.sheetVersion,
      reason: "Ordinary governed rejection reason.",
      interventionReason: "Distinct owner-level intervention justification."
    }, superAdmin);
    const superAdminAudit = await client.examinationSchemeAudit.findFirstOrThrow({
      where: {
        examinationId: state.examinationId,
        eventType: "CORRECTION_REJECTED",
        actorUserId: superAdmin.id
      },
      orderBy: { eventDate: "desc" }
    });
    invariant(superAdminAudit.reason === "Ordinary governed rejection reason.", "EXAM2QA_SUPER_ADMIN_ORDINARY_REASON_LOST");
    invariant(
      JSON.parse(superAdminAudit.snapshotJson).interventionReason === "Distinct owner-level intervention justification.",
      "EXAM2QA_SUPER_ADMIN_INTERVENTION_REASON_LOST"
    );

    const [auditCount, reportPublicationCount] = await Promise.all([
      client.examinationSchemeAudit.count({ where: { examinationId: state.examinationId, eventKey: { not: null } } }),
      client.studentReportCard.count()
    ]);
    invariant(auditCount >= 30, "EXAM2QA_APPEND_ONLY_AUDIT_COUNT");
    invariant(reportPublicationCount === 0, "EXAM2QA_REPORT_PUBLICATION_CREATED");
    console.log("EXAM2QA independent object-scope, entry-state, lifecycle, correction, rollback, calculation, snapshot, concurrency, and no-publication checks passed.");
  } finally {
    await client.$disconnect();
  }
  invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_CHANGED_DURING_EXERCISE");
}

async function inspect() {
  const state = readState();
  invariant(state.independent, "EXAM2QA_INDEPENDENT_NOT_PROVISIONED");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [baseline, users, students, sheets, entries, snapshots, audits, activeLocked, superseded] = await Promise.all([
      businessBaseline(state.databasePath),
      client.user.count({ where: { username: { startsWith: "exam2qa-" } } }),
      client.student.count({ where: { admissionNo: { startsWith: "EXAM2QA-" } } }),
      client.examMarkSheet.count({ where: { examinationId: state.examinationId } }),
      client.examMarkEntry.count({ where: { sheet: { examinationId: state.examinationId } } }),
      client.studentResultSnapshot.count({ where: { examinationId: state.examinationId } }),
      client.examinationSchemeAudit.count({ where: { examinationId: state.examinationId, eventKey: { not: null } } }),
      client.examinationSchemeAudit.count({
        where: {
          examinationId: state.examinationId,
          eventType: "CALCULATION_SNAPSHOT_LOCKED",
          targetId: {
            notIn: (await client.examinationSchemeAudit.findMany({
              where: { examinationId: state.examinationId, eventType: "CALCULATION_SNAPSHOT_SUPERSEDED" },
              select: { targetId: true }
            })).map((row) => row.targetId)
          }
        }
      }),
      client.examinationSchemeAudit.count({
        where: { examinationId: state.examinationId, eventType: "CALCULATION_SNAPSHOT_SUPERSEDED" }
      })
    ]);
    invariant(users === 10, `EXAM2QA_USER_COUNT:${users}`);
    invariant(students === 6, `EXAM2QA_STUDENT_COUNT:${students}`);
    invariant(sheets === 7 && entries === 28, `EXAM2QA_SHEET_ENTRY_COUNT:${sheets}:${entries}`);
    invariant(snapshots === 8, `EXAM2QA_SNAPSHOT_COUNT:${snapshots}`);
    invariant(audits >= 30 && activeLocked === 1 && superseded === 1, "EXAM2QA_AUDIT_LOCK_INVARIANTS");
    invariant(baseline.payments === 0 && baseline.collected === 0, "EXAM2QA_FINANCE_BASELINE_CHANGED");
    invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_CHANGED_DURING_INSPECT");
    console.log(`EXAM2QA inspection passed: users=${users} students=${students} sheets=${sheets} entries=${entries} snapshots=${snapshots} audits=${audits} activeLocked=${activeLocked} superseded=${superseded}.`);
  } finally {
    await client.$disconnect();
  }
}

async function backupRestore() {
  const state = readState();
  invariant(state.independent, "EXAM2QA_INDEPENDENT_NOT_PROVISIONED");
  invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_DRIFT");
  const restorePath = assertIsolatedDatabasePath(path.join(QA_ROOT, "restore", `${PREFIX}-restore-${process.pid}.db`));
  const backupPath = assertIsolatedDatabasePath(path.join(QA_ROOT, "restore", `${PREFIX}-v37-${process.pid}.backup.json`));
  invariant(!existsSync(restorePath) && !existsSync(backupPath), "EXAM2QA_BACKUP_RESTORE_STATE_EXISTS");
  const source = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  let target: PrismaClient | null = null;
  try {
    const generated = await generateFullBackup(source, {
      generatedBy: "EXAM-RC-IMPL-2-QA independent copied-database verification",
      generatedAt: new Date()
    });
    const serialized = serializeBackup(generated);
    invariant(!/"(?:passwordHash|password|token|secret|credential|apiKey)"\s*:/i.test(serialized), "EXAM2QA_BACKUP_CREDENTIAL_FIELD");
    writeFileSync(backupPath, serialized, { flag: "wx", encoding: "utf8", mode: 0o600 });
    const validated = parseAndValidateBackup(JSON.parse(serialized));
    invariant(validated.metadata.backupVersion === 38, "EXAM2QA_BACKUP_VERSION_CHANGED");
    const expectedGovernanceCount = Object.values(validated.examGovernance).reduce((sum, rows) => sum + rows.length, 0);
    invariant(expectedGovernanceCount > 0, "EXAM2QA_BACKUP_GOVERNANCE_EMPTY");
    invariant(validated.metadata.counts?.examGovernanceRecords === expectedGovernanceCount, "EXAM2QA_BACKUP_GOVERNANCE_COUNT");
    const expectedHash = governanceHash(validated.examGovernance);
    await source.$disconnect();

    copyFileSync(state.databasePath, restorePath, 0);
    target = new PrismaClient({ datasourceUrl: databaseUrl(restorePath) });
    await target.$transaction(async (tx) => {
      await tx.studentResultSnapshot.deleteMany();
      await tx.examinationSchemeAudit.deleteMany();
      await tx.examMarkEntry.deleteMany();
      await tx.examMarkSheet.updateMany({ data: { supersedesSheetId: null } });
      await tx.examMarkSheet.deleteMany();
      await tx.teacherExamAssignment.deleteMany();
      await tx.examTemplateFamilyBinding.deleteMany();
      await tx.coScholasticItem.deleteMany();
      await tx.coScholasticSchemeVersion.deleteMany();
      await tx.gradeScaleBand.deleteMany();
      await tx.gradeScaleVersion.deleteMany();
      await tx.examSubjectGroupMember.deleteMany();
      await tx.examSubjectGroup.deleteMany();
      await tx.examinationComponent.deleteMany();
      await tx.examinationSchemeVersion.updateMany({ data: { supersedesVersionId: null } });
      await tx.examinationSchemeVersion.deleteMany();
      await tx.examSubjectPaper.deleteMany();
      await tx.examinationClassScope.deleteMany();
      await tx.examination.deleteMany();
    });
    invariant((await target.examination.count()) === 0, "EXAM2QA_RESTORE_TARGET_NOT_CLEARED");
    const studentMap = new Map(validated.students.map((student) => [String(student.id), String(student.id)]));

    const first = await restoreExamGovernanceBackup(target, validated.examGovernance, studentMap);
    invariant(first.errors.length === 0, `EXAM2QA_FIRST_RESTORE_ERRORS:${first.errors.slice(0, 2).join("|")}`);
    const firstData = await loadExamGovernanceBackup(target);
    invariant(governanceHash(firstData) === expectedHash, "EXAM2QA_FIRST_RESTORE_GOVERNANCE_MISMATCH");
    const firstCount = Object.values(firstData).reduce((sum, rows) => sum + rows.length, 0);
    invariant(firstCount === expectedGovernanceCount, "EXAM2QA_FIRST_RESTORE_COUNT_MISMATCH");

    const second = await restoreExamGovernanceBackup(target, validated.examGovernance, studentMap);
    invariant(second.errors.length === 0, `EXAM2QA_SECOND_RESTORE_ERRORS:${second.errors.slice(0, 2).join("|")}`);
    const secondData = await loadExamGovernanceBackup(target);
    invariant(governanceHash(secondData) === expectedHash, "EXAM2QA_SECOND_RESTORE_GOVERNANCE_MISMATCH");
    const secondCount = Object.values(secondData).reduce((sum, rows) => sum + rows.length, 0);
    invariant(secondCount === firstCount, "EXAM2QA_REPEATED_RESTORE_DUPLICATED_GOVERNANCE");
    invariant(second.created === 0 && second.skipped === expectedGovernanceCount, "EXAM2QA_REPEATED_RESTORE_NOT_IDEMPOTENT");
    invariant((await target.studentReportCard.count()) === 0, "EXAM2QA_RESTORE_CREATED_PUBLICATION");
    console.log(`EXAM2QA version-37 backup restored twice: governanceRecords=${expectedGovernanceCount} secondCreated=0 secondSkipped=${expectedGovernanceCount}.`);
  } finally {
    await source.$disconnect().catch(() => undefined);
    if (target) await target.$disconnect().catch(() => undefined);
    if (existsSync(restorePath)) rmSync(restorePath, { force: true });
    if (existsSync(backupPath)) rmSync(backupPath, { force: true });
  }
  invariant(fileSha256(OPERATIONAL_DATABASE) === state.sourceHash, "EXAM2QA_OPERATIONAL_HASH_CHANGED_DURING_BACKUP_RESTORE");
}

const action = process.argv.slice(2).find((value) => value !== "--") ?? "inspect";
const runner = action === "provision"
  ? provision
  : action === "exercise"
    ? exercise
    : action === "inspect"
      ? inspect
      : action === "backup-restore"
        ? backupRestore
        : null;
if (!runner) {
  console.error("Usage: tsx scripts/qa-exam2qa-independent.ts -- provision|exercise|inspect|backup-restore");
  process.exitCode = 1;
} else {
  runner().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : "EXAM2QA independent QA failed");
    process.exitCode = 1;
  });
}
