import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, rmdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";
import { createAcademicCalendarVersion, createSchoolCalendarEvent, getAcademicCalendarVersion, loadPublishedSchoolCalendar, saveAcademicCalendarDraft, transitionAcademicCalendar, transitionSchoolCalendarEvent } from "../lib/academic-calendar";
import { listChildContexts } from "../lib/iam/contexts";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";

const WORKSPACE = path.resolve(".");
const OPERATIONAL = path.join(WORKSPACE, "prisma", "dev.db");
const QA_PARENT = path.join(WORKSPACE, "tmp", "cal23e");
const ROOT = path.join(QA_PARENT, `CAL23E-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "CAL23E-copied.db");
const RESTORE_DATABASE = path.join(ROOT, "CAL23E-restore.db");
const PREFIX = `CAL23E-${process.pid}`;
const YEAR = "2026-27";
const SECTION_A = "E23A";
const SECTION_B = "E23B";
const secret = randomBytes(48).toString("base64url");
let stage = "preflight";

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function url(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function runPrisma(args: string[], file = DATABASE) { const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs"); invariant(existsSync(pnpm), "CAL23E_PNPM_RUNTIME_MISSING"); const result = spawnSync(process.execPath, [pnpm, "exec", "prisma", ...args], { cwd: WORKSPACE, env: { ...process.env, DATABASE_URL: url(file), SESSION_SECRET: secret, AUTH_SECRET: secret }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true }); if (result.error || result.status !== 0) throw new Error(`CAL23E_PRISMA_FAILED:${args.join(" ")}:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`); return `${result.stdout}\n${result.stderr}`; }
function cleanup() { const resolved = path.resolve(ROOT); invariant(resolved.startsWith(`${path.resolve(QA_PARENT)}${path.sep}`), "CAL23E_CLEANUP_SCOPE_REFUSED"); if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true }); if (existsSync(QA_PARENT) && readdirSync(QA_PARENT).length === 0) rmdirSync(QA_PARENT); }
function actor(user: any) { return { id: user.id, name: user.name, role: user.role, roleAssignmentId: "" }; }

async function user(client: PrismaClient, slug: string, role: string, guardianId?: string, extraRoles: string[] = []) {
  const created = await client.user.create({ data: { iamPublicKey: randomUUID(), name: `${PREFIX} ${slug}`, username: `${PREFIX}-${slug}`.toLowerCase(), passwordHash: "CAL23E-NO-LOGIN", role, guardianId: guardianId ?? null } });
  const assignments = [];
  for (const item of [role, ...extraRoles]) assignments.push(await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: created.id, role: item, reason: "CAL23E copied-database fixture", assignedByUserId: created.id, activeKey: `${created.id}:${item}` } }));
  const active = assignments[0];
  const session = await client.authSession.create({ data: { userId: created.id, tokenHash: randomBytes(32).toString("hex"), credentialVersion: created.credentialVersion, authorizationVersion: created.authorizationVersion, activeRoleAssignmentId: active.id, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "CAL23E copied database", browserSummary: "CAL23E QA", networkEvidenceMasked: "local" } });
  return { user: created, assignments, assignmentId: active.id, sessionId: session.id };
}

async function student(client: PrismaClient, suffix: string, className: string, section: string) { const created = await client.student.create({ data: { admissionNo: `${PREFIX}-${suffix}`, studentName: `${PREFIX} Child ${suffix}`, fatherName: "Synthetic", className, section, phone1: "0000000000" } }); await client.academicYearEnrollment.create({ data: { studentId: created.id, academicYear: YEAR, className, section, status: "ACTIVE" } }); return created; }

async function publishEvent(client: PrismaClient, principal: any, input: Record<string, unknown>) {
  const base = await createSchoolCalendarEvent(client, { academicYear: YEAR, startsAt: "2026-08-12T09:00:00+05:30", endsAt: "2026-08-12T10:00:00+05:30", eventType: "SCHOOL_FUNCTION", title: `${PREFIX} event`, audienceType: "SCHOOL_WIDE", ...input }, actor(principal));
  let version = base.versions[0];
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "ready", expectedVersion: version.version }, actor(principal));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "approve", expectedVersion: version.version, reason: "CAL23E audience reviewed" }, actor(principal));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "publish", expectedVersion: version.version, reason: "CAL23E governed publication", idempotencyKey: `${PREFIX}-${String(input.audienceType ?? "school")}-${randomUUID()}` }, actor(principal));
  return { base, version };
}

async function main() {
  cleanup(); mkdirSync(ROOT, { recursive: true });
  assertSqliteCopyReady(OPERATIONAL, "CAL23E_OPERATIONAL");
  const before = snapshotSqliteArtifacts(OPERATIONAL);
  copyFileSync(OPERATIONAL, DATABASE); copyFileSync(OPERATIONAL, RESTORE_DATABASE);
  Object.assign(process.env, { DATABASE_URL: url(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, NODE_ENV: "test" });
  stage = "migration"; runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]); runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]); invariant(/up to date/i.test(runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"])), "CAL23E_MIGRATION_DIRTY"); runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], RESTORE_DATABASE);
  const client = new PrismaClient({ datasourceUrl: url(DATABASE) });
  try {
    stage = "fixtures";
    const [classA, classB, classOther] = await Promise.all([
      client.timetableClassSection.create({ data: { academicYear: YEAR, className: "V", section: SECTION_A, displayName: `V-${SECTION_A}`, groupName: PREFIX, isActive: true } }),
      client.timetableClassSection.create({ data: { academicYear: YEAR, className: "V", section: SECTION_B, displayName: `V-${SECTION_B}`, groupName: PREFIX, isActive: true } }),
      client.timetableClassSection.create({ data: { academicYear: YEAR, className: "VI", section: SECTION_A, displayName: `VI-${SECTION_A}`, groupName: PREFIX, isActive: true } })
    ]);
    await client.timetableClassSection.create({ data: { academicYear: "2025-26", className: "IV", section: SECTION_A, displayName: `IV-${SECTION_A}`, groupName: PREFIX, isActive: true } });
    const subject = await client.timetableSubject.create({ data: { name: `${PREFIX} General`, shortName: `${PREFIX}-GEN`, isActive: true } });
    const guardians = await Promise.all(["one", "many", "teacher-parent", "removed"].map((name, index) => client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} ${name}`, primaryMobile: `90000235${String(index).padStart(2, "0")}` } })));
    const [childA, childB, childOther, childRemoved] = await Promise.all([student(client, "001", "V", SECTION_A), student(client, "002", "V", SECTION_B), student(client, "003", "VI", SECTION_A), student(client, "004", "V", SECTION_A)]);
    const removedLink = await client.studentGuardian.create({ data: { guardianId: guardians[3].id, studentId: childRemoved.id, isPrimaryContact: true } });
    await client.studentGuardian.createMany({ data: [{ guardianId: guardians[0].id, studentId: childA.id, isPrimaryContact: true }, { guardianId: guardians[1].id, studentId: childA.id, isPrimaryContact: true }, { guardianId: guardians[1].id, studentId: childB.id }, { guardianId: guardians[2].id, studentId: childA.id, isPrimaryContact: true }] });
    const principal = await user(client, "principal", "PRINCIPAL");
    await user(client, "super-admin", "SUPER_ADMIN"); await user(client, "director", "DIRECTOR"); await user(client, "viewer", "VIEWER"); await user(client, "accountant", "ACCOUNTANT");
    const teacherA = await user(client, "teacher-a", "TEACHER"); const teacherB = await user(client, "teacher-b", "TEACHER");
    const parentOne = await user(client, "parent-one", "PARENT", guardians[0].id); const parentMany = await user(client, "parent-many", "PARENT", guardians[1].id); const teacherParent = await user(client, "teacher-parent", "TEACHER", guardians[2].id, ["PARENT"]); const removedParent = await user(client, "removed-parent", "PARENT", guardians[3].id);
    const ttA = await client.timetableTeacher.create({ data: { name: teacherA.user.name, shortName: `${PREFIX}-TA`, isActive: true, maxPeriodsPerWeek: 30 } }); const ttB = await client.timetableTeacher.create({ data: { name: teacherB.user.name, shortName: `${PREFIX}-TB`, isActive: true, maxPeriodsPerWeek: 30 } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${PREFIX}-STA`, fullName: teacherA.user.name, designation: "Teacher", userId: teacherA.user.id, timetableTeacherId: ttA.id } }); await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${PREFIX}-STB`, fullName: teacherB.user.name, designation: "Teacher", userId: teacherB.user.id, timetableTeacherId: ttB.id } });
    await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classA.id, subjectId: subject.id, teacherId: ttA.id, periodsPerWeek: 5 } }); await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classOther.id, subjectId: subject.id, teacherId: ttB.id, periodsPerWeek: 5 } });

    stage = "operational calendar";
    let calendar = await createAcademicCalendarVersion(client, { academicYear: YEAR, title: `${PREFIX} Academic Calendar`, effectiveScope: "SCHOOL_WIDE" }, actor(principal.user));
    calendar = await saveAcademicCalendarDraft(client, calendar.publicKey, { expectedVersion: calendar.version, days: [
      { dayDate: "2026-08-10", dayType: "WORKING_DAY", title: "Working day" }, { dayDate: "2026-08-11", dayType: "NON_WORKING_DAY", title: "School holiday" }, { dayDate: "2026-08-12", dayType: "VACATION_DAY", title: "Vacation" }, { dayDate: "2026-08-13", dayType: "HALF_DAY", halfDaySession: "Morning", title: "Half day" }, { dayDate: "2026-08-14", dayType: "SPECIAL_WORKING_DAY", title: "Special working day" }, { dayDate: "2026-08-15", dayType: "EMERGENCY_CLOSURE", title: "Emergency closure", reason: "Synthetic safety closure" }
    ], emergencyPermissionConfirmed: true }, actor(principal.user));
    calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "ready", expectedVersion: calendar.version }, actor(principal.user)); calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "approve", expectedVersion: calendar.version, reason: "CAL23E totals reviewed" }, actor(principal.user)); calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "publish", expectedVersion: calendar.version, reason: "CAL23E initial calendar", idempotencyKey: `${PREFIX}-CAL-PUBLISH` }, actor(principal.user));
    const attendance = await client.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-10T00:00:00Z"), className: "V", section: SECTION_A, academicYear: YEAR, status: "SUBMITTED", takenByUserId: principal.user.id, submittedByUserId: principal.user.id, submittedAt: new Date(), records: { create: { studentId: childA.id, admissionNo: childA.admissionNo, status: "PRESENT" } } } });
    let replacement = await transitionAcademicCalendar(client, calendar.publicKey, { action: "create_replacement", reason: "Correct posted-date classification" }, actor(principal.user)); replacement = await saveAcademicCalendarDraft(client, replacement.publicKey, { expectedVersion: replacement.version, emergencyPermissionConfirmed: true, days: replacement.days.map((day: any) => ({ dayDate: day.dayDate.toISOString().slice(0, 10), dayType: day.dayDate.toISOString().startsWith("2026-08-10") ? "NON_WORKING_DAY" : day.dayType, sourceType: day.sourceType, scopeType: day.scopeType, className: day.className, section: day.section, title: day.title, halfDaySession: day.halfDaySession, publicInstructions: day.publicInstructions, reason: day.reason })) }, actor(principal.user));
    const impact = (await getAcademicCalendarVersion(client, replacement.publicKey)).preview; invariant(impact.postedAttendanceSessions === 1 && impact.attendanceRecordsWillBeRewritten === false, "CAL23E_ATTENDANCE_IMPACT_WRONG");
    replacement = await transitionAcademicCalendar(client, replacement.publicKey, { action: "ready", expectedVersion: replacement.version }, actor(principal.user)); replacement = await transitionAcademicCalendar(client, replacement.publicKey, { action: "approve", expectedVersion: replacement.version, reason: "Impact reviewed" }, actor(principal.user)); replacement = await transitionAcademicCalendar(client, replacement.publicKey, { action: "publish", expectedVersion: replacement.version, reason: "Governed correction", impactReason: "Posted attendance retained for reconciliation", idempotencyKey: `${PREFIX}-CAL-REPLACE` }, actor(principal.user));
    invariant(await client.studentAttendanceRecord.count({ where: { sessionId: attendance.id } }) === 1, "CAL23E_ATTENDANCE_REWRITTEN"); invariant((await client.academicCalendarVersion.count({ where: { academicYear: YEAR } })) === 2, "CAL23E_HISTORY_NOT_PRESERVED");

    stage = "event privacy";
    const school = await publishEvent(client, principal.user, { title: `${PREFIX} School function`, audienceType: "SCHOOL_WIDE" });
    const staff = await publishEvent(client, principal.user, { title: `${PREFIX} Staff meeting`, eventType: "STAFF_MEETING", audienceType: "STAFF_ONLY" });
    const sectionA = await publishEvent(client, principal.user, { title: `${PREFIX} Section A event`, eventType: "CLASS_EVENT", audienceType: "CLASS_SECTION", className: "V", section: SECTION_A });
    await publishEvent(client, principal.user, { title: `${PREFIX} Section B event`, eventType: "CLASS_EVENT", audienceType: "CLASS_SECTION", className: "V", section: SECTION_B });
    await publishEvent(client, principal.user, { title: `${PREFIX} Leadership event`, audienceType: "LEADERSHIP_ONLY" });
    const draft = await createSchoolCalendarEvent(client, { academicYear: YEAR, eventType: "ACTIVITY", title: `${PREFIX} Draft hidden`, startsAt: "2026-08-16", endsAt: "2026-08-16", audienceType: "SCHOOL_WIDE" }, actor(principal.user));
    const parentContexts = await listChildContexts(client, { userId: parentOne.user.id, sessionId: parentOne.sessionId }); const parentContext = parentContexts.children[0]; invariant(parentContext, "CAL23E_PARENT_CONTEXT_MISSING");
    const parentView = await loadPublishedSchoolCalendar(client, { ...actor(parentOne.user), roleAssignmentId: parentOne.assignmentId, sessionId: parentOne.sessionId }, { academicYear: YEAR, from: "2026-08-01", to: "2026-08-31", childHandle: parentContext.handle, expectedContextVersion: parentContexts.contextVersion });
    invariant(parentView.events.some((row) => row.title === school.version.title) && parentView.events.some((row) => row.title === sectionA.version.title), "CAL23E_PARENT_ALLOWED_MISSING"); invariant(!parentView.events.some((row) => [staff.version.title, `${PREFIX} Section B event`, `${PREFIX} Leadership event`, draft.versions[0].title].includes(row.title)), "CAL23E_PARENT_PRIVACY_LEAK");
    const teacherView = await loadPublishedSchoolCalendar(client, actor(teacherA.user), { academicYear: YEAR, from: "2026-08-01", to: "2026-08-31" }); invariant(teacherView.events.some((row) => row.title === staff.version.title) && teacherView.events.some((row) => row.title === sectionA.version.title), "CAL23E_TEACHER_ALLOWED_MISSING"); invariant(!teacherView.events.some((row) => row.title === `${PREFIX} Section B event`), "CAL23E_TEACHER_SCOPE_LEAK");
    const manyContexts = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId }); invariant(manyContexts.children.length === 2, "CAL23E_MULTI_CHILD_CONTEXT_FAILED"); invariant(teacherParent.assignments.some((row) => row.role === "PARENT"), "CAL23E_MULTI_ROLE_FIXTURE_FAILED");
    const removedContexts = await listChildContexts(client, { userId: removedParent.user.id, sessionId: removedParent.sessionId }); const removedContext = removedContexts.children[0]; invariant(removedContext, "CAL23E_REMOVED_CONTEXT_MISSING"); await client.studentGuardian.delete({ where: { id: removedLink.id } }); let removedDenied = false; try { await loadPublishedSchoolCalendar(client, { ...actor(removedParent.user), roleAssignmentId: removedParent.assignmentId, sessionId: removedParent.sessionId }, { academicYear: YEAR, from: "2026-08-01", to: "2026-08-31", childHandle: removedContext.handle, expectedContextVersion: removedContexts.contextVersion }); } catch { removedDenied = true; } invariant(removedDenied, "CAL23E_REMOVED_LINK_STILL_VISIBLE");

    stage = "idempotence and backup";
    const campaignsBefore = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "CAL23E-" } } }); await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "publish", expectedVersion: school.version.version - 1, reason: "CAL23E governed publication", idempotencyKey: school.version.idempotencyKey }, actor(principal.user)); const campaignsAfter = await client.notificationCampaign.count({ where: { campaignNumber: { startsWith: "CAL23E-" } } }); invariant(campaignsBefore === campaignsAfter, "CAL23E_NOTIFICATION_DUPLICATED");
    const backup = await generateFullBackup(client, { generatedBy: `${PREFIX} QA` }); const parsed = parseAndValidateBackup(backup); invariant(parsed.academicCalendarVersions.length === 2 && parsed.schoolCalendarEventVersions.length >= 5, "CAL23E_BACKUP_MISSING");
    const restoreClient = new PrismaClient({ datasourceUrl: url(RESTORE_DATABASE) }); try { const restoreActor = await restoreClient.user.findFirst({ where: { role: "SUPER_ADMIN", isActive: true } }); invariant(restoreActor, "CAL23E_RESTORE_ACTOR_MISSING"); const first = await restoreValidatedBackup(restoreClient, parsed, restoreActor); const second = await restoreValidatedBackup(restoreClient, parsed, restoreActor); const errors = [first, second].flatMap((result) => Object.entries(result).flatMap(([key, value]: any) => value?.errors?.length ? [`${key}:${value.errors.join("|")}`] : [])); invariant(!errors.length, `CAL23E_RESTORE_ERRORS:${errors.join(";")}`); invariant(await restoreClient.academicCalendarVersion.count({ where: { academicYear: YEAR } }) === 2, "CAL23E_RESTORE_CALENDAR_MISMATCH"); invariant(await restoreClient.schoolCalendarEventVersion.count({ where: { event: { academicYear: YEAR } } }) >= 5, "CAL23E_RESTORE_EVENT_MISMATCH"); } finally { await restoreClient.$disconnect(); }
    assertSqliteCopyReady(OPERATIONAL, "CAL23E_OPERATIONAL");
    const after = snapshotSqliteArtifacts(OPERATIONAL); assertSqliteSnapshotUnchanged(before, after, "CAL23E_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "CAL23E_COPIED_DATABASE_PASSED", copiedDatabase: true, calendarVersions: 2, operationalDays: 12, eventAudiences: 5, multiChildContexts: manyContexts.children.length, attendanceRewritten: false, notificationsDeduplicated: true, restoreRuns: 2, operationalMutation: false }));
  } finally { await client.$disconnect(); }
}

main().catch((error) => { console.error(JSON.stringify({ result: "CAL23E_COPIED_DATABASE_FAILED", stage, error: error instanceof Error ? error.message : String(error) })); process.exitCode = 1; }).finally(() => { try { cleanup(); } catch (error) { console.error(`CAL23E_CLEANUP_FAILED:${String(error)}`); process.exitCode = 1; } });
