import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { suggestSubstituteStaff, validateSubstituteInput, validateSubstituteLinks } from "@/lib/substitutes";
import { saveSubstituteAssignment, type SubstituteActor } from "@/lib/substitute-assignment-service";
import { assertSyntheticPostgresQa } from "../scripts/postgres/synthetic-qa";

// Real production readers, IAM and persistence on a newly created synthetic
// provider target. No auth/service doubles, copied database or operational URL.
const root = mkdtempSync(path.join(tmpdir(), "nps-ready-gaps-b-1a-"));
const createdRoot = lstatSync(root);
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const ownedSchema = `nps_substitute_${randomUUID().replaceAll("-", "")}`;
let db: PrismaClient, contender: PrismaClient, actor: SubstituteActor, teacherActor: SubstituteActor;
const year = "2026-27", monday = "2026-10-05";

async function identity(role: string) {
  const key = randomUUID();
  const user = await db.user.create({ data: { username: `synthetic-b-${key}`, name: `SYNTHETIC B ${role}`, passwordHash: "SYNTHETIC-NOT-A-CREDENTIAL", role } });
  const roleAssignment = await db.userRoleAssignment.create({ data: { userId: user.id, role, reason: "SYNTHETIC B", validFrom: new Date(Date.now() - 60_000) } });
  const session = await db.authSession.create({ data: { userId: user.id, activeRoleAssignmentId: roleAssignment.id, tokenHash: `synthetic-b-${key}`, credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion, expiresAt: new Date(Date.now() + 3_600_000), deviceSummary: "SYNTHETIC", browserSummary: "SYNTHETIC", networkEvidenceMasked: "SYNTHETIC" } });
  return { userId: user.id, sessionId: session.id, roleAssignmentId: roleAssignment.id };
}

