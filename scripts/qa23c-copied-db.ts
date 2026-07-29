import { createHash, randomBytes } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password";
import { hasRolePermission } from "../lib/role-permissions";
import {
  AttendanceScopeError,
  attendanceScopeWhere,
  requireAttendanceTarget,
  resolveTeacherAttendanceScope
} from "../lib/teacher-attendance-scope";
import {
  OPERATIONAL_DATABASE,
  QA_ROOT,
  assertIsolatedDatabasePath,
  cleanupIsolatedDatabase,
  databaseUrl,
  ensureQaRoot
} from "./migration-isolation";

const PREFIX = "qa23c-";
const LABEL = "QA23C";
const ACADEMIC_YEAR = "2026-27";
const PREVIOUS_ACADEMIC_YEAR = "2025-26";
const PRIMARY_DATE = new Date("2026-07-29T00:00:00.000Z");
const SUBSTITUTE_DATE = PRIMARY_DATE;
const OUTSIDE_SUBSTITUTE_DATE = new Date("2026-07-30T00:00:00.000Z");
const CLASS_A = "QA23C-VI";
const CLASS_B = "QA23C-VII";
const CLASS_SUBSTITUTE = "QA23C-VIII";
const CLASS_PREVIOUS = "QA23C-IX";
const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", "QA23C-browser.db");
const STATE_PATH = path.join(QA_ROOT, "operational-copy", "QA23C-state.json");

const USERS = {
  teacherA: { id: `${PREFIX}teacher-a`, name: `${LABEL} Teacher A`, username: `${PREFIX}teacher-a`, role: "TEACHER" },
  teacherB: { id: `${PREFIX}teacher-b`, name: `${LABEL} Teacher B`, username: `${PREFIX}teacher-b`, role: "TEACHER" },
  unlinked: { id: `${PREFIX}teacher-unlinked`, name: `${LABEL} Unlinked Teacher`, username: `${PREFIX}teacher-unlinked`, role: "TEACHER" },
  director: { id: `${PREFIX}director`, name: `${LABEL} Director`, username: `${PREFIX}director`, role: "DIRECTOR" },
  principal: { id: `${PREFIX}principal`, name: `${LABEL} Principal`, username: `${PREFIX}principal`, role: "PRINCIPAL" },
  parent: { id: `${PREFIX}parent`, name: `${LABEL} Parent`, username: `${PREFIX}parent`, role: "PARENT" },
  accountant: { id: `${PREFIX}accountant`, name: `${LABEL} Accountant`, username: `${PREFIX}accountant`, role: "ACCOUNTANT" },
  viewer: { id: `${PREFIX}viewer`, name: `${LABEL} Viewer`, username: `${PREFIX}viewer`, role: "VIEWER" }
} as const;

const ATTENDANCE_PERMISSIONS = [
  "VIEW_STUDENT_ATTENDANCE",
  "MANAGE_STUDENT_ATTENDANCE",
  "SUBMIT_STUDENT_ATTENDANCE",
  "VIEW_STUDENT_ATTENDANCE_REPORTS"
] as const;

type SavedRolePermission = {
  role: string;
  permission: string;
  previous: null | { id: string; enabled: boolean; updatedAt: string };
};

type QaState = {
  databasePath: string;
  databaseUrl: string;
  operationalHash: string;
  baselineLogicalDigest: string;
  browserAccessValue: string;
  rolePermissions: SavedRolePermission[];
};

async function main() {
  const action = String(process.argv[2] ?? "").toLowerCase();
  if (action === "prepare") return prepare();
  if (action === "verify") return verify();
  if (action === "inspect") return inspect();
  if (action === "operational-check") return operationalCheck();
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, verify, inspect, operational-check, cleanup, or destroy");
}

function client(databasePath: string) {
  return new PrismaClient({
    datasources: { db: { url: databaseUrl(databasePath) } }
  });
}

