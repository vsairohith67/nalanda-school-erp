import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { createAcademicCalendarVersion, createSchoolCalendarEvent, saveAcademicCalendarDraft, transitionAcademicCalendar, transitionSchoolCalendarEvent } from "../lib/academic-calendar";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const WORKSPACE = path.resolve(".");
const OPERATIONAL = path.join(WORKSPACE, "prisma", "dev.db");
const SOURCE_ROOT = path.join(WORKSPACE, "tmp", "parent23d-browser");
const ROOT = path.join(WORKSPACE, "tmp", "cal23e-browser");
const DATABASE = path.join(ROOT, "cal23e-browser.db");
const CREDENTIALS = path.join(ROOT, "credentials.json");
const RUNTIME_ENV = path.join(ROOT, "runtime-env.json");
const YEAR = "2026-27";
const PREFIX = "CAL23E-BROWSER";
const PORT = 3220;

function runScript(name: string) { const result = spawnSync("pnpm.cmd", [name], { cwd: WORKSPACE, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024, shell: true }); if (result.error || result.status !== 0) throw new Error(`${name} failed: ${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`); }
function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function assertRoot() { const resolved = path.resolve(ROOT); if (resolved !== path.join(path.resolve(WORKSPACE), "tmp", "cal23e-browser")) throw new Error("CAL23E_BROWSER_CLEANUP_SCOPE_REFUSED"); return resolved; }
function actor(user: any, roleAssignmentId: string) { return { id: user.id, name: user.name, role: user.role, roleAssignmentId }; }

async function publishEvent(client: PrismaClient, principal: any, roleAssignmentId: string, input: Record<string, unknown>) {
  const base = await createSchoolCalendarEvent(client, { academicYear: YEAR, eventType: "SCHOOL_FUNCTION", title: `${PREFIX} event`, startsAt: "2026-08-18T09:00:00+05:30", endsAt: "2026-08-18T11:00:00+05:30", venue: "Nalanda Activity Hall", audienceType: "SCHOOL_WIDE", parentInstructions: "Please arrive ten minutes early with the school identity card.", ...input }, actor(principal, roleAssignmentId));
  let version = base.versions[0];
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "ready", expectedVersion: version.version }, actor(principal, roleAssignmentId));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "approve", expectedVersion: version.version, reason: "CAL23E Browser audience preview reviewed" }, actor(principal, roleAssignmentId));
  version = await transitionSchoolCalendarEvent(client, base.publicKey, { action: "publish", expectedVersion: version.version, reason: "CAL23E Browser governed publication", idempotencyKey: `${PREFIX}-${String(input.audienceType ?? "school")}-${crypto.randomUUID()}` }, actor(principal, roleAssignmentId));
  return { base, version };
}

