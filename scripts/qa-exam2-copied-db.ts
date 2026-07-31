import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  loadTeacherMarksWorkspace,
  moderateMarkSheet,
  requestMarkCorrection,
  reviewMarkCorrection,
  saveAssignedMarkDraft,
  submitAssignedMarkSheet
} from "../lib/exam-marks";
import { requireExactExamMarkAssignment } from "../lib/exam-marks-scope";
import {
  lockExaminationCalculation,
  runExaminationCalculationPreview
} from "../lib/exam-calculations-v2";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  businessBaseline,
  cleanupIsolatedDatabase,
  createEmptyIsolatedDatabase,
  databaseUrl,
  fileSha256,
  runPrisma
} from "./migration-check-utils";

const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM2-browser-state.json");
const PASSWORD = "EXAM2-local-only-Workflow-2026!";

type Actor = {
  id: string;
  name: string;
  username: string;
  email: null;
  guardianId: null;
  role: "PRINCIPAL" | "TEACHER";
};

type QaState = {
  databasePath: string;
  sourceHash: string;
  examinationId: string;
  classScopeId: string;
  principalUsername: string;
  teacherOneUsername: string;
  teacherTwoUsername: string;
  password: string;
};

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM2_QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function removeState() {
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
}

function actor(user: { id: string; name: string; username: string; role: string }): Actor {
  if (user.role !== "TEACHER" && user.role !== "PRINCIPAL") throw new Error("EXAM2_ACTOR_ROLE_INVALID");
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: null,
    guardianId: null,
    role: user.role
  };
}

async function createTeacher(
  client: PrismaClient,
  passwordHash: string,
  sequence: number
) {
  const user = await client.user.create({
    data: {
      name: `EXAM2 Teacher ${sequence}`,
      username: `exam2-teacher-${sequence}`,
      passwordHash,
      role: "TEACHER",
      isActive: true
    }
  });
  const timetableTeacher = await client.timetableTeacher.create({
    data: {
      name: user.name,
      shortName: `EX2-T${sequence}`,
      department: "EXAM2 Synthetic",
      maxPeriodsPerWeek: 30,
      maxPeriodsPerDay: 8,
      isActive: true
    }
  });
  const staff = await client.staffMember.create({
    data: {
      staffCode: `EXAM2-T0${sequence}`,
      fullName: user.name,
      displayName: user.name,
      staffType: "TEACHING",
      designation: "EXAM2 Synthetic Teacher",
      department: "EXAM2 Synthetic",
      status: "ACTIVE",
      userId: user.id,
      timetableTeacherId: timetableTeacher.id
    }
  });
  return { user, timetableTeacher, staff };
}