beforeAll(async () => {
  expect(["sqlite", "postgresql"]).toContain(process.env.DATABASE_PROVIDER ?? "sqlite");
  expect(lstatSync(root).isSymbolicLink()).toBe(false);
  expect(realpathSync(root)).toBe(root);
  let providerUrl = `file:${path.join(root, "synthetic.db").replaceAll("\\", "/")}`;
  if (postgres) {
    expect(process.env.CI).toBe("true");
    assertSyntheticPostgresQa();
    const target = new URL(process.env.DATABASE_URL!); target.searchParams.set("schema", ownedSchema); providerUrl = target.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: providerUrl, DIRECT_URL: providerUrl }, stdio: "pipe", windowsHide: true, timeout: 60_000 });
  } else {
    const sql = new DatabaseSync(":memory:");
    try {
      for (const migration of readdirSync("prisma/migrations", { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
      expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
      await backup(sql, path.join(root, "synthetic.db"));
    } finally { sql.close(); }
  }
  db = new PrismaClient({ datasourceUrl: providerUrl }); contender = new PrismaClient({ datasourceUrl: providerUrl });
  actor = await identity("SUPER_ADMIN"); teacherActor = await identity("TEACHER");
  for (const [academicYear, dayOfWeek, groupName, startTime, endTime] of [[year, "MONDAY", "VI-X", "09:00", "09:40"], [year, "FRIDAY", "FRIDAY", "08:20", "09:00"], ["2027-28", "MONDAY", "VI-X", "09:00", "09:40"]]) {
    await db.timetablePeriodTemplate.create({ data: { academicYear, dayOfWeek, groupName, periodNumber: 1, label: "Period I", startTime, endTime, type: "TEACHING", isTeachingPeriod: true, sortOrder: 1 } });
  }
});

afterAll(async () => {
  if (postgres && db) { if (!/^nps_substitute_[a-f0-9]{32}$/.test(ownedSchema)) throw new Error("SYNTHETIC_SCHEMA_CLEANUP_SCOPE_REFUSED"); await db.$executeRawUnsafe(`DROP SCHEMA "${ownedSchema}" CASCADE`); }
  await Promise.all([db?.$disconnect(), contender?.$disconnect()]);
  const settledRoot = lstatSync(root);
  expect(settledRoot.isSymbolicLink()).toBe(false); expect(realpathSync(root)).toBe(root);
  expect(settledRoot.dev).toBe(createdRoot.dev); expect(settledRoot.ino).toBe(createdRoot.ino);
  expect(path.dirname(root)).toBe(tmpdir()); expect(path.basename(root).startsWith("nps-ready-gaps-b-1a-")).toBe(true);
  rmSync(root, { recursive: true });
});

async function fixture() {
  const key = randomUUID();
  const subjectName = `Synthetic Math ${key}`;
  const absent = await db.staffMember.create({ data: { fullName: `SYNTHETIC B absent ${key}`, designation: "Teacher" } });
  const otherAbsent = await db.staffMember.create({ data: { fullName: `SYNTHETIC B other absent ${key}`, designation: "Teacher" } });
  const teacher = await db.timetableTeacher.create({ data: { name: `SYNTHETIC B timetable ${key}`, shortName: key, maxPeriodsPerWeek: 30 } });
  const candidate = await db.staffMember.create({ data: { fullName: `SYNTHETIC B candidate ${key}`, designation: "Teacher", timetableTeacherId: teacher.id, primarySubject: subjectName } });
  const classSection = await db.timetableClassSection.create({ data: { className: "VI", section: key, displayName: "SYNTHETIC B VI", groupName: "VI-X", academicYear: year } });
  const subject = await db.timetableSubject.create({ data: { name: subjectName, shortName: key } });
  const draft = await db.timetableDraft.create({ data: { academicYear: year, name: `SYNTHETIC B ${key}`, status: "ACTIVE" } });
  const input = { action: "assign", assignmentDate: monday, academicYear: year, absentStaffMemberId: absent.id, substituteStaffMemberId: candidate.id, className: "VI", section: classSection.section, subject: subject.name, reason: "MANUAL", priority: "NORMAL", periodLabel: "Period I", periodStartTime: "09:00", periodEndTime: "09:40" };
  const duty = (data: Record<string, unknown> = {}) => db.timetableEntry.create({ data: { draftId: draft.id, academicYear: year, classSectionId: classSection.id, dayOfWeek: "MONDAY", periodNumber: 1, teacherId: teacher.id, subjectId: subject.id, entryType: "TEACHING", ...data } });
  return { absent, otherAbsent, teacher, candidate, classSection, subject, draft, input, duty };
}

async function suggestions(input: Awaited<ReturnType<typeof fixture>>["input"]) {
  return suggestSubstituteStaff(db, { ...input, assignmentDate: new Date(`${input.assignmentDate}T00:00:00.000Z`) });
}

describe("requirement025 actual provider substitute conflict and atomic assignment", () => {
  it("excludes active regular duties and revalidates after an advisory recommendation", async () => {
    const f = await fixture();
    expect((await suggestions(f.input)).some((row) => row.id === f.candidate.id)).toBe(true);
    await f.duty();
    expect((await suggestions(f.input)).some((row) => row.id === f.candidate.id)).toBe(false);
    await expect(saveSubstituteAssignment(db, actor, f.input)).rejects.toThrow("regular timetable duty");
    expect(await db.substituteAssignment.count({ where: { absentStaffMemberId: f.absent.id } })).toBe(0);
  });

  it("preserves adjacent boundaries and ignores other weekdays, draft and archived timetables", async () => {
    const f = await fixture(); await f.duty();
    const adjacent = { ...f.input, periodLabel: "Period II", periodStartTime: "09:40", periodEndTime: "10:20" };
    expect((await saveSubstituteAssignment(db, actor, adjacent)).status).toBe("ASSIGNED");
    for (const status of ["DRAFT", "ARCHIVED"]) {
      const next = await fixture(); await next.duty(); await db.timetableDraft.update({ where: { id: next.draft.id }, data: { status } });
      expect((await saveSubstituteAssignment(db, actor, next.input)).status).toBe("ASSIGNED");
    }
    const anotherDay = await fixture(); await anotherDay.duty({ dayOfWeek: "TUESDAY" });
    expect((await saveSubstituteAssignment(db, actor, anotherDay.input)).status).toBe("ASSIGNED");
  });

  it.each(["class", "teacher", "subject", "empty"])("ignores inactive or unassigned regular duty %s", async (kind) => {
    const f = await fixture(); await f.duty();
    if (kind === "class") await db.timetableClassSection.update({ where: { id: f.classSection.id }, data: { isActive: false } });
    if (kind === "teacher") await db.timetableTeacher.update({ where: { id: f.teacher.id }, data: { isActive: false } });
    if (kind === "subject") await db.timetableSubject.update({ where: { id: f.subject.id }, data: { isActive: false } });
    if (kind === "empty") await db.timetableEntry.updateMany({ where: { draftId: f.draft.id }, data: { entryType: "EMPTY" } });
    expect((await saveSubstituteAssignment(db, actor, f.input)).status).toBe("ASSIGNED");
  });

  it.each(["FIXED", "ACTIVITY", "SUBSTITUTION"])("counts the existing occupied regular entry kind %s", async (entryType) => {
    const f = await fixture(); await f.duty({ entryType });
    await expect(saveSubstituteAssignment(db, actor, f.input)).rejects.toThrow("regular timetable duty");
  });

  it("uses Friday timings and exact academic years rather than stale year or day data", async () => {
    const friday = await fixture(); await friday.duty({ dayOfWeek: "FRIDAY" });
    await expect(saveSubstituteAssignment(db, actor, { ...friday.input, assignmentDate: "2026-10-09", periodStartTime: "08:20", periodEndTime: "09:00" })).rejects.toThrow("regular timetable duty");
    expect((await saveSubstituteAssignment(db, actor, { ...friday.input, assignmentDate: "2026-10-09" })).status).toBe("ASSIGNED");
    const nextYear = await fixture(); await nextYear.duty();
    await expect(saveSubstituteAssignment(db, actor, { ...nextYear.input, assignmentDate: "2027-10-04" })).rejects.toThrow("academic year");
    await expect(saveSubstituteAssignment(db, actor, { ...nextYear.input, academicYear: "" })).rejects.toThrow("academic year");
    expect((await saveSubstituteAssignment(db, actor, { ...nextYear.input, assignmentDate: "2027-10-04", academicYear: "2027-28" })).status).toBe("ASSIGNED");
  });

  it("fails closed for unavailable timing evidence and unresolved label-only regular duties", async () => {
    const f = await fixture(); await f.duty({ periodNumber: 99 });
    await expect(saveSubstituteAssignment(db, actor, f.input)).rejects.toThrow("availability cannot be verified");
    expect((await suggestions(f.input)).some((row) => row.id === f.candidate.id)).toBe(false);
    const labels = await fixture(); await labels.duty();
    await expect(saveSubstituteAssignment(db, actor, { ...labels.input, periodLabel: "UNMAPPED SYNTHETIC LABEL", periodStartTime: "", periodEndTime: "" })).rejects.toThrow("provide both period times");
  });

  it("refuses overlapping substitution, permits separate intervals and releases cancelled duty", async () => {
    const f = await fixture(); const first = await saveSubstituteAssignment(db, actor, f.input);
    const overlapping = { ...f.input, absentStaffMemberId: f.otherAbsent.id };
    await expect(saveSubstituteAssignment(db, actor, overlapping)).rejects.toThrow("already has another duty");
    const separate = { ...overlapping, periodLabel: "Period II", periodStartTime: "09:40", periodEndTime: "10:20" };
    expect((await saveSubstituteAssignment(db, actor, separate)).status).toBe("ASSIGNED");
    await saveSubstituteAssignment(db, actor, { action: "cancel", expectedUpdatedAt: first.updatedAt.toISOString(), cancellationReason: "SYNTHETIC cancelled duty" }, first.id);
    expect((await saveSubstituteAssignment(db, actor, f.input)).status).toBe("ASSIGNED");
  });

  it("commits exactly one of two real concurrent conflicts from independent clients", async () => {
    const f = await fixture();
    const outcomes = await Promise.allSettled([saveSubstituteAssignment(db, actor, f.input), saveSubstituteAssignment(contender, actor, { ...f.input, absentStaffMemberId: f.otherAbsent.id })]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.substituteAssignment.count({ where: { substituteStaffMemberId: f.candidate.id, assignmentDate: new Date(monday), status: { not: "CANCELLED" } } })).toBe(1);
  });

  it("does not duplicate a POST retry and accepts only an exact authorized existing-row assignment retry", async () => {
    const f = await fixture(); const draft = await saveSubstituteAssignment(db, actor, { ...f.input, action: "draft", substituteStaffMemberId: "" });
    const assignment = { ...f.input, expectedUpdatedAt: draft.updatedAt.toISOString() };
    const assigned = await saveSubstituteAssignment(db, actor, assignment, draft.id);
    expect((await saveSubstituteAssignment(db, actor, assignment, draft.id)).id).toBe(assigned.id);
    await expect(saveSubstituteAssignment(db, actor, f.input)).rejects.toThrow("Coverage already exists");
    expect(await db.substituteAssignment.count({ where: { absentStaffMemberId: f.absent.id } })).toBe(1);
    await expect(saveSubstituteAssignment(db, actor, { ...assignment, priority: "URGENT" }, draft.id)).rejects.toThrow("assignment changed");
  });

  it("rechecks newly approved leave and absence before assigning a previously available teacher", async () => {
    const leave = await fixture(); const leaveDraft = await saveSubstituteAssignment(db, actor, { ...leave.input, action: "draft", substituteStaffMemberId: "" });
    await db.staffLeaveRequest.create({ data: { staffMemberId: leave.candidate.id, leaveType: "CASUAL", startDate: new Date(monday), endDate: new Date(monday), totalDays: 1, reason: "SYNTHETIC B leave", status: "APPROVED" } });
    await expect(saveSubstituteAssignment(db, actor, { ...leave.input, expectedUpdatedAt: leaveDraft.updatedAt.toISOString() }, leaveDraft.id)).rejects.toThrow("on approved leave");
    const absent = await fixture(); const absenceDraft = await saveSubstituteAssignment(db, actor, { ...absent.input, action: "draft", substituteStaffMemberId: "" });
    const session = await db.staffAttendanceSession.create({ data: { attendanceDate: new Date("2026-10-12"), status: "SUBMITTED" } });
    await db.staffAttendanceRecord.create({ data: { sessionId: session.id, staffMemberId: absent.candidate.id, status: "ABSENT" } });
    await expect(saveSubstituteAssignment(db, actor, { ...absent.input, assignmentDate: "2026-10-12", expectedUpdatedAt: absenceDraft.updatedAt.toISOString() }, absenceDraft.id)).rejects.toThrow("marked Absent");
  });

  it("refuses unauthorized, revoked, stale-session and stale-record assignments", async () => {
    const f = await fixture();
    await expect(saveSubstituteAssignment(db, teacherActor, f.input)).rejects.toThrow("permission");
    const revoked = await identity("SUPER_ADMIN"); await db.authSession.update({ where: { id: revoked.sessionId }, data: { revokedAt: new Date() } });
    await expect(saveSubstituteAssignment(db, revoked, f.input)).rejects.toThrow("permission");
    const stale = await identity("SUPER_ADMIN"); await db.user.update({ where: { id: stale.userId }, data: { authorizationVersion: { increment: 1 } } });
    await expect(saveSubstituteAssignment(db, stale, f.input)).rejects.toThrow("permission");
    const draft = await saveSubstituteAssignment(db, actor, { ...f.input, action: "draft", substituteStaffMemberId: "" });
    const changed = await saveSubstituteAssignment(db, actor, { action: "edit", notes: "SYNTHETIC changed", expectedUpdatedAt: draft.updatedAt.toISOString() }, draft.id);
    expect(changed.updatedAt.getTime()).toBeGreaterThan(draft.updatedAt.getTime());
    await expect(saveSubstituteAssignment(db, actor, { ...f.input, expectedUpdatedAt: draft.updatedAt.toISOString() }, draft.id)).rejects.toThrow("assignment changed");
  });

  it("validates linked timetable identity, exact year and cohort rather than accepting a forged link", async () => {
    const f = await fixture();
    const assignment = await db.timetableAssignment.create({ data: { academicYear: year, classSectionId: f.classSection.id, subjectId: f.subject.id, teacherId: f.teacher.id, periodsPerWeek: 1 } });
    await expect(validateSubstituteLinks(db, validateSubstituteInput({ ...f.input, timetableAssignmentId: assignment.id }))).rejects.toThrow("absent teacher");
    await db.staffMember.update({ where: { id: f.candidate.id }, data: { timetableTeacherId: null } });
    await db.staffMember.update({ where: { id: f.absent.id }, data: { timetableTeacherId: f.teacher.id } });
    await expect(validateSubstituteLinks(db, validateSubstituteInput({ ...f.input, timetableAssignmentId: assignment.id, academicYear: "2027-28" }))).rejects.toThrow("absent teacher");
    await expect(validateSubstituteLinks(db, validateSubstituteInput({ ...f.input, timetableAssignmentId: assignment.id }))).resolves.toBeUndefined();
  });

  it("persists assigned-to-confirmed-to-completed workflow and refuses stale or invalid transitions", async () => {
    const f = await fixture(); const assigned = await saveSubstituteAssignment(db, actor, f.input);
    await expect(saveSubstituteAssignment(db, actor, { action: "complete", expectedUpdatedAt: assigned.updatedAt.toISOString() }, assigned.id)).rejects.toThrow("Only confirmed");
    const confirmed = await saveSubstituteAssignment(db, actor, { action: "confirm", expectedUpdatedAt: assigned.updatedAt.toISOString() }, assigned.id);
    expect(confirmed).toMatchObject({ status: "CONFIRMED", confirmedByUserId: actor.userId }); expect(confirmed.confirmedAt).toBeInstanceOf(Date);
    await expect(saveSubstituteAssignment(db, actor, { action: "complete", expectedUpdatedAt: assigned.updatedAt.toISOString() }, assigned.id)).rejects.toThrow("assignment changed");
    const completed = await saveSubstituteAssignment(db, actor, { action: "complete", expectedUpdatedAt: confirmed.updatedAt.toISOString() }, assigned.id);
    expect(completed).toMatchObject({ status: "COMPLETED", completedByUserId: actor.userId, confirmedByUserId: actor.userId }); expect(completed.completedAt).toBeInstanceOf(Date);
    expect(await db.substituteAssignment.findUnique({ where: { id: assigned.id } })).toMatchObject({ status: "COMPLETED", confirmedByUserId: actor.userId, completedByUserId: actor.userId });
    await expect(saveSubstituteAssignment(db, actor, { action: "cancel", expectedUpdatedAt: completed.updatedAt.toISOString(), cancellationReason: "SYNTHETIC cancelled" }, assigned.id)).rejects.toThrow("cannot be cancelled");
    await expect(saveSubstituteAssignment(db, actor, { ...f.input, action: "edit", expectedUpdatedAt: completed.updatedAt.toISOString() }, assigned.id)).rejects.toThrow("Only draft or assigned");
  });

  it("rechecks a new regular duty before confirmation and preserves the assigned row on refusal", async () => {
    const f = await fixture(); const assigned = await saveSubstituteAssignment(db, actor, f.input);
    await f.duty();
    await expect(saveSubstituteAssignment(db, actor, { action: "confirm", expectedUpdatedAt: assigned.updatedAt.toISOString() }, assigned.id)).rejects.toThrow("regular timetable duty");
    const persisted = await db.substituteAssignment.findUniqueOrThrow({ where: { id: assigned.id } });
    expect(persisted.status).toBe("ASSIGNED"); expect(persisted.confirmedAt).toBeNull(); expect(persisted.updatedAt).toEqual(assigned.updatedAt);
  });
});