async function setup() {
  assertSqliteCopyReady(OPERATIONAL, "CAL23E_BROWSER_OPERATIONAL");
  const before = snapshotSqliteArtifacts(OPERATIONAL);
  cleanup(false); runScript("qa:23d:browser:setup"); mkdirSync(ROOT, { recursive: true });
  assertSqliteCopyReady(path.join(SOURCE_ROOT, "parent23d-browser.db"), "CAL23E_BROWSER_SOURCE");
  copyFileSync(path.join(SOURCE_ROOT, "parent23d-browser.db"), DATABASE);
  const sourceCredentials = JSON.parse(readFileSync(path.join(SOURCE_ROOT, "credentials.json"), "utf8"));
  const sourceEnvironment = JSON.parse(readFileSync(path.join(SOURCE_ROOT, "runtime-env.json"), "utf8"));
  runScript("qa:23d:browser:cleanup");
  Object.assign(process.env, { ...sourceEnvironment, DATABASE_URL: databaseUrl(DATABASE), APP_ORIGIN: `http://127.0.0.1:${PORT}`, PORT: String(PORT), NODE_ENV: "production" });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    await ensureDefaultRolePermissions(client);
    const principal = await client.user.findUniqueOrThrow({ where: { username: sourceCredentials.principal.username } });
    const principalAssignment = await client.userRoleAssignment.findFirstOrThrow({ where: { userId: principal.id, role: "PRINCIPAL", status: "ACTIVE" } });
    const teacherParent = await client.user.findUniqueOrThrow({ where: { username: sourceCredentials.teacherParent.username } });
    const teacherAssignment = await client.userRoleAssignment.findFirstOrThrow({ where: { userId: teacherParent.id, role: "TEACHER", status: "ACTIVE" } });
    const classA = await client.timetableClassSection.findFirstOrThrow({ where: { academicYear: YEAR, section: "A", isActive: true, className: { contains: "P23D" } } });
    const classB = await client.timetableClassSection.findFirstOrThrow({ where: { academicYear: YEAR, section: "B", isActive: true, className: classA.className } });
    const subject = await client.timetableSubject.findFirstOrThrow({ where: { isActive: true, shortName: { startsWith: "P23D-" } } });
    const timetableTeacher = await client.timetableTeacher.create({ data: { name: teacherParent.name, shortName: `${PREFIX}-TP`, isActive: true, maxPeriodsPerWeek: 30 } });
    await client.staffMember.update({ where: { userId: teacherParent.id }, data: { timetableTeacherId: timetableTeacher.id, status: "ACTIVE" } });
    await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classA.id, subjectId: subject.id, teacherId: timetableTeacher.id, periodsPerWeek: 5 } });

    let calendar = await createAcademicCalendarVersion(client, { academicYear: YEAR, title: "2026-27 Governed Academic Calendar", effectiveScope: "SCHOOL_WIDE" }, actor(principal, principalAssignment.id));
    calendar = await saveAcademicCalendarDraft(client, calendar.publicKey, { expectedVersion: calendar.version, days: [
      { dayDate: "2026-08-03", dayType: "WORKING_DAY", title: "Regular working day" }, { dayDate: "2026-08-04", dayType: "NON_WORKING_DAY", title: "School-entered holiday", publicInstructions: "School is closed for students." }, { dayDate: "2026-08-05", dayType: "VACATION_DAY", title: "Term vacation" }, { dayDate: "2026-08-06", dayType: "HALF_DAY", halfDaySession: "Morning session", title: "Half-day programme" }, { dayDate: "2026-08-07", dayType: "SPECIAL_WORKING_DAY", title: "Special working day" }, { dayDate: "2026-08-20", dayType: "WORKING_DAY", title: "Working day before correction" }
    ] }, actor(principal, principalAssignment.id));
    calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "ready", expectedVersion: calendar.version }, actor(principal, principalAssignment.id)); calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "approve", expectedVersion: calendar.version, reason: "Working-day totals reviewed" }, actor(principal, principalAssignment.id)); calendar = await transitionAcademicCalendar(client, calendar.publicKey, { action: "publish", expectedVersion: calendar.version, reason: "Initial governed academic calendar", impactReason: "Existing copied-fixture attendance remains unchanged and is flagged for reconciliation review.", idempotencyKey: `${PREFIX}-CALENDAR-PUBLISH` }, actor(principal, principalAssignment.id));
    const student = await client.student.findFirstOrThrow({ where: { className: classA.className, section: classA.section } });
    await client.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-20T00:00:00Z"), className: classA.className, section: classA.section, academicYear: YEAR, status: "SUBMITTED", takenByUserId: principal.id, submittedByUserId: principal.id, submittedAt: new Date(), records: { create: { studentId: student.id, admissionNo: student.admissionNo, status: "PRESENT" } } } });
    let correction = await transitionAcademicCalendar(client, calendar.publicKey, { action: "create_replacement", reason: "Emergency operating-day correction after attendance posting" }, actor(principal, principalAssignment.id)); correction = await saveAcademicCalendarDraft(client, correction.publicKey, { expectedVersion: correction.version, days: correction.days.map((day: any) => ({ dayDate: day.dayDate.toISOString().slice(0, 10), dayType: day.dayDate.toISOString().startsWith("2026-08-20") ? "NON_WORKING_DAY" : day.dayType, sourceType: day.sourceType, scopeType: day.scopeType, title: day.dayDate.toISOString().startsWith("2026-08-20") ? "Proposed corrected non-working day" : day.title, halfDaySession: day.halfDaySession, publicInstructions: day.publicInstructions, reason: day.reason })) }, actor(principal, principalAssignment.id));

    const school = await publishEvent(client, principal, principalAssignment.id, { title: "Annual cultural programme", audienceType: "SCHOOL_WIDE" });
    await publishEvent(client, principal, principalAssignment.id, { title: "Staff planning meeting", eventType: "STAFF_MEETING", audienceType: "STAFF_ONLY", parentInstructions: null, internalNotes: "Leadership planning notes remain private." });
    await publishEvent(client, principal, principalAssignment.id, { title: `${classA.className}-${classA.section} science activity`, eventType: "CLASS_EVENT", audienceType: "CLASS_SECTION", className: classA.className, section: classA.section });
    await publishEvent(client, principal, principalAssignment.id, { title: `${classB.className}-${classB.section} unrelated activity`, eventType: "CLASS_EVENT", audienceType: "CLASS_SECTION", className: classB.className, section: classB.section });
    await publishEvent(client, principal, principalAssignment.id, { title: "Leadership review", audienceType: "LEADERSHIP_ONLY", parentInstructions: null });
    const currentExam = await client.examinationTimetableVersion.findFirstOrThrow({ where: { status: "PUBLISHED", currentPublicationKey: { not: null }, className: classA.className, section: classA.section } });
    await publishEvent(client, principal, principalAssignment.id, { title: "Published examination timetable", eventType: "EXAMINATION_REFERENCE", audienceType: "CLASS_SECTION", className: classA.className, section: classA.section, examinationTimetableKey: currentExam.publicKey });
    let changed = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "create_replacement", reason: "Programme reporting time updated" }, actor(principal, principalAssignment.id));
    changed = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "ready", expectedVersion: changed.version }, actor(principal, principalAssignment.id)); changed = await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "approve", expectedVersion: changed.version, reason: "Replacement audience reviewed" }, actor(principal, principalAssignment.id)); await transitionSchoolCalendarEvent(client, school.base.publicKey, { action: "publish", expectedVersion: changed.version, reason: "Publish changed programme", idempotencyKey: `${PREFIX}-EVENT-REPLACEMENT` }, actor(principal, principalAssignment.id));
    const withdrawn = await publishEvent(client, principal, principalAssignment.id, { title: "Withdrawn activity", audienceType: "SCHOOL_WIDE" }); await transitionSchoolCalendarEvent(client, withdrawn.base.publicKey, { action: "withdraw", expectedVersion: withdrawn.version.version, reason: "Activity cancelled by school" }, actor(principal, principalAssignment.id));

    writeFileSync(CREDENTIALS, JSON.stringify({ ...sourceCredentials, teacher: sourceCredentials.teacherParent, calendarPaths: { principal: "/calendar", parent: "/parent/calendar?month=2026-08", teacher: "/teacher/calendar?month=2026-08", correction: correction.publicKey }, roleAssignmentIds: { teacher: teacherAssignment.id } }));
    writeFileSync(RUNTIME_ENV, JSON.stringify({ ...sourceEnvironment, DATABASE_URL: databaseUrl(DATABASE), APP_ORIGIN: `http://127.0.0.1:${PORT}`, NODE_ENV: "production", PORT: String(PORT) }));
    assertSqliteCopyReady(OPERATIONAL, "CAL23E_BROWSER_OPERATIONAL");
    const after = snapshotSqliteArtifacts(OPERATIONAL); assertSqliteSnapshotUnchanged(before, after, "CAL23E_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "CAL23E_BROWSER_FIXTURES_READY", copiedDatabase: true, port: PORT, principal: 1, parents: 2, teacherParent: 1, operationalVersions: 2, publishedEventAudiences: 6, examinationReference: true, attendanceImpactDraft: true }));
  } finally { await client.$disconnect(); }
}

function cleanup(log = true) { const root = assertRoot(); if (existsSync(root)) rmSync(root, { recursive: true, force: true }); if (existsSync(SOURCE_ROOT)) { try { runScript("qa:23d:browser:cleanup"); } catch { /* best effort for the source copied fixture */ } } if (log) console.log(JSON.stringify({ result: "CAL23E_BROWSER_FIXTURES_REMOVED", exists: existsSync(root) })); }
const mode = process.argv[2]; if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }); else if (mode === "cleanup") cleanup(); else { console.error("Use setup or cleanup"); process.exitCode = 1; }