async function prepare() {
  if (existsSync(STATE_PATH)) {
    const prior = readState();
    cleanupIsolatedDatabase(prior.databasePath);
    removeState();
  }
  const sourceHash = fileSha256(OPERATIONAL_DATABASE);
  const databasePath = createEmptyIsolatedDatabase("operational-copy", "EXAM2-browser");
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  if (fileSha256(databasePath) !== sourceHash) throw new Error("EXAM2_COPY_HASH_MISMATCH");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
  try {
    const passwordHash = await hashPassword(PASSWORD);
    const principal = await client.user.create({
      data: {
        name: "EXAM2 Principal",
        username: "exam2-principal",
        passwordHash,
        role: "PRINCIPAL",
        isActive: true
      }
    });
    const teacherOne = await createTeacher(client, passwordHash, 1);
    const teacherTwo = await createTeacher(client, passwordHash, 2);

    const classA = await client.timetableClassSection.create({
      data: {
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        displayName: "EXAM2A - QA",
        groupName: "EXAM2 SYNTHETIC",
        isActive: true
      }
    });
    await client.timetableClassSection.createMany({
      data: [
        {
          academicYear: "2026-27",
          className: "EXAM2B",
          section: "QB",
          displayName: "EXAM2B - QB",
          groupName: "EXAM2 SYNTHETIC",
          isActive: true
        },
        {
          academicYear: "2025-26",
          className: "EXAM2A",
          section: "QA",
          displayName: "EXAM2A - QA (prior)",
          groupName: "EXAM2 SYNTHETIC",
          isActive: true
        }
      ]
    });
    const subjects = await Promise.all([
      client.timetableSubject.create({ data: { name: "EXAM2 Mathematics", shortName: "EX2-MATH", department: "EXAM2 Synthetic", isActive: true } }),
      client.timetableSubject.create({ data: { name: "EXAM2 Science", shortName: "EX2-SCI", department: "EXAM2 Synthetic", isActive: true } }),
      client.timetableSubject.create({ data: { name: "EXAM2 Social", shortName: "EX2-SOC", department: "EXAM2 Synthetic", isActive: true } })
    ]);
    const timetableAssignments = new Map<string, string>();
    for (const [subjectIndex, subject] of subjects.entries()) {
      const owners = subjectIndex === 0
        ? [teacherOne.timetableTeacher, teacherTwo.timetableTeacher]
        : subjectIndex === 1
          ? [teacherOne.timetableTeacher]
          : [teacherTwo.timetableTeacher];
      for (const owner of owners) {
        const assignment = await client.timetableAssignment.create({
          data: {
            academicYear: "2026-27",
            classSectionId: classA.id,
            subjectId: subject.id,
            teacherId: owner.id,
            periodsPerWeek: 5,
            notes: "EXAM2 exact-scope synthetic fixture"
          }
        });
        timetableAssignments.set(`${subject.id}:${owner.id}`, assignment.id);
      }
    }

    const examination = await client.examination.create({
      data: {
        examCode: "EXAM2",
        academicYear: "2026-27",
        name: "EXAM2 Marks and Moderation",
        examType: "TERM",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-12T00:00:00.000Z"),
        status: "ACTIVE",
        description: "EXAM2 synthetic copied-database fixture only.",
        createdByUserId: principal.id,
        activatedByUserId: principal.id,
        activatedAt: new Date("2026-08-15T09:00:00.000Z")
      }
    });
    const classScope = await client.examinationClassScope.create({
      data: {
        examinationId: examination.id,
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        timetableClassSectionId: classA.id,
        status: "ACTIVE",
        createdByUserId: principal.id
      }
    });
    const papers = [];
    for (const [index, subject] of subjects.entries()) {
      papers.push(await client.examSubjectPaper.create({
        data: {
          examinationId: examination.id,
          classScopeId: classScope.id,
          academicYear: "2026-27",
          className: "EXAM2A",
          section: "QA",
          timetableSubjectId: subject.id,
          subjectNameSnapshot: subject.name,
          paperCode: ["MATH", "SCI", "SOC"][index],
          paperName: ["Mathematics", "Science", "Social Science"][index],
          displayOrder: index + 1,
          status: "ACTIVE",
          createdByUserId: principal.id
        }
      }));
    }
    const activatedAt = new Date("2026-08-15T09:30:00.000Z");
    const rawScheme = await client.examinationSchemeVersion.create({
      data: {
        examinationId: examination.id,
        classScopeId: classScope.id,
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        scopeKey: "BASE",
        versionNumber: 1,
        calculationMode: "RAW_SUM",
        markDecimalPlaces: 1,
        passFailEnabled: true,
        passThresholdPercentage: new Prisma.Decimal(35),
        rankEnabled: true,
        status: "ACTIVE",
        createdByUserId: principal.id,
        activatedByUserId: principal.id,
        activatedAt,
        frozenAt: activatedAt,
        marksEntryOpenedAt: activatedAt,
        components: {
          create: [
            {
              componentCode: "WRITTEN",
              name: "Written",
              componentKind: "WRITTEN",
              displayOrder: 1,
              maximumMarks: new Prisma.Decimal(80),
              isRequired: true
            },
            {
              componentCode: "INTERNAL",
              name: "Internal",
              componentKind: "INTERNAL",
              displayOrder: 2,
              maximumMarks: new Prisma.Decimal(20),
              isRequired: true
            }
          ]
        }
      },
      include: { components: true }
    });
    const weightedScheme = await client.examinationSchemeVersion.create({
      data: {
        examinationId: examination.id,
        classScopeId: classScope.id,
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        scopeKey: `SUBJECT:${papers[1].id}`,
        subjectPaperId: papers[1].id,
        versionNumber: 1,
        calculationMode: "WEIGHTED_NORMALIZED",
        markDecimalPlaces: 2,
        status: "ACTIVE",
        createdByUserId: principal.id,
        activatedByUserId: principal.id,
        activatedAt,
        frozenAt: activatedAt,
        marksEntryOpenedAt: activatedAt,
        components: {
          create: [
            {
              componentCode: "THEORY",
              name: "Theory",
              componentKind: "WRITTEN",
              displayOrder: 1,
              maximumMarks: new Prisma.Decimal(70),
              contributionWeight: new Prisma.Decimal(70),
              isRequired: true
            },
            {
              componentCode: "PRACTICAL",
              name: "Practical",
              componentKind: "PRACTICAL",
              displayOrder: 2,
              maximumMarks: new Prisma.Decimal(30),
              contributionWeight: new Prisma.Decimal(30),
              isRequired: true
            }
          ]
        }
      },
      include: { components: true }
    });
    await client.examSubjectGroup.create({
      data: {
        examinationId: examination.id,
        classScopeId: classScope.id,
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        groupCode: "SCI_SOC",
        groupName: "Science and Social",
        calculationMode: "WEIGHTED_NORMALIZED",
        displayOrder: 1,
        status: "ACTIVE",
        createdByUserId: principal.id,
        members: {
          create: [
            { subjectPaperId: papers[1].id, displayOrder: 1, contributionWeight: new Prisma.Decimal(50) },
            { subjectPaperId: papers[2].id, displayOrder: 2, contributionWeight: new Prisma.Decimal(50) }
          ]
        }
      }
    });
    await client.gradeScaleVersion.create({
      data: {
        examinationId: examination.id,
        classScopeId: classScope.id,
        academicYear: "2026-27",
        className: "EXAM2A",
        section: "QA",
        name: "EXAM2 Grade Scale",
        scaleFamily: "PERCENTAGE",
        versionNumber: 1,
        status: "ACTIVE",
        activatedByUserId: principal.id,
        activatedAt,
        frozenAt: activatedAt,
        createdByUserId: principal.id,
        bands: {
          create: [
            { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1, gradePoint: 4 },
            { gradeCode: "B", label: "Secure", minimumPercentage: 60, maximumPercentage: 79.99, displayOrder: 2, gradePoint: 3 },
            { gradeCode: "C", label: "Developing", minimumPercentage: 35, maximumPercentage: 59.99, displayOrder: 3, gradePoint: 2 },
            { gradeCode: "D", label: "Below threshold", minimumPercentage: 0, maximumPercentage: 34.99, displayOrder: 4, gradePoint: 1 }
          ]
        }
      }
    });

    const assignmentRows: Array<{
      paper: typeof papers[number];
      component: typeof rawScheme.components[number] | typeof weightedScheme.components[number];
      schemeId: string;
      owner: typeof teacherOne;
      role: string;
    }> = [];
    for (const component of rawScheme.components) {
      assignmentRows.push({ paper: papers[0], component, schemeId: rawScheme.id, owner: teacherOne, role: "PRIMARY_SUBMITTER" });
      assignmentRows.push({ paper: papers[2], component, schemeId: rawScheme.id, owner: teacherTwo, role: "PRIMARY_SUBMITTER" });
    }
    assignmentRows.push({
      paper: papers[0],
      component: rawScheme.components[0],
      schemeId: rawScheme.id,
      owner: teacherTwo,
      role: "CONTRIBUTOR"
    });
    for (const component of weightedScheme.components) {
      assignmentRows.push({ paper: papers[1], component, schemeId: weightedScheme.id, owner: teacherOne, role: "PRIMARY_SUBMITTER" });
    }
    for (const row of assignmentRows) {
      await client.teacherExamAssignment.create({
        data: {
          examinationId: examination.id,
          classScopeId: classScope.id,
          timetableClassSectionId: classA.id,
          subjectPaperId: row.paper.id,
          schemeVersionId: row.schemeId,
          componentId: row.component.id,
          academicYear: "2026-27",
          className: "EXAM2A",
          section: "QA",
          staffMemberId: row.owner.staff.id,
          timetableTeacherId: row.owner.timetableTeacher.id,
          timetableAssignmentId: timetableAssignments.get(`${row.paper.timetableSubjectId}:${row.owner.timetableTeacher.id}`)!,
          assignmentRole: row.role,
          status: "ACTIVE",
          assignmentReason: "EXAM2 synthetic exact-scope verification.",
          assignedByUserId: principal.id
        }
      });
    }

    const students = [];
    for (let index = 1; index <= 4; index += 1) {
      const student = await client.student.create({
        data: {
          academicYear: "2026-27",
          admissionNo: `EXAM2-${String(index).padStart(3, "0")}`,
          studentName: `EXAM2 Student ${index}`,
          fatherName: "EXAM2 Synthetic Parent",
          className: "EXAM2A",
          section: "QA",
          rollNo: String(index),
          phone1: "0000000000",
          status: "Active",
          remarks: "EXAM2 synthetic fixture"
        }
      });
      await client.academicYearEnrollment.create({
        data: {
          studentId: student.id,
          academicYear: "2026-27",
          className: "EXAM2A",
          section: "QA",
          rollNo: String(index),
          status: "ACTIVE"
        }
      });
      students.push(student);
    }
    for (const [day, date] of ["2026-09-02", "2026-09-03"].entries()) {
      await client.studentAttendanceSession.create({
        data: {
          attendanceDate: new Date(`${date}T00:00:00.000Z`),
          className: "EXAM2A",
          section: "QA",
          academicYear: "2026-27",
          status: "LOCKED",
          takenByUserId: principal.id,
          submittedByUserId: principal.id,
          lockedByUserId: principal.id,
          submittedAt: activatedAt,
          lockedAt: activatedAt,
          notes: "EXAM2 locked attendance reference",
          records: {
            create: students.map((student, index) => ({
              studentId: student.id,
              admissionNo: student.admissionNo,
              status: day === 1 && index === 1 ? "ABSENT" : "PRESENT"
            }))
          }
        }
      });
    }

    const state: QaState = {
      databasePath,
      sourceHash,
      examinationId: examination.id,
      classScopeId: classScope.id,
      principalUsername: principal.username,
      teacherOneUsername: teacherOne.user.username,
      teacherTwoUsername: teacherTwo.user.username,
      password: PASSWORD
    };
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log("EXAM2 copied-database fixture prepared: students=4 teachers=2 primaryAssignments=6 contributorAssignments=1.");
    console.log("Browser credentials are stored only in the ignored private QA state file.");
  } catch (error) {
    cleanupIsolatedDatabase(databasePath);
    removeState();
    throw error;
  } finally {
    await client.$disconnect();
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM2_PREPARE");
}

async function exercise() {
  const state = readState();
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [principalUser, teacherOneUser, teacherTwoUser, students] = await Promise.all([
      client.user.findUniqueOrThrow({ where: { username: state.principalUsername } }),
      client.user.findUniqueOrThrow({ where: { username: state.teacherOneUsername } }),
      client.user.findUniqueOrThrow({ where: { username: state.teacherTwoUsername } }),
      client.student.findMany({ where: { admissionNo: { startsWith: "EXAM2-" } }, orderBy: { admissionNo: "asc" } })
    ]);
    const principal = actor(principalUser);
    const teacherOne = actor(teacherOneUser);
    const teacherTwo = actor(teacherTwoUser);
    const [oneWorkspace, twoWorkspace] = await Promise.all([
      loadTeacherMarksWorkspace(client, teacherOne),
      loadTeacherMarksWorkspace(client, teacherTwo)
    ]);
    if (oneWorkspace.assignments.length !== 4 || twoWorkspace.assignments.length !== 3) {
      throw new Error("EXAM2_EXACT_ASSIGNMENT_COUNTS_FAILED");
    }
    const assignments = [...oneWorkspace.assignments, ...twoWorkspace.assignments];
    const by = (paperCode: string, componentCode: string, role = "PRIMARY_SUBMITTER") =>
      assignments.find((row) => row.paper.code === paperCode && row.component.code === componentCode && row.role === role);
    const contributor = by("MATH", "WRITTEN", "CONTRIBUTOR");
    if (!contributor) throw new Error("EXAM2_CONTRIBUTOR_MISSING");

    const contributorSave = await saveAssignedMarkDraft(client, contributor.id, {
      requestKey: "EXAM2:CONTRIBUTOR:SAVE:0001",
      rows: students.map((student, index) => ({
        studentId: student.id,
        entryState: index === 0 ? "PRESENT" : index === 1 ? "ABSENT" : index === 2 ? "EXEMPT" : "NOT_APPLICABLE",
        marksObtained: index === 0 ? 0 : null,
        expectedRowVersion: 1
      }))
    }, teacherTwo);
    if (contributorSave.status !== "READY_TO_SUBMIT") throw new Error("EXAM2_CONTRIBUTOR_SAVE_FAILED");

    let contributorSubmitDenied = false;
    try {
      await submitAssignedMarkSheet(client, contributor.id, {
        requestKey: "EXAM2:CONTRIBUTOR:SUBMIT:0001",
        expectedSheetVersion: contributorSave.sheetVersion,
        expectedOptimisticVersion: contributorSave.optimisticVersion
      }, teacherTwo);
    } catch {
      contributorSubmitDenied = true;
    }
    if (!contributorSubmitDenied) throw new Error("EXAM2_CONTRIBUTOR_SUBMIT_NOT_DENIED");

    let unauthorizedDenied = false;
    const socialPrimary = by("SOC", "WRITTEN");
    if (!socialPrimary) throw new Error("EXAM2_SOCIAL_PRIMARY_MISSING");
    try {
      await requireExactExamMarkAssignment(client, teacherOne, socialPrimary.id);
    } catch {
      unauthorizedDenied = true;
    }
    if (!unauthorizedDenied) throw new Error("EXAM2_CROSS_TEACHER_SCOPE_NOT_DENIED");

    const primaryAssignments = new Map<string, { assignment: any; actor: Actor }>();
    for (const row of oneWorkspace.assignments.filter((item: any) => item.role === "PRIMARY_SUBMITTER")) {
      primaryAssignments.set(`${row.paper.code}:${row.component.code}`, { assignment: row, actor: teacherOne });
    }
    for (const row of twoWorkspace.assignments.filter((item: any) => item.role === "PRIMARY_SUBMITTER")) {
      primaryAssignments.set(`${row.paper.code}:${row.component.code}`, { assignment: row, actor: teacherTwo });
    }
    for (const [key, item] of primaryAssignments) {
      const current = await loadTeacherMarksWorkspace(client, item.actor, item.assignment.id);
      if (!current.selectedWorkspace) throw new Error(`EXAM2_WORKSPACE_MISSING:${key}`);
      const component = current.selectedWorkspace.components.find((row: any) => row.assignment.id === item.assignment.id);
      if (!component) throw new Error(`EXAM2_COMPONENT_WORKSPACE_MISSING:${key}`);
      const isSpecial = key === "MATH:WRITTEN";
      const saved = await saveAssignedMarkDraft(client, item.assignment.id, {
        requestKey: `EXAM2:PRIMARY:SAVE:${key.replace(":", "-")}:0001`,
        expectedSheetVersion: component.sheet?.version,
        expectedVersionNumber: component.sheet?.versionNumber,
        expectedOptimisticVersion: component.sheet?.optimisticVersion,
        rows: component.entries.map((entry: any, index: number) => ({
          studentId: entry.studentId,
          entryState: isSpecial
            ? index === 0 ? "PRESENT" : index === 1 ? "ABSENT" : index === 2 ? "EXEMPT" : "NOT_APPLICABLE"
            : "PRESENT",
          marksObtained: isSpecial ? index === 0 ? 0 : null : Math.max(1, Number(item.assignment.component.maximumMarks) - index * 5),
          expectedRowVersion: entry.rowVersion
        }))
      }, item.actor);
      if (saved.status !== "READY_TO_SUBMIT") throw new Error(`EXAM2_DRAFT_NOT_READY:${key}`);
      const submitted = await submitAssignedMarkSheet(client, item.assignment.id, {
        requestKey: `EXAM2:PRIMARY:SUBMIT:${key.replace(":", "-")}:0001`,
        expectedSheetVersion: saved.sheetVersion,
        expectedOptimisticVersion: saved.optimisticVersion
      }, item.actor);
      if (!submitted.submitted) throw new Error(`EXAM2_SUBMIT_FAILED:${key}`);
    }

    const mathWritten = primaryAssignments.get("MATH:WRITTEN")!;
    const currentMath = await loadTeacherMarksWorkspace(client, mathWritten.actor, mathWritten.assignment.id);
    if (!currentMath.selectedWorkspace) throw new Error("EXAM2_MATH_WORKSPACE_MISSING");
    const currentComponent = currentMath.selectedWorkspace.components.find((row: any) => row.assignment.id === mathWritten.assignment.id);
    if (!currentComponent) throw new Error("EXAM2_MATH_COMPONENT_MISSING");
    let staleConflict = false;
    try {
      await saveAssignedMarkDraft(client, mathWritten.assignment.id, {
        requestKey: "EXAM2:STALE:CONFLICT:0001",
        expectedSheetVersion: 1,
        expectedVersionNumber: 1,
        expectedOptimisticVersion: 1,
        rows: [{
          ...currentComponent.entries[0],
          expectedRowVersion: currentComponent.entries[0].rowVersion
        }]
      }, mathWritten.actor);
    } catch {
      staleConflict = true;
    }
    if (!staleConflict) throw new Error("EXAM2_STALE_CONFLICT_NOT_REJECTED");

    const correction = await requestMarkCorrection(client, mathWritten.assignment.id, {
      requestKey: "EXAM2:CORRECTION:REQUEST:0001",
      reason: "Correct the synthetic zero after governed review."
    }, teacherOne);
    const reopened = await reviewMarkCorrection(client, correction.requestId, {
      action: "reopen",
      requestKey: "EXAM2:CORRECTION:REOPEN:0001",
      expectedSheetVersion: correction.sheetVersion,
      reason: "Synthetic correction approved for copied-database QA."
    }, principal);
    console.log(`EXAM2 correction checkpoint: request=${correction.status} review=${reopened.status} version=${reopened.versionNumber}.`);
    if (reopened.versionNumber !== 2) throw new Error("EXAM2_REOPEN_VERSION_FAILED");
    const reopenedWorkspace = await loadTeacherMarksWorkspace(client, teacherOne, mathWritten.assignment.id);
    if (!reopenedWorkspace.selectedWorkspace) throw new Error("EXAM2_REOPENED_WORKSPACE_MISSING");
    const reopenedComponent = reopenedWorkspace.selectedWorkspace.components.find((row: any) => row.assignment.id === mathWritten.assignment.id);
    if (!reopenedComponent?.sheet) throw new Error("EXAM2_REOPENED_COMPONENT_MISSING");
    const corrected = await saveAssignedMarkDraft(client, mathWritten.assignment.id, {
      requestKey: "EXAM2:CORRECTION:SAVE:0001",
      expectedSheetVersion: reopenedComponent.sheet.version,
      expectedVersionNumber: 2,
      expectedOptimisticVersion: reopenedComponent.sheet.optimisticVersion,
      rows: [{
        ...reopenedComponent.entries[0],
        entryState: "PRESENT",
        marksObtained: 5,
        expectedRowVersion: reopenedComponent.entries[0].rowVersion
      }]
    }, teacherOne);
    await submitAssignedMarkSheet(client, mathWritten.assignment.id, {
      requestKey: "EXAM2:CORRECTION:RESUBMIT:0001",
      expectedSheetVersion: corrected.sheetVersion,
      expectedOptimisticVersion: corrected.optimisticVersion
    }, teacherOne);

    const currentSheets = await client.examMarkSheet.findMany({
      where: { examinationId: state.examinationId, currentKey: { not: null } }
    });
    for (const sheet of currentSheets) {
      if (!["SUBMITTED", "RESUBMITTED"].includes(sheet.status)) continue;
      await moderateMarkSheet(client, sheet.id, {
        requestKey: `EXAM2:MODERATE:${sheet.id}:0001`,
        expectedSheetVersion: sheet.optimisticVersion,
        reason: "EXAM2 synthetic moderation verification."
      }, principal);
    }
    const preview = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2:CALCULATION:PREVIEW:0001"
    }, principal);
    if (preview.snapshots.length !== 4 || !preview.snapshots.every((row: any) => row.details.groups.length === 1)) {
      throw new Error("EXAM2_CALCULATION_OR_GROUP_FAILED");
    }
    const rerun = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2:CALCULATION:PREVIEW:0002"
    }, principal);
    if (!rerun.idempotent || rerun.id !== preview.id) throw new Error("EXAM2_CALCULATION_IDEMPOTENCY_FAILED");
    const locked = await lockExaminationCalculation(client, preview.id, {
      requestKey: "EXAM2:CALCULATION:LOCK:0001",
      reason: "EXAM2 synthetic lock verification."
    }, principal);
    if (locked.status !== "LOCKED") throw new Error("EXAM2_CALCULATION_LOCK_FAILED");
    const lockedRerun = await runExaminationCalculationPreview(client, {
      examinationId: state.examinationId,
      classScopeId: state.classScopeId,
      requestKey: "EXAM2:CALCULATION:PREVIEW:AFTER_LOCK:0001"
    }, principal);
    const snapshotCount = await client.studentResultSnapshot.count({
      where: { examinationId: state.examinationId, classScopeId: state.classScopeId }
    });
    if (!lockedRerun.idempotent || lockedRerun.id !== preview.id || lockedRerun.status !== "LOCKED" || snapshotCount !== 4) {
      throw new Error("EXAM2_LOCKED_CALCULATION_IDEMPOTENCY_FAILED");
    }
    console.log("EXAM2 lifecycle exercise passed: contributor save, primary submit, correction v2, moderation, raw/weighted/group calculation, pre/post-lock idempotent preview and lock.");
  } finally {
    await client.$disconnect();
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM2_EXERCISE");
}

