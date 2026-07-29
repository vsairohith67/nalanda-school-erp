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
import { getEffectivePermissions } from "../lib/role-permissions";
import { getDashboardCommandCenter } from "../lib/dashboard";
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

const LABEL = process.env.QA23C_PROFILE === "QA23CQA" ? "QA23CQA" : "QA23C";
const PREFIX = `${LABEL.toLowerCase()}-`;
const ACADEMIC_YEAR = "2026-27";
const PREVIOUS_ACADEMIC_YEAR = "2025-26";
const PRIMARY_DATE = new Date("2026-07-29T00:00:00.000Z");
const SUBSTITUTE_DATE = PRIMARY_DATE;
const OUTSIDE_SUBSTITUTE_DATE = new Date("2026-07-30T00:00:00.000Z");
const CLASS_A = `${LABEL}-VI`;
const CLASS_B = `${LABEL}-VII`;
const CLASS_SUBSTITUTE = `${LABEL}-VIII`;
const CLASS_PREVIOUS = `${LABEL}-IX`;
const CLASS_INACTIVE = `${LABEL}-X`;
const DATABASE_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-browser.db`);
const STATE_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-state.json`);
const PRODUCTION_STDOUT_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-production.stdout.log`);
const PRODUCTION_STDERR_PATH = path.join(QA_ROOT, "operational-copy", `${LABEL}-production.stderr.log`);

const USERS = {
  teacherA: { id: `${PREFIX}teacher-a`, name: `${LABEL} Teacher A`, username: `${PREFIX}teacher-a`, role: "TEACHER" },
  teacherB: { id: `${PREFIX}teacher-b`, name: `${LABEL} Teacher B`, username: `${PREFIX}teacher-b`, role: "TEACHER" },
  unlinked: { id: `${PREFIX}teacher-unlinked`, name: `${LABEL} Unlinked Teacher`, username: `${PREFIX}teacher-unlinked`, role: "TEACHER" },
  inactiveUser: { id: `${PREFIX}teacher-inactive-user`, name: `${LABEL} Inactive User Teacher`, username: `${PREFIX}teacher-inactive-user`, role: "TEACHER" },
  inactiveStaff: { id: `${PREFIX}teacher-inactive-staff`, name: `${LABEL} Inactive Staff Teacher`, username: `${PREFIX}teacher-inactive-staff`, role: "TEACHER" },
  inactiveTimetable: { id: `${PREFIX}teacher-inactive-timetable`, name: `${LABEL} Inactive Timetable Teacher`, username: `${PREFIX}teacher-inactive-timetable`, role: "TEACHER" },
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
  if (action === "http") return httpVerify();
  if (action === "inspect") return inspect();
  if (action === "operational-check") return operationalCheck();
  if (action === "cleanup") return cleanup();
  if (action === "destroy") return destroy();
  throw new Error("Use prepare, verify, http, inspect, operational-check, cleanup, or destroy");
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
    await prisma.user.update({
      where: { id: USERS.inactiveUser.id },
      data: { isActive: false }
    });

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
    const inactiveStaffTimetableTeacher = await prisma.timetableTeacher.create({
      data: {
        id: `${PREFIX}timetable-teacher-inactive-staff`,
        name: USERS.inactiveStaff.name,
        shortName: `${LABEL}-TS`,
        isActive: true,
        maxPeriodsPerWeek: 36
      }
    });
    const inactiveUserTimetableTeacher = await prisma.timetableTeacher.create({
      data: {
        id: `${PREFIX}timetable-teacher-inactive-user`,
        name: USERS.inactiveUser.name,
        shortName: `${LABEL}-TU`,
        isActive: true,
        maxPeriodsPerWeek: 36
      }
    });
    const inactiveTimetableTeacher = await prisma.timetableTeacher.create({
      data: {
        id: `${PREFIX}timetable-teacher-inactive`,
        name: USERS.inactiveTimetable.name,
        shortName: `${LABEL}-TI`,
        isActive: false,
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
    await prisma.staffMember.create({
      data: {
        id: `${PREFIX}staff-inactive`,
        staffCode: `${LABEL}-STI`,
        fullName: USERS.inactiveStaff.name,
        designation: "Teacher",
        status: "LEFT",
        userId: USERS.inactiveStaff.id,
        timetableTeacherId: inactiveStaffTimetableTeacher.id
      }
    });
    await prisma.staffMember.create({
      data: {
        id: `${PREFIX}staff-inactive-user`,
        staffCode: `${LABEL}-STU`,
        fullName: USERS.inactiveUser.name,
        designation: "Teacher",
        status: "ACTIVE",
        userId: USERS.inactiveUser.id,
        timetableTeacherId: inactiveUserTimetableTeacher.id
      }
    });
    await prisma.staffMember.create({
      data: {
        id: `${PREFIX}staff-inactive-timetable`,
        staffCode: `${LABEL}-STT`,
        fullName: USERS.inactiveTimetable.name,
        designation: "Teacher",
        status: "ACTIVE",
        userId: USERS.inactiveTimetable.id,
        timetableTeacherId: inactiveTimetableTeacher.id
      }
    });

    const classes = await Promise.all([
      createClassSection(prisma, CLASS_A, "A", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_A, "B", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_B, "B", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_SUBSTITUTE, "C", ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_PREVIOUS, "A", PREVIOUS_ACADEMIC_YEAR),
      createClassSection(prisma, CLASS_INACTIVE, "Z", ACADEMIC_YEAR, false)
    ]);
    const [sixA, , sevenB, eightC, previousNineA, inactiveTenZ] = classes;
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
    await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-inactive-user`,
        academicYear: ACADEMIC_YEAR,
        classSectionId: sixA.id,
        subjectId: subject.id,
        teacherId: inactiveUserTimetableTeacher.id,
        periodsPerWeek: 2
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
    await prisma.timetableAssignment.create({
      data: {
        id: `${PREFIX}assignment-inactive-class`,
        academicYear: ACADEMIC_YEAR,
        classSectionId: inactiveTenZ.id,
        subjectId: subject.id,
        teacherId: teacherA.id,
        periodsPerWeek: 2
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
    await prisma.substituteAssignment.create({
      data: {
        id: `${PREFIX}substitute-cancelled`,
        assignmentDate: SUBSTITUTE_DATE,
        academicYear: ACADEMIC_YEAR,
        absentStaffMemberId: staffB.id,
        substituteStaffMemberId: staffA.id,
        className: CLASS_B,
        section: "B",
        subject: subject.name,
        reason: `${LABEL} inactive substitute proof`,
        status: "CANCELLED",
        assignedByUserId: USERS.director.id,
        confirmedByUserId: USERS.principal.id,
        cancelledByUserId: USERS.director.id,
        assignedAt: new Date("2026-07-28T07:00:00.000Z"),
        confirmedAt: new Date("2026-07-28T07:10:00.000Z"),
        cancelledAt: new Date("2026-07-28T07:20:00.000Z"),
        cancellationReason: `${LABEL} inactive fixture`
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
    const parentGuardian = await prisma.guardian.create({
      data: {
        id: `${PREFIX}guardian-parent`,
        displayName: `${LABEL} Linked Parent`,
        primaryMobile: "9000000001",
        relationship: "Parent",
        status: "Active"
      }
    });
    await prisma.studentGuardian.create({
      data: {
        id: `${PREFIX}student-guardian-parent`,
        guardianId: parentGuardian.id,
        studentId: sixAOne.id,
        relationshipToStudent: "Parent",
        isPrimaryContact: true
      }
    });
    await prisma.user.update({
      where: { id: USERS.parent.id },
      data: { guardianId: parentGuardian.id }
    });
    await createAttendanceSession(prisma, {
      id: `${PREFIX}session-a-submitted`,
      date: PRIMARY_DATE,
      className: CLASS_A,
      section: "A",
      status: "SUBMITTED",
      userId: USERS.teacherA.id,
      students: [sixAOne, sixATwo]
    });
    await prisma.userAudit.create({
      data: {
        id: `${PREFIX}audit-correction-evidence`,
        action: "STUDENT_ATTENDANCE_CORRECT",
        actorUserId: USERS.teacherA.id,
        actorName: USERS.teacherA.name,
        detailsJson: JSON.stringify({
          academicYear: ACADEMIC_YEAR,
          attendanceDate: isoDate(PRIMARY_DATE),
          className: CLASS_A,
          section: "A",
          authorizationSource: "TIMETABLE",
          correctionReason: `${LABEL} independent correction evidence`
        })
      }
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
      status: `${LABEL}_COPY_PREPARED`,
      fixturePrefix: LABEL,
      databasePath,
      databaseUrl: databaseUrl(databasePath),
      roles: Object.values(USERS).map(({ role, username }) => ({ role, username })),
      credentials: `Stored only in the ignored ${LABEL} runtime state file; not printed`,
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
    const authInactiveStaff = { id: USERS.inactiveStaff.id, role: "TEACHER" as const };
    const authInactiveTimetable = { id: USERS.inactiveTimetable.id, role: "TEACHER" as const };
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
    const inactiveStaff = await resolveTeacherAttendanceScope(prisma, authInactiveStaff, {
      academicYear: ACADEMIC_YEAR,
      date: PRIMARY_DATE
    });
    const inactiveTimetable = await resolveTeacherAttendanceScope(prisma, authInactiveTimetable, {
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
    assertDenied(() => requireAttendanceTarget(scopeA, target(PRIMARY_DATE, CLASS_INACTIVE, "Z")));
    if (unlinked.targets.length !== 0 || unlinked.broad) throw new Error("QA23C_UNLINKED_TEACHER_SCOPE_NOT_EMPTY");
    if (inactiveStaff.targets.length !== 0 || inactiveStaff.broad) throw new Error("QA23C_INACTIVE_STAFF_SCOPE_NOT_EMPTY");
    if (inactiveTimetable.targets.length !== 0 || inactiveTimetable.broad) throw new Error("QA23C_INACTIVE_TIMETABLE_SCOPE_NOT_EMPTY");
    if (!(await hasRolePermission(prisma, "TEACHER", "VIEW_STUDENT_ATTENDANCE"))) {
      throw new Error("QA23C_PERMISSION_ONLY_PROOF_MISSING_PERMISSION");
    }

    const substituteScope = await resolveTeacherAttendanceScope(prisma, authA, {
      academicYear: ACADEMIC_YEAR,
      date: SUBSTITUTE_DATE
    });
    const substituteAuthority = requireAttendanceTarget(
      substituteScope,
      target(SUBSTITUTE_DATE, CLASS_SUBSTITUTE, "C")
    );
    if (substituteAuthority.source !== "SUBSTITUTE") throw new Error("QA23C_SUBSTITUTE_SOURCE_MISMATCH");
    assertDenied(() => requireAttendanceTarget(substituteScope, target(SUBSTITUTE_DATE, CLASS_B, "B")));
    const substituteEvidence = await prisma.substituteAssignment.findUniqueOrThrow({
      where: { id: `${PREFIX}substitute-a` },
      select: {
        status: true,
        assignedByUserId: true,
        confirmedByUserId: true,
        assignedAt: true,
        confirmedAt: true
      }
    });
    if (
      substituteEvidence.status !== "CONFIRMED" ||
      substituteEvidence.assignedByUserId !== USERS.director.id ||
      substituteEvidence.confirmedByUserId !== USERS.principal.id ||
      !substituteEvidence.assignedAt ||
      !substituteEvidence.confirmedAt
    ) throw new Error("QA23C_SUBSTITUTE_EVIDENCE_MISSING");
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
    const correctionAudit = await prisma.userAudit.findUniqueOrThrow({
      where: { id: `${PREFIX}audit-correction-evidence` },
      select: { action: true, detailsJson: true }
    });
    if (
      correctionAudit.action !== "STUDENT_ATTENDANCE_CORRECT" ||
      !correctionAudit.detailsJson?.includes(`${LABEL} independent correction evidence`)
    ) throw new Error("QA23C_CORRECTION_AUDIT_EVIDENCE_MISSING");
    const inactiveUser = await prisma.user.findUniqueOrThrow({
      where: { id: USERS.inactiveUser.id },
      select: { isActive: true }
    });
    if (inactiveUser.isActive) throw new Error("QA23C_INACTIVE_USER_FIXTURE_NOT_INACTIVE");

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
      status: `${LABEL}_COPIED_DB_PROOFS_PASSED`,
      proofs: {
        teacherAExactScope: true,
        teacherBCrossScopeDenied: true,
        crossClassSectionYearTamperingDenied: true,
        inactiveStaffDenied: true,
        inactiveTimetableTeacherDenied: true,
        inactiveUserFixtureRequiresSessionDenial: true,
        inactiveOrExpiredAssignmentDenied: true,
        unlinkedTeacherSafeEmpty: true,
        permissionAloneDoesNotGrantScope: true,
        substituteExactDateAndScope: true,
        inactiveSubstituteDenied: true,
        substituteExpiredOutsideDate: true,
        substituteEvidenceAuditable: true,
        reportsAndCsvIdenticalScope: true,
        correctionAuditEvidencePresent: true,
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
      status: `${LABEL}_COPY_INSPECTED`,
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

async function httpVerify() {
  const state = readState();
  const baseUrl = String(process.env.QA23C_BASE_URL ?? "http://127.0.0.1:3137").replace(/\/+$/, "");
  const prisma = client(state.databasePath);
  try {
    type Session = { cookie: string; role: string };
    const login = async (key: keyof typeof USERS): Promise<Session> => {
      const response = await fetch(`${baseUrl}/api/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: baseUrl
        },
        body: JSON.stringify({
          identifier: USERS[key].username,
          password: state.browserAccessValue
        })
      });
      if (response.status !== 200) {
        throw new Error(`${LABEL}_HTTP_LOGIN_FAILED_${key}_${response.status}`);
      }
      const setCookie = response.headers.get("set-cookie");
      if (!setCookie) throw new Error(`${LABEL}_HTTP_LOGIN_COOKIE_MISSING_${key}`);
      return { cookie: setCookie.split(";")[0]!, role: USERS[key].role };
    };
    const request = async (
      session: Session,
      pathname: string,
      options: RequestInit = {}
    ) => fetch(`${baseUrl}${pathname}`, {
      redirect: "manual",
      ...options,
      headers: {
        cookie: session.cookie,
        origin: baseUrl,
        ...(options.headers ?? {})
      }
    });
    const jsonBody = async (response: Response) => {
      const text = await response.text();
      try {
        return { text, data: JSON.parse(text) as Record<string, any> };
      } catch {
        return { text, data: {} as Record<string, any> };
      }
    };
    const assertStatus = (response: Response, expected: number, proof: string) => {
      if (response.status !== expected) {
        throw new Error(`${LABEL}_${proof}_STATUS_${response.status}_EXPECTED_${expected}`);
      }
    };
    const assertPrivate = (response: Response, proof: string) => {
      const cacheControl = response.headers.get("cache-control")?.toLowerCase() ?? "";
      if (!cacheControl.includes("private") || !cacheControl.includes("no-store")) {
        throw new Error(`${LABEL}_${proof}_NOT_PRIVATE_NO_STORE_${cacheControl}`);
      }
    };
    const assertNoPrivateData = (text: string, proof: string) => {
      const blocked = [
        `${LABEL} Student`,
        `${LABEL}-SIX-A-1`,
        `${LABEL}-SIX-A-2`,
        `${PREFIX}student-`,
        `${PREFIX}session-`
      ];
      if (blocked.some((value) => text.includes(value))) {
        throw new Error(`${LABEL}_${proof}_PRIVATE_DATA_LEAK`);
      }
    };
    const query = (date: string, className: string, section: string, academicYear = ACADEMIC_YEAR) =>
      `attendanceDate=${date}&academicYear=${encodeURIComponent(academicYear)}&className=${encodeURIComponent(className)}&section=${encodeURIComponent(section)}`;

    const sessions = {
      teacherA: await login("teacherA"),
      teacherB: await login("teacherB"),
      unlinked: await login("unlinked"),
      inactiveStaff: await login("inactiveStaff"),
      inactiveTimetable: await login("inactiveTimetable"),
      director: await login("director"),
      principal: await login("principal"),
      parent: await login("parent"),
      accountant: await login("accountant"),
      viewer: await login("viewer")
    };

    await prisma.user.update({
      where: { id: USERS.inactiveUser.id },
      data: { isActive: true }
    });
    const inactiveUserSession = await login("inactiveUser");
    await prisma.user.update({
      where: { id: USERS.inactiveUser.id },
      data: { isActive: false }
    });
    const inactiveUserResponse = await request(
      inactiveUserSession,
      `/api/attendance/students?mode=scopes&attendanceDate=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}`
    );
    assertStatus(inactiveUserResponse, 401, "INACTIVE_USER_SESSION_DENIAL");
    assertPrivate(inactiveUserResponse, "INACTIVE_USER_SESSION_DENIAL");

    const sessionBeforeGet = await prisma.studentAttendanceSession.findUniqueOrThrow({
      where: { id: `${PREFIX}session-a-submitted` },
      select: { updatedAt: true }
    });
    const auditCountBeforeGet = await prisma.userAudit.count();
    const scopesAResponse = await request(
      sessions.teacherA,
      `/api/attendance/students?mode=scopes&attendanceDate=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}`
    );
    assertStatus(scopesAResponse, 200, "TEACHER_A_SCOPES");
    assertPrivate(scopesAResponse, "TEACHER_A_SCOPES");
    const scopesA = await jsonBody(scopesAResponse);
    const scopeKeys = (scopesA.data.classSections ?? []).map((row: any) =>
      `${row.className}|${row.section}|${row.source}`
    );
    if (
      !scopeKeys.includes(`${CLASS_A}|A|TIMETABLE`) ||
      !scopeKeys.includes(`${CLASS_SUBSTITUTE}|C|SUBSTITUTE`) ||
      scopeKeys.includes(`${CLASS_A}|B|TIMETABLE`) ||
      scopeKeys.includes(`${CLASS_B}|B|TIMETABLE`) ||
      scopeKeys.some((value: string) => value.includes(CLASS_INACTIVE))
    ) throw new Error(`${LABEL}_TEACHER_A_SCOPE_OPTIONS_MISMATCH_${scopeKeys.join(",")}`);

    const rosterAResponse = await request(
      sessions.teacherA,
      `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "A")}`
    );
    assertStatus(rosterAResponse, 200, "TEACHER_A_ROSTER");
    assertPrivate(rosterAResponse, "TEACHER_A_ROSTER");
    const rosterA = await jsonBody(rosterAResponse);
    if (
      rosterA.data.students?.length !== 2 ||
      rosterA.data.students.some((row: any) => row.className !== CLASS_A || row.section !== "A")
    ) throw new Error(`${LABEL}_TEACHER_A_ROSTER_MISMATCH`);
    const sessionAfterGet = await prisma.studentAttendanceSession.findUniqueOrThrow({
      where: { id: `${PREFIX}session-a-submitted` },
      select: { updatedAt: true }
    });
    const auditCountAfterGet = await prisma.userAudit.count();
    if (
      sessionBeforeGet.updatedAt.getTime() !== sessionAfterGet.updatedAt.getTime() ||
      auditCountBeforeGet !== auditCountAfterGet
    ) throw new Error(`${LABEL}_STATE_CHANGING_GET_DETECTED`);

    const deniedCases: Array<[Session, string, string]> = [
      [sessions.teacherA, `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_B, "B")}`, "CROSS_CLASS"],
      [sessions.teacherA, `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "B")}`, "CROSS_SECTION"],
      [sessions.teacherA, `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "A", PREVIOUS_ACADEMIC_YEAR)}`, "CROSS_YEAR"],
      [sessions.teacherB, `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "A")}`, "CROSS_TEACHER"],
      [sessions.teacherA, `/api/attendance/students?${query(isoDate(PRIMARY_DATE), `${LABEL}-UNKNOWN`, "Z")}`, "UNKNOWN_OBJECT"]
    ];
    for (const [session, pathname, proof] of deniedCases) {
      const response = await request(session, pathname);
      assertStatus(response, 403, proof);
      assertPrivate(response, proof);
      const body = await response.text();
      assertNoPrivateData(body, proof);
    }

    for (const [key, session] of [
      ["UNLINKED", sessions.unlinked],
      ["INACTIVE_STAFF", sessions.inactiveStaff],
      ["INACTIVE_TIMETABLE", sessions.inactiveTimetable]
    ] as const) {
      const response = await request(
        session,
        `/api/attendance/students?mode=scopes&attendanceDate=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}`
      );
      assertStatus(response, 200, `${key}_EMPTY_SCOPE`);
      assertPrivate(response, `${key}_EMPTY_SCOPE`);
      const body = await jsonBody(response);
      if (body.data.classSections?.length !== 0) throw new Error(`${LABEL}_${key}_SCOPE_NOT_EMPTY`);
    }

    const substituteAllowed = await request(
      sessions.teacherA,
      `/api/attendance/students?${query(isoDate(SUBSTITUTE_DATE), CLASS_SUBSTITUTE, "C")}`
    );
    assertStatus(substituteAllowed, 200, "SUBSTITUTE_ALLOWED");
    const substituteAllowedBody = await jsonBody(substituteAllowed);
    if (substituteAllowedBody.data.authorizationSource !== "SUBSTITUTE") {
      throw new Error(`${LABEL}_SUBSTITUTE_AUTHORIZATION_SOURCE_MISMATCH`);
    }
    const substituteExpired = await request(
      sessions.teacherA,
      `/api/attendance/students?${query(isoDate(OUTSIDE_SUBSTITUTE_DATE), CLASS_SUBSTITUTE, "C")}`
    );
    assertStatus(substituteExpired, 403, "SUBSTITUTE_EXPIRED");
    assertNoPrivateData(await substituteExpired.text(), "SUBSTITUTE_EXPIRED");

    for (const [key, session, expected] of [
      ["DIRECTOR", sessions.director, 200],
      ["PRINCIPAL", sessions.principal, 200],
      ["PARENT", sessions.parent, 403],
      ["ACCOUNTANT", sessions.accountant, 403],
      ["VIEWER", sessions.viewer, 403]
    ] as const) {
      const response = await request(
        session,
        `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "A")}`
      );
      assertStatus(response, expected, `${key}_ROLE_BOUNDARY`);
      assertPrivate(response, `${key}_ROLE_BOUNDARY`);
      if (expected === 403) assertNoPrivateData(await response.text(), `${key}_ROLE_BOUNDARY`);
    }

    const reportPath = `/attendance/students/reports?from=${isoDate(PRIMARY_DATE)}&to=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}&className=${encodeURIComponent(CLASS_A)}&section=A`;
    const reportResponse = await request(sessions.teacherA, reportPath);
    assertStatus(reportResponse, 200, "REPORT_ALLOWED");
    assertPrivate(reportResponse, "REPORT_ALLOWED");
    const reportText = await reportResponse.text();
    const authorisedRosterNames = rosterA.data.students.map((row: any) => String(row.studentName));
    if (
      !authorisedRosterNames.every((name: string) => reportText.includes(name)) ||
      reportText.includes(`${LABEL} Student SEVEN-B-1`)
    ) {
      throw new Error(`${LABEL}_REPORT_SCOPE_MISMATCH`);
    }
    const reportDenied = await request(
      sessions.teacherA,
      `/attendance/students/reports?from=${isoDate(PRIMARY_DATE)}&to=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}&className=${encodeURIComponent(CLASS_A)}&section=B`
    );
    assertStatus(reportDenied, 404, "REPORT_TAMPERING");
    assertNoPrivateData(await reportDenied.text(), "REPORT_TAMPERING");

    await prisma.student.update({
      where: { id: `${PREFIX}student-six-a-1` },
      data: {
        admissionNo: `+${LABEL}-FORMULA`,
        studentName: `=${LABEL}-FORMULA`
      }
    });
    await prisma.studentAttendanceRecord.updateMany({
      where: { studentId: `${PREFIX}student-six-a-1` },
      data: { admissionNo: `+${LABEL}-FORMULA` }
    });
    const exportPath = `/api/attendance/students/reports/export?from=${isoDate(PRIMARY_DATE)}&to=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}&className=${encodeURIComponent(CLASS_A)}&section=A`;
    const exportResponse = await request(sessions.teacherA, exportPath);
    assertStatus(exportResponse, 200, "EXPORT_ALLOWED");
    assertPrivate(exportResponse, "EXPORT_ALLOWED");
    if (!exportResponse.headers.get("content-type")?.includes("text/csv")) {
      throw new Error(`${LABEL}_EXPORT_CONTENT_TYPE_MISMATCH`);
    }
    const csv = await exportResponse.text();
    if (
      !csv.includes(`"'+${LABEL}-FORMULA"`) ||
      !csv.includes(`"'=${LABEL}-FORMULA"`) ||
      csv.includes(`${LABEL} Student SEVEN-B-1`)
    ) throw new Error(`${LABEL}_CSV_SCOPE_OR_FORMULA_SAFETY_MISMATCH`);
    const csvRows = csv.trim().split(/\r?\n/);
    if (csvRows.length !== 3) throw new Error(`${LABEL}_CSV_ROW_COUNT_${csvRows.length}_EXPECTED_3`);
    const exportDenied = await request(
      sessions.teacherA,
      `/api/attendance/students/reports/export?from=${isoDate(PRIMARY_DATE)}&to=${isoDate(PRIMARY_DATE)}&academicYear=${ACADEMIC_YEAR}&className=${encodeURIComponent(CLASS_A)}&section=B`
    );
    assertStatus(exportDenied, 403, "EXPORT_TAMPERING");
    assertNoPrivateData(await exportDenied.text(), "EXPORT_TAMPERING");

    const dashboardAResponse = await request(sessions.teacherA, "/api/dashboard");
    assertStatus(dashboardAResponse, 403, "DASHBOARD_ROUTE_PERMISSION_BOUNDARY");
    assertNoPrivateData(await dashboardAResponse.text(), "DASHBOARD_ROUTE_PERMISSION_BOUNDARY");
    const teacherPermissions = await getEffectivePermissions(prisma, "TEACHER");
    const dashboardA = await getDashboardCommandCenter(
      prisma,
      teacherPermissions,
      ACADEMIC_YEAR,
      "TEACHER",
      new Date("2026-07-29T12:00:00.000Z"),
      { id: USERS.teacherA.id, role: "TEACHER" }
    );
    if (
      dashboardA.studentAttendance?.total !== 3 ||
      dashboardA.studentAttendance?.PRESENT !== 2 ||
      dashboardA.studentAttendance?.ABSENT !== 1
    ) throw new Error(`${LABEL}_DASHBOARD_TEACHER_A_SCOPE_MISMATCH`);
    const dashboardEmpty = await getDashboardCommandCenter(
      prisma,
      teacherPermissions,
      ACADEMIC_YEAR,
      "TEACHER",
      new Date("2026-07-29T12:00:00.000Z"),
      { id: USERS.unlinked.id, role: "TEACHER" }
    );
    if (dashboardEmpty.studentAttendance !== null) {
      throw new Error(`${LABEL}_DASHBOARD_UNLINKED_NOT_EMPTY`);
    }

    const csrfResponse = await fetch(`${baseUrl}/api/attendance/students`, {
      method: "POST",
      headers: {
        cookie: sessions.teacherA.cookie,
        "content-type": "application/json",
        origin: "https://cross-site.invalid"
      },
      body: JSON.stringify({
        action: "save",
        attendanceDate: isoDate(PRIMARY_DATE),
        academicYear: ACADEMIC_YEAR,
        className: CLASS_A,
        section: "A",
        expectedUpdatedAt: new Date().toISOString(),
        records: []
      })
    });
    assertStatus(csrfResponse, 403, "CSRF_ORIGIN");
    assertPrivate(csrfResponse, "CSRF_ORIGIN");
    const oversizedResponse = await request(sessions.teacherA, "/api/attendance/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(600 * 1024) })
    });
    assertStatus(oversizedResponse, 413, "BOUNDED_BODY");
    const boundedSession = await prisma.studentAttendanceSession.findUniqueOrThrow({
      where: { id: `${PREFIX}session-race` },
      select: { updatedAt: true }
    });
    const tooManyRecordsResponse = await request(sessions.teacherA, "/api/attendance/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "save",
        attendanceDate: isoDate(new Date("2026-07-28T00:00:00.000Z")),
        academicYear: ACADEMIC_YEAR,
        className: CLASS_A,
        section: "A",
        expectedUpdatedAt: boundedSession.updatedAt.toISOString(),
        records: Array.from({ length: 2501 }, (_, index) => ({
          studentId: `${PREFIX}bounded-${index}`,
          status: "PRESENT"
        }))
      })
    });
    assertStatus(tooManyRecordsResponse, 400, "MAX_RECORD_COUNT");
    const tooManyRecordsBody = await tooManyRecordsResponse.text();
    if (!tooManyRecordsBody.includes("limited to 2500")) {
      throw new Error(`${LABEL}_MAX_RECORD_COUNT_ERROR_NOT_SAFE`);
    }

    const raceDate = "2026-07-28";
    const raceGet = await request(
      sessions.teacherA,
      `/api/attendance/students?${query(raceDate, CLASS_A, "A")}`
    );
    assertStatus(raceGet, 200, "RACE_LOAD");
    const raceBody = await jsonBody(raceGet);
    const raceRecords = raceBody.data.students.map((student: any, index: number) => ({
      studentId: student.id,
      status: index === 0 ? "PRESENT" : "ABSENT",
      remarks: `${LABEL} HTTP race`
    }));
    const racePayload = {
      action: "save",
      attendanceDate: raceDate,
      academicYear: ACADEMIC_YEAR,
      className: CLASS_A,
      section: "A",
      expectedUpdatedAt: raceBody.data.session.updatedAt,
      records: raceRecords
    };
    const raceResponses = await Promise.all([
      request(sessions.teacherA, "/api/attendance/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(racePayload)
      }),
      request(sessions.teacherA, "/api/attendance/students", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(racePayload)
      })
    ]);
    const raceStatuses = raceResponses.map((response) => response.status).sort();
    if (raceStatuses.filter((status) => status === 200).length !== 1) {
      throw new Error(`${LABEL}_HTTP_CONCURRENT_WRITES_UNSAFE_${raceStatuses.join("_")}`);
    }

    const correctionGet = await request(
      sessions.teacherA,
      `/api/attendance/students?${query(isoDate(PRIMARY_DATE), CLASS_A, "A")}`
    );
    assertStatus(correctionGet, 200, "CORRECTION_LOAD");
    const correctionBody = await jsonBody(correctionGet);
    const existingCorrectionRecords = new Map(
      correctionBody.data.session.records.map((record: any) => [record.studentId, record])
    );
    const correctionRecords = correctionBody.data.students.map((student: any, index: number) => {
      const previous = existingCorrectionRecords.get(student.id) as any;
      return {
        studentId: student.id,
        status: previous?.status === "PRESENT" ? "ABSENT" : "PRESENT",
        remarks: index === 0 ? `${LABEL} corrected attendance` : null
      };
    });
    const correctionResponse = await request(sessions.teacherA, "/api/attendance/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "correct",
        attendanceDate: isoDate(PRIMARY_DATE),
        academicYear: ACADEMIC_YEAR,
        className: CLASS_A,
        section: "A",
        expectedUpdatedAt: correctionBody.data.session.updatedAt,
        correctionReason: `${LABEL} independent HTTP correction proof`,
        records: correctionRecords
      })
    });
    assertStatus(correctionResponse, 200, "CORRECTION_MUTATION");
    assertPrivate(correctionResponse, "CORRECTION_MUTATION");
    const correctionAudit = await prisma.userAudit.findFirst({
      where: {
        action: "STUDENT_ATTENDANCE_CORRECT",
        actorUserId: USERS.teacherA.id,
        detailsJson: { contains: `${LABEL} independent HTTP correction proof` }
      },
      orderBy: { createdAt: "desc" }
    });
    if (!correctionAudit) throw new Error(`${LABEL}_HTTP_CORRECTION_AUDIT_MISSING`);

    assertOperationalHash(state.operationalHash);
    console.log(JSON.stringify({
      status: `${LABEL}_HTTP_PROOFS_PASSED`,
      baseUrl,
      proofs: {
        activeUserSessionRequired: true,
        exactScopesAndRoster: true,
        crossTeacherClassSectionYearDenied: true,
        inactiveAndUnlinkedEmpty: true,
        substituteDateAndStatusExact: true,
        leadershipAndOtherRolesGoverned: true,
        noStateChangingGet: true,
        reportsAndCsvExact: true,
        formulaSafeCsv: true,
        dashboardTotalsScoped: true,
        dashboardRoutePermissionBoundary: true,
        csrfOriginDenied: true,
        boundedBodyAndRecordCount: true,
        concurrentWritesSingleWinner: true,
        correctionAuditAppended: true,
        privateNoStore: true,
        unauthorizedResponsesPrivacySafe: true,
        operationalDatabaseUnchanged: true
      },
      raceStatuses,
      reportRows: csvRows.length - 1,
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
      status: `${LABEL}_OPERATIONAL_BASELINE_UNCHANGED`,
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
      status: `${LABEL}_COPY_CLEANED`,
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
  rmSync(PRODUCTION_STDOUT_PATH, { force: true });
  rmSync(PRODUCTION_STDERR_PATH, { force: true });
  console.log(JSON.stringify({
    status: `${LABEL}_COPY_DESTROYED`,
    databaseRemoved: !existsSync(state.databasePath),
    stateRemoved: !existsSync(STATE_PATH),
    productionLogsRemoved:
      !existsSync(PRODUCTION_STDOUT_PATH) && !existsSync(PRODUCTION_STDERR_PATH),
    operationalDatabaseUnchanged: true
  }));
}

async function createClassSection(
  prisma: PrismaClient,
  className: string,
  section: string,
  academicYear: string,
  isActive = true
) {
  return prisma.timetableClassSection.create({
    data: {
      id: `${PREFIX}class-${academicYear}-${className}-${section}`.toLowerCase(),
      academicYear,
      className,
      section,
      displayName: `${className}-${section}`,
      groupName: `${LABEL}-${academicYear}`,
      isActive
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
  await prisma.studentAttendanceSession.deleteMany({
    where: {
      OR: [
        { id: { startsWith: PREFIX } },
        { className: { startsWith: `${LABEL}-` } },
        { takenByUserId: { startsWith: PREFIX } },
        { submittedByUserId: { startsWith: PREFIX } },
        { lockedByUserId: { startsWith: PREFIX } },
        { records: { some: { studentId: { startsWith: PREFIX } } } }
      ]
    }
  });
  await prisma.academicYearEnrollment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.studentGuardian.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.student.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableAssignment.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableTeacher.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableSubject.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.timetableClassSection.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.user.deleteMany({ where: { id: { startsWith: PREFIX } } });
  await prisma.guardian.deleteMany({ where: { id: { startsWith: PREFIX } } });
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
  const attendanceSessionWhere: Prisma.StudentAttendanceSessionWhereInput = {
    OR: [
      { id: { startsWith: PREFIX } },
      { className: { startsWith: `${LABEL}-` } },
      { takenByUserId: { startsWith: PREFIX } },
      { submittedByUserId: { startsWith: PREFIX } },
      { lockedByUserId: { startsWith: PREFIX } },
      { records: { some: { studentId: { startsWith: PREFIX } } } }
    ]
  };
  const attendanceRecordWhere: Prisma.StudentAttendanceRecordWhereInput = {
    OR: [
      { id: { startsWith: PREFIX } },
      { studentId: { startsWith: PREFIX } },
      { session: attendanceSessionWhere }
    ]
  };
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
    audits,
    guardians,
    studentGuardians
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
    prisma.studentAttendanceSession.count({ where: attendanceSessionWhere }),
    prisma.studentAttendanceRecord.count({ where: attendanceRecordWhere }),
    prisma.userAudit.count({
      where: {
        OR: [
          { actorUserId: { startsWith: PREFIX } },
          { targetUserId: { startsWith: PREFIX } }
        ]
      }
    }),
    prisma.guardian.count({ where: { id: { startsWith: PREFIX } } }),
    prisma.studentGuardian.count({ where: { id: { startsWith: PREFIX } } })
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
    audits,
    guardians,
    studentGuardians
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