async function prepare() {
  ensureQaRoot();
  const databasePath = assertIsolatedDatabasePath(DATABASE_PATH);
  if (existsSync(databasePath)) cleanupIsolatedDatabase(databasePath);
  if (existsSync(STATE_PATH)) rmSync(STATE_PATH, { force: true });
  const operationalHash = fileHash(OPERATIONAL_DATABASE);
  copyFileSync(OPERATIONAL_DATABASE, databasePath);
  const prisma = client(databasePath);
  try {
    const baselineLogicalDigest = await logicalDatabaseDigest(prisma);
    const browserAccessValue = `${randomBytes(24).toString("base64url")}!Aa9`;
    const passwordHash = await hashPassword(browserAccessValue);
    for (const user of Object.values(USERS)) {
      await prisma.user.create({ data: { ...user, passwordHash, isActive: true } });
    }

    const rolePermissions: SavedRolePermission[] = [];
    for (const permission of ATTENDANCE_PERMISSIONS) {
      const previous = await prisma.rolePermission.findUnique({
        where: { role_permission: { role: "TEACHER", permission } },
        select: { id: true, enabled: true, updatedAt: true }
      });
      rolePermissions.push({
        role: "TEACHER",
        permission,
        previous: previous
          ? { ...previous, updatedAt: previous.updatedAt.toISOString() }
          : null
      });
      await prisma.rolePermission.upsert({
        where: { role_permission: { role: "TEACHER", permission } },
        update: { enabled: true },
        create: { role: "TEACHER", permission, enabled: true }
      });
    }

    const subject = await prisma.timetableSubject.create({
      data: {
        id: `${PREFIX}subject`,
        name: `${LABEL} General`,
        shortName: `${LABEL}-GEN`,
        isActive: true
      }
    });
    const teacherA = await prisma.timetableTeacher.create({
      data: {
        id: `${PREFIX}timetable-teacher-a`,
        name: USERS.teacherA.name,
        shortName: `${LABEL}-TA`,
        isActive: true,
        maxPeriodsPerWeek: 36
      }
    });
    const teacherB = await prisma.timetableTeacher.create({
      data: {
        id: `${PREFIX}timetable-teacher-b`,
        name: USERS.teacherB.name,
        shortName: `${LABEL}-TB`,
        isActive: true,
        maxPeriodsPerWeek: 36
      }
    });
    const staffA = await prisma.staffMember.create({
      data: {
        id: `${PREFIX}staff-a`,
        staffCode: `${LABEL}-STA`,
        fullName: USERS.teacherA.name,
        designation: "Teacher",
        status: "ACTIVE",
        userId: USERS.teacherA.id,
        timetableTeacherId: teacherA.id
      }
    });
    const staffB = await prisma.staffMember.create({
      data: {
        id: `${PREFIX}staff-b`,
        staffCode: `${LABEL}-STB`,
        fullName: USERS.teacherB.name,
        designation: "Teacher",
        status: "ACTIVE",
        userId: USERS.teacherB.id,
        timetableTeacherId: teacherB.id
      }
    });

    const classes = await Promise.all([
      createClassSection(prisma, CLASS_A, "A", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_A, "B", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_B, "B", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_SUBSTITUTE, "C", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_PREVIOUS, "A", PREVIOUS_ACADEMIC_YEAR)
    ]);
    const [sixA, , sevenB, eightC, previousNineA] = classes;
    await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-a`,
        academicYear: ACADEMIC_YEAR,
        classSectionId: sixA.id,
        subjectId: subject.id,
        teacherId: teacherA.id,
        periodsPerWeek: 5
      }
    });
    await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-b`,
        academicYear: ACADEMIC_YEAR,
        classSectionId: sevenB.id,
        subjectId: subject.id,
        teacherId: teacherB.id,
        periodsPerWeek: 5
      }
    });
    const substituteSource = await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-substitute-source`,
        academicYear: ACADEMIC_YEAR,
        classSectionId: eightC.id,
        subjectId: subject.id,
        teacherId: teacherB.id,
        periodsPerWeek: 4
      }
    });
    await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-previous-year`,
        academicYear: PREVIOUS_ACADEMIC_YEAR,
        classSectionId: previousNineA.id,
        subjectId: subject.id,
        teacherId: teacherA.id,
        periodsPerWeek: 3
      }
    });
    await prisma.substituteAssignment.create({
      data: {
        id: `${PREFIX}substitute-a`,
        assignmentDate: SUBSTITUTE_DATE,
        academicYear: ACADEMIC_YEAR,
        absentStaffMemberId: staffB.id,
        substituteStaffMemberId: staffA.id,
        timetableAssignmentId: substituteSource.id,
        className: CLASS_SUBSTITUTE,
        section: "C",
        subject: subject.name,
        reason: `${LABEL} approved dated substitute proof`,
        status: "CONFIRMED",
        assignedByUserId: USERS.director.id,
        confirmedByUserId: USERS.principal.id,
        assignedAt: new Date("2026-07-28T08:00:00.000Z"),
        confirmedAt: new Date("2026-07-28T08:10:00.000Z")
      }
    });

    const students = await Promise.all([
      createStudent(prisma, "SIX-A-1", CLASS_A, "A", ACADEMIC_YEAR),
      createStudent(prisma, "SIX-A-2", CLASS_A, "A", ACADEMIC_YEAR),
      createStudent(prisma, "SIX-B-1", CLASS_A, "B", ACADEMIC_YEAR),
      createStudent(prisma, "SEVEN-B-1", CLASS_B, "B", ACADEMIC_YEAR),
      createStudent(prisma, "EIGHT-C-1", CLASS_SUBSTITUTE, "C", ACADEMIC_YEAR),
      createStudent(prisma, "NINE-A-OLD", CLASS_PREVIOUS, "A", PREVIOUS_ACADEMIC_YEAR)
    ]);
    const [sixAOne, sixATwo, , sevenBOne, eightCOne] = students;
    await createAttendanceSession(prisma, {
      id: `${PREFIX}session-a-submitted`,
      date: PRIMARY_DATE,
      className: CLASS_A,
      section: "A",
      status: "SUBMITTED",
      userId: USERS.teacherA.id,
      students: [sixAOne, sixATwo]
    });
    await createAttendanceSession(prisma, {
      id: `${PREFIX}session-b`,
      date: PRIMARY_DATE,
      className: CLASS_B,
      section: "B",
      status: "DRAFT",
      userId: USERS.teacherB.id,
      students: [sevenBOne]
    });
    await createAttendanceSession(prisma, {
      id: `${PREFIX}session-substitute`,
      date: SUBSTITUTE_DATE,
      className: CLASS_SUBSTITUTE,
      section: "C",
      status: "DRAFT",
      userId: USERS.teacherA.id,
      students: [eightCOne]
    });
    await createAttendanceSession(prisma, {
      id: `${PREFIX}session-race`,
      date: new Date("2026-07-28T00:00:00.000Z"),
      className: CLASS_A,
      section: "A",
      status: "DRAFT",
      userId: USERS.teacherA.id,
      students: [sixAOne, sixATwo]
    });

    writeFileSync(STATE_PATH, JSON.stringify({
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      operationalHash,
      baselineLogicalDigest,
      browserAccessValue,
      rolePermissions
    } satisfies QaState, null, 2));
    assertOperationalHash(operationalHash);
    console.log(JSON.stringify({
      status: "QA23C_COPY_PREPARED",
      fixturePrefix: LABEL,
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      roles: Object.values(USERS).map(({ role, username }) => ({ role, username })),
      credentials: "Stored only in the ignored QA23C runtime state file; not printed",
      academicYear: ACADEMIC_YEAR,
      primaryDate: isoDate(PRIMARY_DATE),
      substituteDate: isoDate(SUBSTITUTE_DATE),
      operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function verify() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const authA = { id: USERS.teacherA.id, role: "TEACHER" as const };
    const authB = { id: USERS.teacherB.id, role: "TEACHER" as const };
    const authUnlinked = { id: USERS.unlinked.id, role: "TEACHER" as const };
    const scopeA = await resolveTeacherAttendanceScope(prisma, authA, {
      academicYear: ACADEMIC_YEAR,
      date: PRIMARY_DATE
    });
    const scopeB = await resolveTeacherAttendanceScope(prisma, authB, {
      academicYear: ACADEMIC_YEAR,
      date: PRIMARY_DATE
    });
    const unlinked = await resolveTeacherAttendanceScope(prisma, authUnlinked, {
      academicYear: ACADEMIC_YEAR,
      date: PRIMARY_DATE
    });
    requireAttendanceTarget(scopeA, target(PRIMARY_DATE, CLASS_A, "A"));
    assertDenied(() => requireAttendanceTarget(scopeA, target(PRIMARY_DATE, CLASS_B, "B")));
    assertDenied(() => requireAttendanceTarget(scopeB, target(PRIMARY_DATE, CLASS_A, "A")));
    assertDenied(() => requireAttendanceTarget(scopeA, target(PRIMARY_DATE, CLASS_A, "B")));
    assertDenied(() => requireAttendanceTarget(scopeA, {
      ...target(PRIMARY_DATE, CLASS_A, "A"),
      academicYear: PREVIOUS_ACADEMIC_YEAR
    }));
    if (unlinked.targets.length !== 0 || unlinked.broad) throw new Error("QA23C_UNLINKED_TEACHER_SCOPE_NOT_EMPTY");

    const substituteScope = await resolveTeacherAttendanceScope(prisma, authA, {
      academicYear: ACADEMIC_YEAR,
      date: SUBSTITUTE_DATE
    });
    const substituteAuthority = requireAttendanceTarget(
      substituteScope,
      target(SUBSTITUTE_DATE, CLASS_SUBSTITUTE, "C")
    );
    if (substituteAuthority.source !== "SUBSTITUTE") throw new Error("QA23C_SUBSTITUTE_SOURCE_MISMATCH");
    const expiredScope = await resolveTeacherAttendanceScope(prisma, authA, {
      academicYear: ACADEMIC_YEAR,
      date: OUTSIDE_SUBSTITUTE_DATE
    });
    assertDenied(() => requireAttendanceTarget(expiredScope, target(OUTSIDE_SUBSTITUTE_DATE, CLASS_SUBSTITUTE, "C")));

    const reportRowsA = await prisma.studentAttendanceSession.findMany({
      where: {
        academicYear: ACADEMIC_YEAR,
        status: { in: ["SUBMITTED", "LOCKED"] },
        ...attendanceScopeWhere(scopeA)
      },
      select: { className: true, section: true }
    });
    if (!reportRowsA.length || reportRowsA.some((row) => row.className !== CLASS_A || row.section !== "A")) {
      throw new Error("QA23C_REPORT_SCOPE_MISMATCH");
    }
    const exportRowsA = await prisma.studentAttendanceSession.findMany({
      where: {
        attendanceDate: PRIMARY_DATE,
        academicYear: ACADEMIC_YEAR,
        status: { in: ["SUBMITTED", "LOCKED"] },
        ...attendanceScopeWhere(scopeA)
      },
      include: { records: true }
    });
    if (exportRowsA.length !== 1 || exportRowsA[0]?.className !== CLASS_A || exportRowsA[0]?.section !== "A") {
      throw new Error("QA23C_EXPORT_SCOPE_MISMATCH");
    }

    for (const role of ["DIRECTOR", "PRINCIPAL"] as const) {
      for (const permission of ["VIEW_STUDENT_ATTENDANCE", "VIEW_STUDENT_ATTENDANCE_REPORTS"] as const) {
        if (!(await hasRolePermission(prisma, role, permission))) {
          throw new Error(`QA23C_LEADERSHIP_PERMISSION_MISSING_${role}_${permission}`);
        }
      }
      const leadershipScope = await resolveTeacherAttendanceScope(
        prisma,
        { id: USERS[role === "DIRECTOR" ? "director" : "principal"].id, role },
        { academicYear: ACADEMIC_YEAR, date: PRIMARY_DATE }
      );
      if (!leadershipScope.broad) throw new Error(`QA23C_LEADERSHIP_SCOPE_MISMATCH_${role}`);
    }
    for (const role of ["PARENT", "ACCOUNTANT", "VIEWER"] as const) {
      if (await hasRolePermission(prisma, role, "VIEW_STUDENT_ATTENDANCE")) {
        throw new Error(`QA23C_NON_TEACHING_BOUNDARY_FAILED_${role}`);
      }
    }

    const raceSession = await prisma.studentAttendanceSession.findUniqueOrThrow({
      where: { id: `${PREFIX}session-race` }
    });
    const competitor = client(state.databasePath);
    let raceCounts: number[];
    try {
      const outcomes = await Promise.allSettled([
        prisma.studentAttendanceSession.updateMany({
          where: { id: raceSession.id, updatedAt: raceSession.updatedAt, status: "DRAFT" },
          data: { notes: `${LABEL} writer one`, updatedAt: new Date(raceSession.updatedAt.getTime() + 1000) }
        }),
        competitor.studentAttendanceSession.updateMany({
          where: { id: raceSession.id, updatedAt: raceSession.updatedAt, status: "DRAFT" },
          data: { notes: `${LABEL} writer two`, updatedAt: new Date(raceSession.updatedAt.getTime() + 2000) }
        })
      ]);
      raceCounts = outcomes.map((outcome) =>
        outcome.status === "fulfilled" ? outcome.value.count : 0
      );
    } finally {
      await competitor.$disconnect();
    }
    if (raceCounts.reduce((sum, count) => sum + count, 0) !== 1) {
      throw new Error(`QA23C_CAS_RACE_FAILED_${raceCounts.join("_")}`);
    }

    const fixtureCounts = await fixtureInspection(prisma);
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "QA23C_COPIED_DB_PROOFS_PASSED",
      proofs: {
        teacherAExactScope: true,
        teacherBCrossScopeDenied: true,
        crossClassSectionYearTamperingDenied: true,
        unlinkedTeacherSafeEmpty: true,
        substituteExactDateAndScope: true,
        substituteExpiredOutsideDate: true,
        reportsAndCsvIdenticalScope: true,
        principalDirectorGovernedAccess: true,
        parentAccountantViewerDenied: true,
        concurrentCasWinnerCount: 1,
        operationalDatabaseUnchanged: true
      },
      fixtureCounts,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function inspect() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    const teacherA = await prisma.user.findUniqueOrThrow({
      where: { id: USERS.teacherA.id },
      select: { passwordHash: true }
    });
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "QA23C_COPY_INSPECTED",
      fixtureCounts: await fixtureInspection(prisma),
      syntheticCredentialValid: await verifyPassword(
        state.browserAccessValue,
        teacherA.passwordHash
      ),
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function operationalCheck() {
  const state = readState();
  assertOperationalHash(state.operationalHash);
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: `file:${path.resolve(OPERATIONAL_DATABASE).replaceAll("\\", "/")}`
      }
    }
  });
  try {
    const [
      students,
      activeEnrollments,
      paymentSummary,
      guardians,
      staff,
      activeSuperAdmin,
      activeAdmin,
      activeAccountant,
      activeViewer,
      migrationRows
    ] = await Promise.all([
      prisma.student.count(),
      prisma.academicYearEnrollment.count({ where: { status: "ACTIVE" } }),
      prisma.payment.aggregate({ _count: { _all: true }, _sum: { amountPaid: true } }),
      prisma.guardian.count(),
      prisma.staffMember.count(),
      prisma.user.count({ where: { role: "SUPER_ADMIN", isActive: true } }),
      prisma.user.count({ where: { role: "ADMIN", isActive: true } }),
      prisma.user.count({ where: { role: "ACCOUNTANT", isActive: true } }),
      prisma.user.count({ where: { role: "VIEWER", isActive: true } }),
      prisma.$queryRawUnsafe<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>(
        'SELECT migration_name, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY migration_name'
      )
    ]);
    const exact = {
      students,
      activeEnrollments,
      payments: paymentSummary._count._all,
      collectedInr: paymentSummary._sum.amountPaid ?? 0,
      guardians,
      staff,
      activeSuperAdmin,
      activeAdmin,
      activeAccountant,
      activeViewer,
      migrations: migrationRows.length
    };
    const expected = {
      students: 0,
      activeEnrollments: 0,
      payments: 0,
      collectedInr: 0,
      guardians: 0,
      staff: 0,
      activeSuperAdmin: 1,
      activeAdmin: 0,
      activeAccountant: 0,
      activeViewer: 0,
      migrations: 1
    };
    if (JSON.stringify(exact) !== JSON.stringify(expected)) {
      throw new Error(`QA23C_OPERATIONAL_BASELINE_MISMATCH_${JSON.stringify(exact)}`);
    }
    if (
      migrationRows[0]?.migration_name !== "20260722_clean_install_baseline" ||
      !migrationRows[0]?.finished_at ||
      migrationRows[0]?.rolled_back_at
    ) throw new Error("QA23C_OPERATIONAL_MIGRATION_STATE_MISMATCH");
    console.log(JSON.stringify({
      status: "QA23C_OPERATIONAL_BASELINE_UNCHANGED",
      ...exact,
      migration: migrationRows[0].migration_name,
      operationalHash: state.operationalHash
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function cleanup() {
  const state = readState();
  const prisma = client(state.databasePath);
  try {
    await cleanupFixtures(prisma, state);
    await cleanupFixtures(prisma, state);
    const remaining = await fixtureInspection(prisma);
    if (Object.values(remaining).some((count) => count !== 0)) {
      throw new Error(`QA23C_TARGETED_CLEANUP_FAILED_${JSON.stringify(remaining)}`);
    }
    const digest = await logicalDatabaseDigest(prisma);
    if (digest !== state.baselineLogicalDigest) throw new Error("QA23C_NON_QA_LOGICAL_STATE_CHANGED");
    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: "QA23C_COPY_CLEANED",
      cleanupIdempotent: true,
      nonQaLogicalStateRestored: true,
      operationalDatabaseUnchanged: true,
      remaining
    }));
  } finally {
    await prisma.$disconnect();
  }
}

async function destroy() {
  const state = readState();
  assertOperationalHash(state.operationalHash);
  cleanupIsolatedDatabase(state.databasePath);
  rmSync(STATE_PATH, { force: true });
  console.log(JSON.stringify({
    status: "QA23C_COPY_DESTROYED",
    databaseRemoved: !existsSync(state.databasePath),
    stateRemoved: !existsSync(STATE_PATH),
    operationalDatabaseUnchanged: true
  }));
}

async function createClassSection(
  prisma: PrismaClient,
  className: string,
  section: string,
  academicYear: string
) {
  return prisma.timetableClassSection.create({
    data: {
      id: `${PREFIX}class-${academicYear}-${className}-${section}`.toLowerCase(),
      academicYear,
      className,
      section,
      displayName: `${className}-${section}`,
      groupName: `${LABEL}-${academicYear}`,
      isActive: true
    }
  });
}

async function createStudent(
  prisma: PrismaClient,
  suffix: string,
  className: string,
  section: string,
  academicYear: string
) {
  const student = await prisma.student.create({
    data: {
      id: `${PREFIX}student-${suffix}`.toLowerCase(),
      academicYear,
      admissionNo: `${LABEL}-${suffix}`,
      studentName: `${LABEL} Student ${suffix}`,
      fatherName: `${LABEL} Parent`,
      className,
      section,
      phone1: "9000000000",
      status: "Active"
    }
  });
  await prisma.academicYearEnrollment.create({
    data: {
      id: `${PREFIX}enrollment-${suffix}`.toLowerCase(),
      studentId: student.id,
      academicYear,
      className,
      section,
      status: "ACTIVE"
    }
  });
  return student;
}

async function createAttendanceSession(
  prisma: PrismaClient,
  input: {
    id: string;
    date: Date;
    className: string;
    section: string;
    status: "DRAFT" | "SUBMITTED";
    userId: string;
    students: Array<{ id: string; admissionNo: string }>;
  }
) {
  return prisma.studentAttendanceSession.create({
    data: {
      id: input.id,
      attendanceDate: input.date,
      className: input.className,
      section: input.section,
      academicYear: ACADEMIC_YEAR,
      status: input.status,
      takenByUserId: input.userId,
      submittedByUserId: input.status === "SUBMITTED" ? input.userId : null,
      submittedAt: input.status === "SUBMITTED" ? new Date("2026-07-29T08:30:00.000Z") : null,
      records: {
        create: input.students.map((student, index) => ({
          id: `${input.id}-record-${index + 1}`,
          studentId: student.id,
          admissionNo: student.admissionNo,
          status: index % 2 === 0 ? "PRESENT" : "ABSENT",
          remarks: index % 2 === 0 ? null : `${LABEL} fixture remark`
        }))
      }
    }
  });
}

async function cleanupFixtures(prisma: PrismaClient, state: QaState) {
  await prisma.userAudit.deleteMany({
    where: {
      OR: [
        { actorUserId: { startsWith: PREFIX } },
        { targetUserId: { startsWith: PREFIX } }
      ]
    }
  });
  await prisma.substituteAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.studentAttendanceSession.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.academicYearEnrollment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableTeacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableSubject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableClassSection.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  for (const saved of state.rolePermissions) {
    if (saved.previous) {
      await prisma.rolePermission.update({
        where: { id: saved.previous.id },
        data: {
          enabled: saved.previous.enabled,
          updatedAt: new Date(saved.previous.updatedAt)
        }
      });
    } else {
      await prisma.rolePermission.deleteMany({
        where: { role: saved.role, permission: saved.permission }
      });
    }
  }
}

async function fixtureInspection(prisma: PrismaClient) {
  const [
    users,
    staff,
    timetableTeachers,
    timetableSubjects,
    classSections,
    timetableAssignments,
    substitutes,
    students,
    enrollments,
    attendanceSessions,
    attendanceRecords,
    audits
  ] = await Promise.all([
    prisma.user.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.staffMember.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.timetableTeacher.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.timetableSubject.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.timetableClassSection.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.timetableAssignment.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.substituteAssignment.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.student.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.academicYearEnrollment.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.studentAttendanceSession.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.studentAttendanceRecord.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.userAudit.count({
      where: {
        OR: [
          { actorUserId: { startsWith: PREFIX } },
          { targetUserId: { startsWith: PREFIX } }
        ]
      }
    })
  ]);
  return {
    users,
    staff,
    timetableTeachers,
    timetableSubjects,
    classSections,
    timetableAssignments,
    substitutes,
    students,
    enrollments,
    attendanceSessions,
    attendanceRecords,
    audits
  };
}

function target(date: Date, className: string, section: string) {
  return {
    attendanceDate: date,
    academicYear: ACADEMIC_YEAR,
    className,
    section
  };
}

function assertDenied(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof AttendanceScopeError) return;
    throw error;
  }
  throw new Error("QA23C_EXPECTED_SCOPE_DENIAL_MISSING");
}

