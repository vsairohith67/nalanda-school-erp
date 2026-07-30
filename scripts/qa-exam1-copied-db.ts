import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import {
  ExamConfigurationError,
  activateSchemeVersion,
  createCoScholasticSchemeVersion,
  createExaminationConfiguration,
  createGradeScaleVersion,
  createSchemeVersion,
  createSubjectGroup,
  createSubjectPaper,
  createTeacherExamAssignment,
  createTemplateFamilyBinding,
  listTeacherExamAssignments
} from "../lib/exam-configurations";
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

const STATE_PATH = path.join(QA_ROOT, "reports", "EXAM1-browser-state.json");
const PRINCIPAL_USERNAME = "exam1-principal";
const TEACHER_USERNAME = "exam1-teacher";
const PRINCIPAL_PASSWORD = "EXAM1-local-only-Principal-2026!";
const TEACHER_PASSWORD = "EXAM1-local-only-Teacher-2026!";

type QaState = {
  databasePath: string;
  sourceHash: string;
  examinationId: string;
  principalUsername: string;
  principalPassword: string;
  teacherUsername: string;
  teacherPassword: string;
};

function readState() {
  if (!existsSync(STATE_PATH)) throw new Error("EXAM1_QA_STATE_MISSING");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  state.databasePath = assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function removeState() {
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
}

async function prepare() {
  if (existsSync(STATE_PATH)) {
    const previous = readState();
    cleanupIsolatedDatabase(previous.databasePath);
    removeState();
  }
  const sourceHash = fileSha256(OPERATIONAL_DATABASE);
  const databasePath = createEmptyIsolatedDatabase("operational-copy", "EXAM1-browser");
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  if (fileSha256(databasePath) !== sourceHash) throw new Error("EXAM1_COPY_HASH_MISMATCH");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], databasePath);
  const status = runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"], databasePath);
  if (!/database schema is up to date/i.test(status.combined)) throw new Error("EXAM1_MIGRATION_STATUS_NOT_CLEAN");

  const client = new PrismaClient({ datasourceUrl: databaseUrl(databasePath) });
  try {
    const [principalPasswordHash, teacherPasswordHash] = await Promise.all([
      hashPassword(PRINCIPAL_PASSWORD),
      hashPassword(TEACHER_PASSWORD)
    ]);
    const principal = await client.user.create({
      data: {
        name: "EXAM1 Principal",
        username: PRINCIPAL_USERNAME,
        passwordHash: principalPasswordHash,
        role: "PRINCIPAL",
        isActive: true
      }
    });
    const teacherUser = await client.user.create({
      data: {
        name: "EXAM1 Teacher",
        username: TEACHER_USERNAME,
        passwordHash: teacherPasswordHash,
        role: "TEACHER",
        isActive: true
      }
    });
    const timetableTeacher = await client.timetableTeacher.create({
      data: {
        name: "EXAM1 Teacher",
        shortName: "EXAM1-T",
        department: "EXAM1 Synthetic",
        maxPeriodsPerWeek: 30,
        maxPeriodsPerDay: 8,
        isActive: true
      }
    });
    const staff = await client.staffMember.create({
      data: {
        staffCode: "EXAM1-T01",
        fullName: "EXAM1 Teacher",
        displayName: "EXAM1 Teacher",
        staffType: "TEACHING",
        designation: "Synthetic Subject Teacher",
        department: "EXAM1 Synthetic",
        status: "ACTIVE",
        userId: teacherUser.id,
        timetableTeacherId: timetableTeacher.id
      }
    });
    const classSection = await client.timetableClassSection.create({
      data: {
        academicYear: "2026-27",
        className: "EXAM1",
        section: "QA",
        displayName: "EXAM1 - QA",
        groupName: "EXAM1 SYNTHETIC",
        isActive: true
      }
    });
    const mathematics = await client.timetableSubject.create({
      data: { name: "EXAM1 Mathematics", shortName: "EXAM1-MATH", department: "EXAM1 Synthetic", isActive: true }
    });
    const science = await client.timetableSubject.create({
      data: { name: "EXAM1 Science", shortName: "EXAM1-SCI", department: "EXAM1 Synthetic", isActive: true }
    });
    for (const subject of [mathematics, science]) {
      await client.timetableAssignment.create({
        data: {
          academicYear: "2026-27",
          classSectionId: classSection.id,
          subjectId: subject.id,
          teacherId: timetableTeacher.id,
          periodsPerWeek: 5,
          notes: "EXAM1 synthetic exact-scope fixture"
        }
      });
    }

    const principalActor = {
      id: principal.id,
      name: principal.name,
      username: principal.username,
      email: null,
      guardianId: null,
      role: "PRINCIPAL" as const
    };
    await createExaminationConfiguration(client, {
      examCode: "EXAM1",
      academicYear: "2026-27",
      name: "EXAM1 Foundation Verification",
      examType: "TERM",
      startDate: "2026-09-01",
      endDate: "2026-09-12",
      description: "Synthetic copied-database configuration for EXAM-RC-IMPL-1.",
      classSectionIds: [classSection.id]
    }, principalActor);
    const examination = await client.examination.findUniqueOrThrow({
      where: { examCode: "EXAM1" },
      include: { classScopes: true }
    });
    const classScopeId = examination.classScopes[0]?.id;
    if (!classScopeId) throw new Error("EXAM1_CLASS_SCOPE_MISSING");
    const mathPaper = await createSubjectPaper(client, examination.id, {
      classScopeId,
      timetableSubjectId: mathematics.id,
      paperCode: "MATH",
      paperName: "Mathematics",
      displayOrder: 1
    }, principalActor);
    const sciencePaper = await createSubjectPaper(client, examination.id, {
      classScopeId,
      timetableSubjectId: science.id,
      paperCode: "SCI",
      paperName: "Science",
      displayOrder: 2
    }, principalActor);
    await createSubjectGroup(client, examination.id, {
      classScopeId,
      groupCode: "CORE",
      groupName: "Core Subjects",
      calculationMode: "RAW_SUM",
      displayOrder: 1,
      members: [
        { subjectPaperId: mathPaper.id },
        { subjectPaperId: sciencePaper.id }
      ]
    }, principalActor);
    const scheme = await createSchemeVersion(client, examination.id, {
      classScopeId,
      calculationMode: "WEIGHTED_NORMALIZED",
      components: [
        {
          componentCode: "THEORY",
          name: "Theory",
          componentKind: "WRITTEN",
          displayOrder: 1,
          maximumMarks: 80,
          contributionWeight: 80,
          isRequired: true
        },
        {
          componentCode: "INTERNAL",
          name: "Internal Assessment",
          componentKind: "INTERNAL",
          displayOrder: 2,
          maximumMarks: 20,
          contributionWeight: 20,
          isRequired: true
        }
      ]
    }, principalActor);
    await createGradeScaleVersion(client, examination.id, {
      classScopeId,
      name: "EXAM1 Grade Scale",
      scaleFamily: "PERCENTAGE",
      bands: [
        { gradeCode: "A", label: "Excellent", minimumPercentage: 80, maximumPercentage: 100, displayOrder: 1 },
        { gradeCode: "B", label: "Good", minimumPercentage: 60, maximumPercentage: 79.9999, displayOrder: 2 },
        { gradeCode: "C", label: "Developing", minimumPercentage: 0, maximumPercentage: 59.9999, displayOrder: 3 }
      ]
    }, principalActor);
    await createCoScholasticSchemeVersion(client, examination.id, {
      classScopeId,
      name: "EXAM1 Co-Scholastic",
      schemeFamily: "RATING",
      ratingScale: ["A", "B", "C"],
      items: ["Work Education", "Art Education", "Health and Physical Education"]
    }, principalActor);
    await createTemplateFamilyBinding(client, examination.id, {
      classScopeId,
      templateFamily: "SECONDARY_10_40_GROUPED"
    }, principalActor);

    for (const paper of [mathPaper, sciencePaper]) {
      for (const component of scheme.components) {
        await createTeacherExamAssignment(client, examination.id, {
          classScopeId,
          subjectPaperId: paper.id,
          componentId: component.id,
          staffMemberId: staff.id,
          assignmentRole: "PRIMARY_SUBMITTER",
          assignmentReason: "EXAM1 exact timetable ownership verification."
        }, principalActor);
      }
    }
    let overlapRejected = false;
    try {
      await createTeacherExamAssignment(client, examination.id, {
        classScopeId,
        subjectPaperId: mathPaper.id,
        componentId: scheme.components[0].id,
        staffMemberId: staff.id,
        assignmentRole: "PRIMARY_SUBMITTER",
        assignmentReason: "EXAM1 negative overlap probe."
      }, principalActor);
    } catch (error) {
      overlapRejected = error instanceof ExamConfigurationError && /primary submitter/i.test(error.message);
    }
    if (!overlapRejected) throw new Error("EXAM1_OVERLAPPING_PRIMARY_NOT_REJECTED");

    await activateSchemeVersion(client, examination.id, {
      schemeVersionId: scheme.id,
      expectedVersion: scheme.version,
      activationReason: "EXAM1 copied-database activation and freeze verification."
    }, principalActor);
    await createSchemeVersion(client, examination.id, {
      classScopeId,
      cloneSourceId: scheme.id
    }, principalActor);

    const state: QaState = {
      databasePath,
      sourceHash,
      examinationId: examination.id,
      principalUsername: PRINCIPAL_USERNAME,
      principalPassword: PRINCIPAL_PASSWORD,
      teacherUsername: TEACHER_USERNAME,
      teacherPassword: TEACHER_PASSWORD
    };
    writeFileSync(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    console.log("EXAM1 copied-database fixture prepared: activeScheme=1 draftClone=1 assignments=4.");
    console.log("Browser credentials are stored only in the ignored private QA state file.");
  } catch (error) {
    cleanupIsolatedDatabase(databasePath);
    removeState();
    throw error;
  } finally {
    await client.$disconnect();
  }
  if (fileSha256(OPERATIONAL_DATABASE) !== sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM1_PREPARE");
}

async function inspect() {
  const state = readState();
  const client = new PrismaClient({ datasourceUrl: databaseUrl(state.databasePath) });
  try {
    const [baseline, examination, teacherAssignments, students, payments, staff, migrations] = await Promise.all([
      businessBaseline(state.databasePath),
      client.examination.findUniqueOrThrow({
        where: { id: state.examinationId },
        include: {
          schemeVersions: { include: { components: true } },
          subjectPapers: true,
          subjectGroups: { include: { members: true } },
          gradeScaleVersions: { include: { bands: true } },
          coScholasticSchemeVersions: { include: { items: true } },
          templateBindings: true,
          teacherAssignments: true,
          schemeAudits: true
        }
      }),
      listTeacherExamAssignments(client, { id: (await client.user.findUniqueOrThrow({ where: { username: TEACHER_USERNAME } })).id, role: "TEACHER" }),
      client.student.count(),
      client.payment.count(),
      client.staffMember.count(),
      client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL`
    ]);
    const active = examination.schemeVersions.filter((row) => row.status === "ACTIVE");
    const drafts = examination.schemeVersions.filter((row) => row.status === "DRAFT");
    if (
      active.length !== 1 ||
      !active[0].frozenAt ||
      drafts.length !== 1 ||
      drafts[0].versionNumber !== 2 ||
      examination.subjectPapers.length !== 2 ||
      examination.subjectGroups.length !== 1 ||
      examination.subjectGroups[0].members.length !== 2 ||
      examination.gradeScaleVersions.filter((row) => row.status === "ACTIVE").length !== 1 ||
      examination.coScholasticSchemeVersions.filter((row) => row.status === "ACTIVE").length !== 1 ||
      examination.templateBindings.filter((row) => row.status === "ACTIVE").length !== 1 ||
      examination.teacherAssignments.length !== 4 ||
      teacherAssignments.length !== 4 ||
      examination.schemeAudits.length < 14 ||
      migrations[0]?.count !== 2n
    ) {
      throw new Error("EXAM1_CONFIGURATION_INVARIANTS_FAILED");
    }
    if (baseline.students !== 0 || baseline.activeEnrollments !== 0 || baseline.payments !== 0 || baseline.collected !== 0 || students !== 0 || payments !== 0) {
      throw new Error("EXAM1_BUSINESS_BASELINE_CHANGED");
    }
    if (staff !== 1) throw new Error("EXAM1_SYNTHETIC_STAFF_COUNT_INVALID");
    if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_DURING_EXAM1_QA");
    console.log("EXAM1 copied-database inspection passed: schemes=2 active=1 frozen=1 papers=2 groups=1 assignments=4 audits>=14.");
    console.log("EXAM1 baseline passed: students=0 activeEnrollments=0 payments=0 collected=0; operational hash unchanged.");
  } finally {
    await client.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  if (fileSha256(OPERATIONAL_DATABASE) !== state.sourceHash) throw new Error("OPERATIONAL_DATABASE_CHANGED_BEFORE_EXAM1_CLEANUP");
  cleanupIsolatedDatabase(state.databasePath);
  removeState();
  console.log("EXAM1 copied database and private Browser state removed.");
}

const action = process.argv.slice(2).find((value) => value !== "--") ?? "inspect";
const runner = action === "prepare" ? prepare : action === "inspect" ? inspect : action === "cleanup" ? cleanup : null;
if (!runner) {
  console.error("Usage: pnpm.cmd qa:exam1 -- prepare|inspect|cleanup");
  process.exitCode = 1;
} else {
  runner().catch((error) => {
    console.error(error instanceof Error ? error.message : "EXAM1 QA failed");
    process.exitCode = 1;
  });
}
