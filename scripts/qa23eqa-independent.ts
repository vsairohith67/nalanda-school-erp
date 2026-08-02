import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  captureAttendanceCalendarBasis,
  createAcademicCalendarVersion,
  createSchoolCalendarEvent,
  currentReportCalendarBasis,
  getAcademicCalendarVersion,
  loadPublishedSchoolCalendar,
  normalizeOperationalDays,
  saveAcademicCalendarDraft,
  transitionAcademicCalendar,
  transitionSchoolCalendarEvent,
  updateSchoolCalendarEventDraft
} from "../lib/academic-calendar";
import { createExaminationTimetable, saveExaminationTimetableDraft, transitionExaminationTimetable } from "../lib/examination-timetables";
import { listChildContexts, listRoleContexts, switchChildContext, switchRoleContext } from "../lib/iam/contexts";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import type { Role } from "../lib/permissions";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const WORKSPACE = path.resolve(".");
const OPERATIONAL = path.join(WORKSPACE, "prisma", "dev.db");
const QA_PARENT = path.join(WORKSPACE, "tmp", "cal23eqa");
const ROOT = path.join(QA_PARENT, `CAL23EQA-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "CAL23EQA-copied.db");
const RESTORE_DATABASE = path.join(ROOT, "CAL23EQA-restore.db");
const PREFIX = `CAL23EQA-${process.pid}`;
const YEAR = "2026-27";
const CLASS_NAME = "VII";
const SECTION_A = `Q${process.pid}A`;
const SECTION_B = `Q${process.pid}B`;
const secret = randomBytes(48).toString("base64url");
let stage = "preflight";

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function actor(entry: FixtureUser, role: Role = entry.primaryRole) { const assignment = entry.assignments.find((row) => row.role === role); invariant(assignment, `CAL23EQA_${role}_ASSIGNMENT_MISSING`); return { id: entry.user.id, name: entry.user.name, role, roleAssignmentId: assignment.id, sessionId: entry.sessionId ?? undefined }; }
function denied(work: () => Promise<unknown>) { return work().then(() => false, () => true); }
function runPrisma(args: string[], file = DATABASE) { const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs"); invariant(existsSync(pnpm), "CAL23EQA_PNPM_RUNTIME_MISSING"); const result = spawnSync(process.execPath, [pnpm, "exec", "prisma", ...args], { cwd: WORKSPACE, env: { ...process.env, DATABASE_URL: databaseUrl(file), SESSION_SECRET: secret, AUTH_SECRET: secret }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }); if (result.error || result.status !== 0) throw new Error(`CAL23EQA_PRISMA_FAILED:${args.join(" ")}:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`); return `${result.stdout}\n${result.stderr}`; }
function cleanup() { const resolved = path.resolve(ROOT); invariant(resolved.startsWith(`${path.resolve(QA_PARENT)}${path.sep}`), "CAL23EQA_CLEANUP_SCOPE_REFUSED"); if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true }); if (existsSync(QA_PARENT) && readdirSync(QA_PARENT).length === 0) rmdirSync(QA_PARENT); }

type FixtureUser = { user: any; assignments: any[]; primaryRole: Role; sessionId: string | null };
async function createUser(client: PrismaClient, slug: string, roles: Role[], guardianId?: string, options?: { active?: boolean; assignmentStatus?: string; validUntil?: Date }) : Promise<FixtureUser> {
  const active = options?.active !== false;
  const user = await client.user.create({ data: { iamPublicKey: randomUUID(), name: `${PREFIX} ${slug}`, username: `${PREFIX}-${slug}`.toLowerCase(), passwordHash: "CAL23EQA-NO-LOGIN", role: roles[0], guardianId: guardianId ?? null, isActive: active, lifecycleStatus: active ? "ACTIVE" : "INACTIVE" } });
  const assignments = [];
  const expired = Boolean(options?.validUntil && options.validUntil <= new Date());
  const assignmentStatus = options?.assignmentStatus ?? "ACTIVE";
  for (const role of roles) assignments.push(await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role, status: assignmentStatus, validFrom: expired ? new Date(options!.validUntil!.getTime() - 86_400_000) : undefined, validUntil: options?.validUntil ?? null, reason: "CAL23EQA copied-database fixture", assignedByUserId: user.id, endedByUserId: assignmentStatus === "ACTIVE" ? null : user.id, endedAt: assignmentStatus === "ACTIVE" ? null : new Date(), activeKey: assignmentStatus !== "ACTIVE" || expired ? null : `${user.id}:${role}` } }));
  let sessionId: string | null = null;
  if (active && assignments.some((row) => row.status === "ACTIVE" && (!row.validUntil || row.validUntil > new Date()))) {
    const primary = assignments.find((row) => row.status === "ACTIVE" && (!row.validUntil || row.validUntil > new Date()));
    invariant(primary, "CAL23EQA_ACTIVE_ROLE_ASSIGNMENT_MISSING");
    const session = await client.authSession.create({ data: { userId: user.id, tokenHash: randomBytes(32).toString("hex"), credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion, activeRoleAssignmentId: primary.id, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "CAL23EQA copied database", browserSummary: "CAL23EQA independent", networkEvidenceMasked: "local" } });
    sessionId = session.id;
  }
  return { user, assignments, primaryRole: roles[0], sessionId };
}

async function createStudent(client: PrismaClient, suffix: string, className: string, section: string) { const student = await client.student.create({ data: { admissionNo: `${PREFIX}-${suffix}`, studentName: `${PREFIX} Child ${suffix}`, fatherName: "Synthetic", className, section, phone1: "0000000000" } }); await client.academicYearEnrollment.create({ data: { studentId: student.id, academicYear: YEAR, className, section, status: "ACTIVE" } }); return student; }

async function publishEvent(client: PrismaClient, principal: FixtureUser, input: Record<string, unknown>) {
  const base = await createSchoolCalendarEvent(client, { academicYear: YEAR, eventType: "SCHOOL_FUNCTION", title: `${PREFIX} event`, startsAt: "2026-08-18T09:00:00+05:30", endsAt: "2026-08-18T10:00:00+05:30", audienceType: "SCHOOL_WIDE", ...input }, actor(principal));
  let version = base.versions[0];
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "ready", expectedVersion: version.version }, actor(principal));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "approve", expectedVersion: version.version, reason: "Independent audience preview reviewed" }, actor(principal));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "publish", expectedVersion: version.version, reason: "Independent governed publication", idempotencyKey: `${PREFIX}-${String(input.audienceType ?? "school")}-${randomUUID()}` }, actor(principal));
  return { base, version };
}

async function main() {
  cleanup(); mkdirSync(ROOT, { recursive: true });
  assertSqliteCopyReady(OPERATIONAL, "CAL23EQA_OPERATIONAL");
  const operationalBefore = snapshotSqliteArtifacts(OPERATIONAL);
  copyFileSync(OPERATIONAL, DATABASE); copyFileSync(OPERATIONAL, RESTORE_DATABASE);
  Object.assign(process.env, { DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, NODE_ENV: "test" });
  stage = "migration";
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]); runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  invariant(/up to date/i.test(runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"])), "CAL23EQA_MIGRATION_DIRTY");
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], RESTORE_DATABASE);

  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    stage = "fresh matrix";
    const classA = await client.timetableClassSection.create({ data: { academicYear: YEAR, className: CLASS_NAME, section: SECTION_A, displayName: `${CLASS_NAME}-${SECTION_A}`, groupName: PREFIX, isActive: true } });
    const classB = await client.timetableClassSection.create({ data: { academicYear: YEAR, className: CLASS_NAME, section: SECTION_B, displayName: `${CLASS_NAME}-${SECTION_B}`, groupName: PREFIX, isActive: true } });
    await client.timetableClassSection.create({ data: { academicYear: "2025-26", className: "VI", section: `Q${process.pid}O`, displayName: `VI-Q${process.pid}O`, groupName: PREFIX, isActive: true } });
    const subject = await client.timetableSubject.create({ data: { name: `${PREFIX} General`, shortName: `${PREFIX}-G`, department: "Synthetic", isActive: true } });
    const guardians = await Promise.all(["one", "many", "teacher-parent", "director-parent", "removed"].map((name, index) => client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} ${name}`, primaryMobile: `90002350${index}` } })));
    const [childA, childB, removedChild] = await Promise.all([createStudent(client, "001", CLASS_NAME, SECTION_A), createStudent(client, "002", CLASS_NAME, SECTION_B), createStudent(client, "003", CLASS_NAME, SECTION_A)]);
    await client.studentGuardian.createMany({ data: [{ guardianId: guardians[0].id, studentId: childA.id, isPrimaryContact: true }, { guardianId: guardians[1].id, studentId: childA.id, isPrimaryContact: true }, { guardianId: guardians[1].id, studentId: childB.id }, { guardianId: guardians[2].id, studentId: childA.id }, { guardianId: guardians[3].id, studentId: childB.id }] });
    const removedLink = await client.studentGuardian.create({ data: { guardianId: guardians[4].id, studentId: removedChild.id, isPrimaryContact: true } });

    const superAdminA = await createUser(client, "super-admin-a", ["SUPER_ADMIN"]); const superAdminB = await createUser(client, "super-admin-b", ["SUPER_ADMIN"]);
    const principal = await createUser(client, "principal", ["PRINCIPAL"]); const teacherA = await createUser(client, "teacher-a", ["TEACHER"]); const teacherB = await createUser(client, "teacher-b", ["TEACHER"]);
    const parentOne = await createUser(client, "parent-one", ["PARENT"], guardians[0].id); const parentMany = await createUser(client, "parent-many", ["PARENT"], guardians[1].id);
    const teacherParent = await createUser(client, "teacher-parent", ["TEACHER", "PARENT"], guardians[2].id); const directorParent = await createUser(client, "director-parent", ["DIRECTOR", "PARENT"], guardians[3].id);
    const viewer = await createUser(client, "viewer", ["VIEWER"]); const accountant = await createUser(client, "accountant", ["ACCOUNTANT"]); const removedParent = await createUser(client, "removed-parent", ["PARENT"], guardians[4].id);
    await createUser(client, "inactive-parent", ["PARENT"], undefined, { active: false });
    await createUser(client, "expired-teacher", ["TEACHER"], undefined, { validUntil: new Date(Date.now() - 60_000) });
    await createUser(client, "ended-parent-role", ["PARENT"], undefined, { assignmentStatus: "ENDED" });
    invariant([superAdminA, superAdminB].every((entry) => entry.sessionId), "CAL23EQA_TWO_SUPER_ADMINS_MISSING");

    const timetableTeacherA = await client.timetableTeacher.create({ data: { name: teacherA.user.name, shortName: `${PREFIX}-TA`, isActive: true, maxPeriodsPerWeek: 30 } });
    const timetableTeacherB = await client.timetableTeacher.create({ data: { name: teacherB.user.name, shortName: `${PREFIX}-TB`, isActive: true, maxPeriodsPerWeek: 30 } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${PREFIX}-STA`, fullName: teacherA.user.name, designation: "Teacher", status: "ACTIVE", userId: teacherA.user.id, timetableTeacherId: timetableTeacherA.id } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${PREFIX}-STB`, fullName: teacherB.user.name, designation: "Teacher", status: "ACTIVE", userId: teacherB.user.id, timetableTeacherId: timetableTeacherB.id } });
    await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classA.id, subjectId: subject.id, teacherId: timetableTeacherA.id, periodsPerWeek: 5 } });
    await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classB.id, subjectId: subject.id, teacherId: timetableTeacherB.id, periodsPerWeek: 5 } });

    stage = "examination reference";
    const examination = await client.examination.create({ data: { examCode: `${PREFIX}-TERM`, academicYear: YEAR, name: "Independent Term Examination", examType: "TERM", startDate: new Date("2026-09-01T00:00:00Z"), endDate: new Date("2026-09-05T00:00:00Z"), status: "ACTIVE", createdByUserId: principal.user.id, activatedByUserId: principal.user.id, activatedAt: new Date() } });
    const examScope = await client.examinationClassScope.create({ data: { examinationId: examination.id, academicYear: YEAR, className: CLASS_NAME, section: SECTION_A, timetableClassSectionId: classA.id, status: "ACTIVE", createdByUserId: principal.user.id } });
    const paper = await client.examSubjectPaper.create({ data: { examinationId: examination.id, classScopeId: examScope.id, academicYear: YEAR, className: CLASS_NAME, section: SECTION_A, timetableSubjectId: subject.id, subjectNameSnapshot: "General", paperCode: "P1", paperName: "General Paper", displayOrder: 1, status: "ACTIVE", createdByUserId: principal.user.id } });
    let timetable = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: examScope.id, idempotencyKey: `${PREFIX}-EXAM-CREATE` }, actor(principal));
    timetable = await saveExaminationTimetableDraft(client, timetable.id, { expectedVersion: timetable.version, parentInstructions: "Bring the school identity card.", rows: [{ subjectPaperId: paper.id, examDate: "2026-09-02", startTime: "09:00", endTime: "11:00", reportingTime: "08:30", venue: "Room 7", displayOrder: 1 }] }, actor(principal));
    timetable = await transitionExaminationTimetable(client, timetable.id, { action: "ready", expectedVersion: timetable.version }, actor(principal));
    timetable = await transitionExaminationTimetable(client, timetable.id, { action: "publish", expectedVersion: timetable.version, reason: "Independent timetable publication" }, actor(principal));

    stage = "calendar day governance";
    invariant(await denied(async () => normalizeOperationalDays([{ dayDate: "2026-08-10", dayType: "WORKING_DAY", title: "A" }, { dayDate: "2026-08-10", dayType: "NON_WORKING_DAY", title: "B" }])), "CAL23EQA_OVERLAP_ALLOWED");
    invariant(await denied(async () => normalizeOperationalDays([{ dayDate: "invalid", dayType: "WORKING_DAY", title: "A" }])), "CAL23EQA_INVALID_DATE_ALLOWED");
    let calendar = await createAcademicCalendarVersion(client, { academicYear: YEAR, effectiveScope: "SCHOOL_WIDE", title: `${PREFIX} Academic Calendar` }, actor(principal));
    calendar = await saveAcademicCalendarDraft(client, calendar.publicKey, { expectedVersion: calendar.version, emergencyPermissionConfirmed: true, days: [
      { dayDate: "2026-08-10", dayType: "WORKING_DAY", title: "Working" }, { dayDate: "2026-08-11", dayType: "NON_WORKING_DAY", title: "Entered holiday" }, { dayDate: "2026-08-12", dayType: "HALF_DAY", halfDaySession: "Morning", title: "Half day" }, { dayDate: "2026-08-13", dayType: "VACATION_DAY", title: "Vacation" }, { dayDate: "2026-08-14", dayType: "SPECIAL_WORKING_DAY", title: "Special working" }, { dayDate: "2026-08-15", dayType: "EMERGENCY_CLOSURE", title: "Closure", reason: "Independent safety closure" }
    ] }, actor(principal));
    calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "ready", expectedVersion: calendar.version }, actor(principal));
    calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "approve", expectedVersion: calendar.version, reason: "Independent totals reviewed" }, actor(principal));
    calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "publish", expectedVersion: calendar.version, reason: "Independent initial publication", idempotencyKey: `${PREFIX}-CAL-1` }, actor(principal));
    const totals = (await getAcademicCalendarVersion(client, calendar.publicKey)).preview.totals;
    invariant(totals.workingDays === 1 && totals.nonWorkingDays === 1 && totals.halfDays === 1 && totals.vacationDays === 1 && totals.specialWorkingDays === 1 && totals.emergencyClosures === 1, "CAL23EQA_TOTALS_WRONG");
    const attendance = await client.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-10T00:00:00Z"), className: CLASS_NAME, section: SECTION_A, academicYear: YEAR, status: "SUBMITTED", takenByUserId: principal.user.id, submittedByUserId: principal.user.id, submittedAt: new Date(), records: { create: { studentId: childA.id, admissionNo: childA.admissionNo, status: "PRESENT" } } } });
    const lockedBasis = await captureAttendanceCalendarBasis(client, { academicYear: YEAR, attendanceDate: new Date("2026-08-10T00:00:00Z"), className: CLASS_NAME, section: SECTION_A });
    invariant(lockedBasis.operationalCalendarVersionKey === calendar.publicKey, "CAL23EQA_ATTENDANCE_BASIS_WRONG");
    const reportBasis = await currentReportCalendarBasis(client, { academicYear: YEAR, className: CLASS_NAME, section: SECTION_A });
    invariant(reportBasis.calendarBasisVersionKey === calendar.publicKey, "CAL23EQA_REPORT_BASIS_WRONG");

    let replacement = await transitionAcademicCalendar(client, calendar.publicKey, { action: "create_replacement", reason: "Correct posted attendance date" }, actor(principal));
    replacement = await saveAcademicCalendarDraft(client, replacement.publicKey, { expectedVersion: replacement.version, emergencyPermissionConfirmed: true, days: replacement.days.map((day: any) => ({ dayDate: day.dayDate.toISOString().slice(0, 10), dayType: day.dayDate.toISOString().startsWith("2026-08-10") ? "NON_WORKING_DAY" : day.dayType, sourceType: day.sourceType, scopeType: day.scopeType, title: day.title, halfDaySession: day.halfDaySession, publicInstructions: day.publicInstructions, reason: day.reason })) }, actor(principal));
    const impact = (await getAcademicCalendarVersion(client, replacement.publicKey)).preview;
    invariant(impact.postedAttendanceSessions === 1 && impact.attendanceRecordsWillBeRewritten === false && impact.differences.length === 1, "CAL23EQA_IMPACT_PREVIEW_WRONG");
    replacement = await transitionAcademicCalendar(client, replacement.publicKey, { action: "ready", expectedVersion: replacement.version }, actor(principal));
    replacement = await transitionAcademicCalendar(client, replacement.publicKey, { action: "approve", expectedVersion: replacement.version, reason: "Independent impact reviewed" }, actor(principal));
    const publishExpected = replacement.version;
    const concurrent = await Promise.allSettled([transitionAcademicCalendar(client, replacement.publicKey, { action: "publish", expectedVersion: publishExpected, reason: "Independent correction", impactReason: "Attendance stays locked", idempotencyKey: `${PREFIX}-CAL-2A` }, actor(principal)), transitionAcademicCalendar(client, replacement.publicKey, { action: "publish", expectedVersion: publishExpected, reason: "Independent correction", impactReason: "Attendance stays locked", idempotencyKey: `${PREFIX}-CAL-2B` }, actor(principal))]);
    invariant(concurrent.some((result) => result.status === "fulfilled") && concurrent.some((result) => result.status === "rejected"), "CAL23EQA_CONCURRENT_PUBLICATION_NOT_PROTECTED");
    replacement = await client.academicCalendarVersion.findUniqueOrThrow({ where: { publicKey: replacement.publicKey }, include: { days: true } });
    await transitionAcademicCalendar(client, replacement.publicKey, { action: "publish", expectedVersion: publishExpected, reason: "Independent correction", impactReason: "Attendance stays locked", idempotencyKey: replacement.idempotencyKey }, actor(principal));
    invariant(await client.studentAttendanceRecord.count({ where: { sessionId: attendance.id } }) === 1, "CAL23EQA_ATTENDANCE_REWRITTEN");
    invariant((await captureAttendanceCalendarBasis(client, { academicYear: YEAR, attendanceDate: new Date("2026-08-10T00:00:00Z"), className: CLASS_NAME, section: SECTION_A })).operationalCalendarVersionKey === replacement.publicKey, "CAL23EQA_CURRENT_BASIS_NOT_REPLACED");
    invariant(lockedBasis.operationalCalendarVersionKey === calendar.publicKey && reportBasis.calendarBasisVersionKey === calendar.publicKey, "CAL23EQA_LOCKED_BASIS_MUTATED");

    const auditBefore = await client.academicCalendarAuditEvent.count();
    invariant(await denied(() => client.$transaction(async (tx) => { await tx.academicCalendarAuditEvent.create({ data: { entityType: "OPERATIONAL_CALENDAR", calendarVersionId: replacement.id, eventType: "CAL23EQA_FORCED_FAILURE", actorUserId: principal.user.id, actorLabel: principal.user.name, snapshotJson: "{}" } }); throw new Error("forced rollback"); })), "CAL23EQA_FORCED_FAILURE_DID_NOT_FAIL");
    invariant(await client.academicCalendarAuditEvent.count() === auditBefore, "CAL23EQA_FORCED_FAILURE_NOT_ROLLED_BACK");
    invariant(await denied(() => client.$executeRawUnsafe(`UPDATE "AcademicCalendarVersion" SET "status"='DRAFT' WHERE "id"=?`, replacement.id)), "CAL23EQA_CALENDAR_DOWNGRADE_ALLOWED");
    invariant(await denied(() => client.$executeRawUnsafe(`UPDATE "OperationalCalendarDay" SET "title"='tampered' WHERE "calendarVersionId"=?`, replacement.id)), "CAL23EQA_PUBLISHED_DAY_MUTATED");

    stage = "all event audiences";
    const school = await publishEvent(client, principal, { title: `${PREFIX} School wide`, audienceType: "SCHOOL_WIDE" });
    const staff = await publishEvent(client, principal, { title: `${PREFIX} Staff only`, eventType: "STAFF_MEETING", audienceType: "STAFF_ONLY", isImportant: true });
    const parentsAll = await publishEvent(client, principal, { title: `${PREFIX} Parents all`, audienceType: "PARENTS_ALL" });
    const accountantOnly = await publishEvent(client, principal, { title: `${PREFIX} Accountant role`, audienceType: "ROLE_SPECIFIC", roleScope: "ACCOUNTANT" });
    const classEvent = await publishEvent(client, principal, { title: `${PREFIX} Class`, eventType: "CLASS_EVENT", audienceType: "CLASS", className: CLASS_NAME });
    const sectionEvent = await publishEvent(client, principal, { title: `${PREFIX} Section A`, eventType: "CLASS_EVENT", audienceType: "CLASS_SECTION", className: CLASS_NAME, section: SECTION_A });
    const cohortEvent = await publishEvent(client, principal, { title: `${PREFIX} Cohort A`, eventType: "CLASS_EVENT", audienceType: "LINKED_CHILD_COHORT", className: CLASS_NAME, section: SECTION_A });
    const leadership = await publishEvent(client, principal, { title: `${PREFIX} Leadership`, audienceType: "LEADERSHIP_ONLY", isImportant: true });
    const examEvent = await publishEvent(client, principal, { title: `${PREFIX} Examination timetable`, eventType: "EXAMINATION_REFERENCE", audienceType: "CLASS_SECTION", className: CLASS_NAME, section: SECTION_A, examinationTimetableKey: timetable.publicKey });
    const draft = await createSchoolCalendarEvent(client, { academicYear: YEAR, eventType: "ACTIVITY", title: `${PREFIX} Draft hidden`, startsAt: "2026-08-19", endsAt: "2026-08-19", audienceType: "SCHOOL_WIDE" }, actor(principal));

    stage = "event replacement draft";
    let schoolReplacement = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "create_replacement", reason: "Independent reporting time change" }, actor(principal));
    const updatedSchoolBase = await updateSchoolCalendarEventDraft(client, school.base.publicKey, { expectedVersion: schoolReplacement.version, title: `${PREFIX} School wide changed`, eventType: schoolReplacement.eventType, startsAt: schoolReplacement.startsAt.toISOString(), endsAt: schoolReplacement.endsAt.toISOString(), audienceType: schoolReplacement.audienceType }, actor(principal));
    schoolReplacement = updatedSchoolBase.versions[0];
    stage = "event replacement review";
    schoolReplacement = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "ready", expectedVersion: schoolReplacement.version }, actor(principal));
    schoolReplacement = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "approve", expectedVersion: schoolReplacement.version, reason: "Independent replacement reviewed" }, actor(principal));
    stage = "event replacement publish";
    schoolReplacement = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "publish", expectedVersion: schoolReplacement.version, reason: "Independent event replacement", idempotencyKey: `${PREFIX}-EVENT-REPLACE` }, actor(principal));
    stage = "event withdrawal";
    const withdrawn = await transitionSchoolCalendarEvent(client, staff.base.publicKey, { action: "withdraw", expectedVersion: staff.version.version, reason: "Independent withdrawal" }, actor(principal));
    stage = "event archive";
    const archived = await transitionSchoolCalendarEvent(client, staff.base.publicKey, { action: "archive", expectedVersion: withdrawn.version, reason: "Independent archive" }, actor(principal));
    invariant(archived.status === "ARCHIVED" && schoolReplacement.status === "PUBLISHED", "CAL23EQA_EVENT_HISTORY_WRONG");
    invariant(await denied(() => client.$executeRawUnsafe(`UPDATE "SchoolCalendarEventVersion" SET "status"='DRAFT' WHERE "id"=?`, schoolReplacement.id)), "CAL23EQA_EVENT_DOWNGRADE_ALLOWED");
    invariant(await denied(() => client.$executeRawUnsafe(`UPDATE "SchoolCalendarEvent" SET "currentPublishedVersionId"=? WHERE "id"=?`, accountantOnly.version.id, school.base.id)), "CAL23EQA_CROSS_EVENT_POINTER_ALLOWED");

    stage = "privacy and contexts";
    const parentContexts = await listChildContexts(client, { userId: parentOne.user.id, sessionId: parentOne.sessionId! }); const parentChild = parentContexts.children[0];
    stage = "parent exact scope";
    const parentView = await loadPublishedSchoolCalendar(client, actor(parentOne, "PARENT"), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30", childHandle: parentChild.handle, expectedContextVersion: parentContexts.contextVersion });
    const parentTitles = new Set(parentView.events.map((event) => event.title));
    for (const allowed of [`${PREFIX} School wide changed`, parentsAll.version.title, classEvent.version.title, sectionEvent.version.title, cohortEvent.version.title, examEvent.version.title]) invariant(parentTitles.has(allowed), `CAL23EQA_PARENT_ALLOWED_MISSING:${allowed}`);
    for (const forbidden of [leadership.version.title, accountantOnly.version.title, staff.version.title, draft.versions[0].title]) invariant(!parentTitles.has(forbidden), `CAL23EQA_PARENT_LEAK:${forbidden}`);
    stage = "teacher exact scope";
    const teacherAView = await loadPublishedSchoolCalendar(client, actor(teacherA), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30" });
    invariant(teacherAView.events.some((event) => event.title === sectionEvent.version.title) && !teacherAView.events.some((event) => event.title.includes("Section B")), "CAL23EQA_TEACHER_SCOPE_WRONG");
    const teacherBView = await loadPublishedSchoolCalendar(client, actor(teacherB), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30" });
    invariant(!teacherBView.events.some((event) => event.title === sectionEvent.version.title), "CAL23EQA_UNRELATED_TEACHER_LEAK");
    stage = "other role scope";
    const accountantView = await loadPublishedSchoolCalendar(client, actor(accountant), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30" });
    invariant(accountantView.events.some((event) => event.title === accountantOnly.version.title), "CAL23EQA_ROLE_SPECIFIC_MISSING");
    const viewerView = await loadPublishedSchoolCalendar(client, actor(viewer), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30" });
    invariant(viewerView.events.every((event) => event.audienceType === "SCHOOL_WIDE"), "CAL23EQA_VIEWER_SCOPE_LEAK");
    stage = "multi child scope";
    const manyContexts = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId! }); invariant(manyContexts.children.length === 2, "CAL23EQA_MULTI_CHILD_MISSING");
    const originalAHandle = manyContexts.children.find((child) => child.section === SECTION_A)!.handle;
    await switchChildContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId!, handle: originalAHandle, expectedVersion: manyContexts.contextVersion });
    const selectedAContexts = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId! });
    const viewA = await loadPublishedSchoolCalendar(client, actor(parentMany, "PARENT"), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30", childHandle: selectedAContexts.children.find((child) => child.section === SECTION_A)!.handle, expectedContextVersion: selectedAContexts.contextVersion });
    await switchChildContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId!, handle: selectedAContexts.children.find((child) => child.section === SECTION_B)!.handle, expectedVersion: selectedAContexts.contextVersion });
    const selectedBContexts = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId! });
    const viewB = await loadPublishedSchoolCalendar(client, actor(parentMany, "PARENT"), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30", childHandle: selectedBContexts.children.find((child) => child.section === SECTION_B)!.handle, expectedContextVersion: selectedBContexts.contextVersion });
    invariant(viewA.events.some((event) => event.title === sectionEvent.version.title) && !viewB.events.some((event) => event.title === sectionEvent.version.title), "CAL23EQA_CHILD_SWITCH_SCOPE_WRONG");
    invariant(await denied(() => loadPublishedSchoolCalendar(client, actor(parentMany, "PARENT"), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30", childHandle: originalAHandle, expectedContextVersion: manyContexts.contextVersion })), "CAL23EQA_STALE_CHILD_HANDLE_ALLOWED");
    stage = "teacher parent role switch";
    const teacherParentRoles = await listRoleContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId! }); invariant(teacherParentRoles.pickerRequired && teacherParentRoles.contexts.length === 2, "CAL23EQA_TEACHER_PARENT_ROLE_PICKER_WRONG");
    invariant(await denied(() => listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId! })), "CAL23EQA_CHILD_CONTEXT_IN_TEACHER_ROLE");
    const parentRole = teacherParentRoles.contexts.find((context) => context.label === "Parent")!; await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId!, handle: parentRole.handle, expectedVersion: teacherParentRoles.contextVersion });
    invariant((await listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId! })).children.length === 1, "CAL23EQA_TEACHER_PARENT_SWITCH_FAILED");
    stage = "director parent role switch";
    const directorRoles = await listRoleContexts(client, { userId: directorParent.user.id, sessionId: directorParent.sessionId! }); invariant(directorRoles.pickerRequired, "CAL23EQA_DIRECTOR_PARENT_ROLE_PICKER_WRONG");
    stage = "removed guardian stale scope";
    const removedContexts = await listChildContexts(client, { userId: removedParent.user.id, sessionId: removedParent.sessionId! }); const staleRemoved = removedContexts.children[0]; await client.studentGuardian.delete({ where: { id: removedLink.id } });
    invariant(await denied(() => loadPublishedSchoolCalendar(client, actor(removedParent, "PARENT"), { academicYear: YEAR, from: "2026-08-01", to: "2026-09-30", childHandle: staleRemoved.handle, expectedContextVersion: removedContexts.contextVersion })), "CAL23EQA_REMOVED_GUARDIAN_ALLOWED");

    stage = "notification isolation";
    const staffCampaign = await client.notificationCampaign.findUniqueOrThrow({ where: { campaignNumber: `CAL23E-${staff.base.eventNumber}-V1` }, include: { recipients: true } });
    invariant(staffCampaign.recipients.every((recipient) => recipient.recipientRoleSnapshot !== "PARENT"), "CAL23EQA_STAFF_NOTIFICATION_PARENT_LEAK");
    const leaderCampaign = await client.notificationCampaign.findUniqueOrThrow({ where: { campaignNumber: `CAL23E-${leadership.base.eventNumber}-V1` }, include: { recipients: true } });
    invariant(leaderCampaign.recipients.every((recipient) => ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(recipient.recipientRoleSnapshot)), "CAL23EQA_LEADERSHIP_NOTIFICATION_LEAK");
    const campaignsBefore = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "CAL23E-" } } });
    await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "publish", expectedVersion: schoolReplacement.version - 1, reason: "Independent event replacement", idempotencyKey: schoolReplacement.idempotencyKey }, actor(principal));
    invariant(await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "CAL23E-" } } }) === campaignsBefore, "CAL23EQA_NOTIFICATION_RETRY_DUPLICATED");

    stage = "backup and restore";
    const backup = await generateFullBackup(client, { generatedBy: `${PREFIX} independent QA` }); const parsed = parseAndValidateBackup(backup);
    invariant(parsed.academicCalendarVersions.filter((row) => row.academicYear === YEAR).length === 2 && parsed.schoolCalendarEventVersions.filter((row) => String(row.title).startsWith(PREFIX)).length >= 10, "CAL23EQA_BACKUP_MISSING_HISTORY");
    const restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(RESTORE_DATABASE) });
    try {
      const restoreActor = await restoreClient.user.findFirstOrThrow({ where: { role: "SUPER_ADMIN", isActive: true } });
      const first = await restoreValidatedBackup(restoreClient, parsed, restoreActor); const second = await restoreValidatedBackup(restoreClient, parsed, restoreActor);
      const errors = [first, second].flatMap((result) => Object.entries(result).flatMap(([key, value]: any) => value?.errors?.length ? [`${key}:${value.errors.join("|")}`] : []));
      invariant(!errors.length, `CAL23EQA_RESTORE_ERRORS:${errors.join(";")}`);
      invariant(await restoreClient.academicCalendarVersion.count({ where: { academicYear: YEAR } }) === 2, "CAL23EQA_RESTORE_CALENDAR_DUPLICATED");
      invariant(await restoreClient.schoolCalendarEventVersion.count({ where: { event: { academicYear: YEAR } } }) === await client.schoolCalendarEventVersion.count({ where: { event: { academicYear: YEAR } } }), "CAL23EQA_RESTORE_EVENT_MISMATCH");
    } finally { await restoreClient.$disconnect(); }

    assertSqliteCopyReady(OPERATIONAL, "CAL23EQA_OPERATIONAL"); assertSqliteSnapshotUnchanged(operationalBefore, snapshotSqliteArtifacts(OPERATIONAL), "CAL23EQA_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "CAL23EQA_INDEPENDENT_PASSED", copiedDatabase: true, users: 15, superAdmins: 2, audiences: 8, calendarDayTypes: 6, calendarVersions: 2, eventVersions: await client.schoolCalendarEventVersion.count({ where: { event: { academicYear: YEAR } } }), attendanceRewritten: false, examinationReference: true, multiRoleUsers: 2, multiChildContexts: 2, notificationDeduplication: true, concurrentPublicationProtected: true, forcedFailureRolledBack: true, restoreRuns: 2, operationalMutation: false }));
  } finally { await client.$disconnect(); }
}

main().catch((error) => { console.error(JSON.stringify({ result: "CAL23EQA_INDEPENDENT_FAILED", stage, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }).finally(() => {
  try { cleanup(); invariant(!existsSync(ROOT), "CAL23EQA_CLEANUP_FIRST_INSPECTION_FAILED"); cleanup(); invariant(!existsSync(ROOT), "CAL23EQA_CLEANUP_SECOND_INSPECTION_FAILED"); }
  catch (error) { console.error(`CAL23EQA_CLEANUP_FAILED:${String(error)}`); process.exitCode = 1; }
});