async function inspect() {
  const state = readState();
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [baseline, students, enrollments, sheets, snapshots, audits, migrationCount] = await Promise.all([
      businessBaseline(state.databasePath),
      client.student.count({ where: { admissionNo: { startsWith: "EXAM2-" } } }),
      client.academicYearEnrollment.count({ where: { student: { admissionNo: { startsWith: "EXAM2-" } } } }),
      client.examMarkSheet.findMany({ where: { examinationId: state.examinationId }, include: { entries: true } }),
      client.studentResultSnapshot.findMany({ where: { examinationId: state.examinationId } }),
      client.examinationSchemeAudit.findMany({ where: { examinationId: state.examinationId, eventKey: { not: null } } }),
      client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    ]);
    if (students !== 4 || enrollments !== 4 || migrationCount[0]?.count !== 3n) throw new Error("EXAM2_FIXTURE_INVARIANTS_FAILED");
    if (snapshots.length) {
      const versions = sheets.filter((sheet) => sheet.logicalSheetKey === sheets.find((row) => row.versionNumber === 2)?.logicalSheetKey);
      const oldZero = versions.find((sheet) => sheet.versionNumber === 1)?.entries.some((entry) =>
        entry.entryState === "PRESENT" && entry.marksObtained?.equals(0)
      );
      const newFive = versions.find((sheet) => sheet.versionNumber === 2)?.entries.some((entry) =>
        entry.entryState === "PRESENT" && entry.marksObtained?.equals(5)
      );
      if (!oldZero || !newFive || snapshots.length !== 4 || audits.length < 15) {
        throw new Error("EXAM2_IMMUTABLE_HISTORY_INVARIANTS_FAILED");
      }
    }
    if (baseline.payments !== 0 || baseline.collected !== 0) throw new Error("EXAM2_PAYMENT_BASELINE_CHANGED");
    if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM2_INSPECT");
    console.log(`EXAM2 inspection passed: students=${students} enrollments=${enrollments} sheetVersions=${sheets.length} snapshots=${snapshots.length} audits=${audits.length}.`);
    console.log("Operational source hash unchanged; EXAM2 data exists only in the isolated copied database.");
  } finally {
    await client.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_BEFORE_EXAM2_CLEANUP");
  cleanupIsolatedDatabase(state.databasePath);
  removeState();
  console.log("EXAM2 copied database and private Browser state removed.");
}

const action = process.argv.slice(2).find((value) => value !== "--") ?? "inspect";
const runner = action === "prepare"
  ? prepare
  : action === "exercise"
    ? exercise
    : action === "inspect"
      ? inspect
      : action === "cleanup"
        ? cleanup
        : null;
if (!runner) {
  console.error("Usage: pnpm.cmd qa:exam2 -- prepare|exercise|inspect|cleanup");
  process.exitCode = 1;
} else {
  runner().catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : "EXAM2 QA failed");
    process.exitCode = 1;
  });
}