async function logicalDatabaseDigest(prisma: PrismaClient) {
  const tables = await prisma.$queryRawUnsafe<Array<{ name: string }>>(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  );
  const hash = createHash("sha256");
  for (const { name } of tables) {
    if (!/^[A-Za-z0-9_]+$/.test(name)) throw new Error("QA23C_UNSAFE_TABLE_NAME");
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT * FROM "${name}" ORDER BY rowid`
    );
    hash.update(name);
    hash.update(JSON.stringify(rows, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (Buffer.isBuffer(value)) return value.toString("base64");
      return value;
    }));
  }
  return hash.digest("hex");
}

function readState(): QaState {
  if (!existsSync(STATE_PATH)) throw new Error("QA23C_STATE_NOT_FOUND_RUN_PREPARE");
  const state = JSON.parse(readFileSync(STATE_PATH, "utf8")) as QaState;
  if (path.resolve(state.databasePath) !== path.resolve(DATABASE_PATH)) {
    throw new Error("QA23C_STATE_DATABASE_MISMATCH");
  }
  assertIsolatedDatabasePath(state.databasePath);
  return state;
}

function fileHash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function assertOperationalHash(expected: string) {
  const actual = fileHash(OPERATIONAL_DATABASE);
  if (actual !== expected) throw new Error(`QA23C_OPERATIONAL_DATABASE_CHANGED_${expected}_${actual}`);
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
