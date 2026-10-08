import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { DatabaseSync, backup } from "node:sqlite";
import { mkdtempSync, readFileSync, readdirSync, lstatSync, realpathSync, rmSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { withTimetableMutation, type TimetableMutationScope } from "@/lib/timetable-mutation-service";
import { saveSubstituteAssignment, type SubstituteActor } from "@/lib/substitute-assignment-service";
import { assertSyntheticPostgresQa } from "../scripts/postgres/synthetic-qa";

// Real production readers, IAM and persistence on a newly created synthetic
// provider target. No auth/service doubles, copied database or operational URL.
const root = mkdtempSync(path.join(tmpdir(), "nps-timetable-invariant-1a-"));
const createdRoot = lstatSync(root);
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const ownedSchema = `nps_timetable_${randomUUID().replaceAll("-", "")}`;
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
  if (postgres && db) { if (!/^nps_timetable_[a-f0-9]{32}$/.test(ownedSchema)) throw new Error("SYNTHETIC_SCHEMA_CLEANUP_SCOPE_REFUSED"); await db.$executeRawUnsafe(`DROP SCHEMA "${ownedSchema}" CASCADE`); }
  await Promise.all([db?.$disconnect(), contender?.$disconnect()]);
  const settledRoot = lstatSync(root);
  expect(settledRoot.isSymbolicLink()).toBe(false); expect(realpathSync(root)).toBe(root);
  expect(settledRoot.dev).toBe(createdRoot.dev); expect(settledRoot.ino).toBe(createdRoot.ino);
  expect(path.dirname(root)).toBe(tmpdir()); expect(path.basename(root).startsWith("nps-timetable-invariant-1a-")).toBe(true);
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

type Fixture = Awaited<ReturnType<typeof fixture>>;
function regular(client: PrismaClient, f: Fixture, overrides: Record<string, unknown> = {}) {
  return withTimetableMutation(client, actor, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: f.draft.id }, tx =>
    tx.timetableEntry.create({ data: { draftId: f.draft.id, academicYear: year, classSectionId: f.classSection.id,
      teacherId: f.teacher.id, subjectId: f.subject.id, dayOfWeek: "MONDAY", periodNumber: 1, entryType: "TEACHING", ...overrides } }));
}
function activate(client: PrismaClient, f: Fixture) {
  return withTimetableMutation(client, actor, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: f.draft.id }, async tx => {
    await tx.timetableDraft.updateMany({ where: { academicYear: year, status: "ACTIVE", id: { not: f.draft.id } }, data: { status: "DRAFT" } });
    return tx.timetableDraft.update({ where: { id: f.draft.id }, data: { status: "ACTIVE" } });
  });
}

describe("requirement025 bidirectional timetable invariant on actual provider transactions", () => {
  it("permits unrelated metadata and inactive draft edits without re-admitting an old conflict", async () => {
    const f = await fixture(); await saveSubstituteAssignment(db, actor, f.input); await f.duty(); // Deliberately inherited inconsistent fixture.
    await expect(withTimetableMutation(db, actor, "MANAGE_STAFF", { kind: "staff", id: f.candidate.id }, tx => tx.staffMember.update({ where: { id: f.candidate.id }, data: { fullName: "SYNTHETIC renamed only" } }))).resolves.toMatchObject({ fullName: "SYNTHETIC renamed only" });
    await expect(withTimetableMutation(db, actor, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: f.draft.id }, tx => tx.timetableDraft.update({ where: { id: f.draft.id }, data: { notes: "SYNTHETIC metadata only" } }))).resolves.toMatchObject({ notes: "SYNTHETIC metadata only" });
    const inactive = await db.timetableDraft.create({ data: { academicYear: year, name: `SYNTHETIC unreviewed ${randomUUID()}`, status: "DRAFT" } });
    await expect(withTimetableMutation(db, actor, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: inactive.id }, tx => tx.timetableEntry.create({ data: { draftId: inactive.id, academicYear: year, classSectionId: f.classSection.id, teacherId: f.teacher.id, dayOfWeek: "MONDAY", periodNumber: 1, entryType: "TEACHING" } }))).resolves.toMatchObject({ draftId: inactive.id });
    expect(await db.substituteAssignment.count({ where: { substituteStaffMemberId: f.candidate.id } })).toBe(1);
  });

  it("does not treat a different academic year's substitution as a same-date booking", async () => {
    const f = await fixture(); await saveSubstituteAssignment(db, actor, { ...f.input, academicYear: "2027-28", assignmentDate: "2027-10-04" });
    await expect(regular(db, f)).resolves.toMatchObject({ academicYear: year });
  });

  it("refuses staff reactivation when its retained substitute and regular bookings conflict", async () => {
    const f = await fixture(); await saveSubstituteAssignment(db, actor, f.input);
    await db.staffMember.update({ where: { id: f.candidate.id }, data: { status: "INACTIVE" } }); await regular(db, f);
    await expect(withTimetableMutation(db, actor, "MANAGE_STAFF", { kind: "staff", id: f.candidate.id }, tx => tx.staffMember.update({ where: { id: f.candidate.id }, data: { status: "ACTIVE" } }))).rejects.toThrow("regular timetable duty");
    expect((await db.staffMember.findUniqueOrThrow({ where: { id: f.candidate.id } })).status).toBe("INACTIVE");
  });
  it("refuses substitute after regular and regular after substitute without deleting either existing duty", async () => {
    const first = await fixture(); await regular(db, first);
    await expect(saveSubstituteAssignment(db, actor, first.input)).rejects.toThrow("regular timetable duty");
    expect(await db.timetableEntry.count({ where: { draftId: first.draft.id } })).toBe(1);
    const second = await fixture(); const assigned = await saveSubstituteAssignment(db, actor, second.input);
    await expect(regular(db, second)).rejects.toThrow("regular timetable duty");
    expect(await db.timetableEntry.count({ where: { draftId: second.draft.id } })).toBe(0);
    expect(await db.substituteAssignment.findUnique({ where: { id: assigned.id } })).toMatchObject({ status: "ASSIGNED", updatedAt: assigned.updatedAt });
  });

  it("rolls back an existing entry edit and an entire conflicting draft activation", async () => {
    const f = await fixture(); const entry = await regular(db, f, { dayOfWeek: "TUESDAY" });
    await saveSubstituteAssignment(db, actor, f.input);
    await expect(withTimetableMutation(db, actor, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: f.draft.id }, tx =>
      tx.timetableEntry.update({ where: { id: entry.id }, data: { dayOfWeek: "MONDAY" } }))).rejects.toThrow("regular timetable duty");
    expect((await db.timetableEntry.findUniqueOrThrow({ where: { id: entry.id } })).dayOfWeek).toBe("TUESDAY");
    const draft = await fixture(); await db.timetableDraft.update({ where: { id: draft.draft.id }, data: { status: "DRAFT" } });
    await regular(db, draft); await saveSubstituteAssignment(db, actor, draft.input);
    await expect(activate(db, draft)).rejects.toThrow("regular timetable duty");
    expect((await db.timetableDraft.findUniqueOrThrow({ where: { id: draft.draft.id } })).status).toBe("DRAFT");
    expect((await db.timetableDraft.findUniqueOrThrow({ where: { id: f.draft.id } })).status).toBe("ACTIVE");
  });

  it("allows one half-open adjacent duty and releases only cancelled substitute coverage", async () => {
    const f = await fixture(); await saveSubstituteAssignment(db, actor, { ...f.input, periodStartTime: "09:40", periodEndTime: "10:20" });
    await expect(regular(db, f)).resolves.toMatchObject({ teacherId: f.teacher.id });
    const cancelled = await fixture(); const assigned = await saveSubstituteAssignment(db, actor, cancelled.input);
    await saveSubstituteAssignment(db, actor, { action: "cancel", expectedUpdatedAt: assigned.updatedAt.toISOString(), cancellationReason: "SYNTHETIC released" }, assigned.id);
    await expect(regular(db, cancelled)).resolves.toMatchObject({ teacherId: cancelled.teacher.id });
  });

  it("uses actual Friday timing and fails closed for an unknown period", async () => {
    const friday = await fixture(); await saveSubstituteAssignment(db, actor, { ...friday.input, assignmentDate: "2026-10-09", periodStartTime: "08:20", periodEndTime: "09:00" });
    await expect(regular(db, friday, { dayOfWeek: "FRIDAY" })).rejects.toThrow("regular timetable duty");
    const unknown = await fixture(); await saveSubstituteAssignment(db, actor, unknown.input);
    await expect(regular(db, unknown, { periodNumber: 99 })).rejects.toThrow("availability cannot be verified");
    expect(await db.timetableEntry.count({ where: { draftId: unknown.draft.id } })).toBe(0);
  });

  it.each(["teacher", "class", "subject"] as const)("refuses %s reactivation that would introduce a conflict", async kind => {
    const f = await fixture(); await regular(db, f);
    const id = kind === "teacher" ? f.teacher.id : kind === "class" ? f.classSection.id : f.subject.id;
    if (kind === "teacher") await db.timetableTeacher.update({ where: { id }, data: { isActive: false } });
    if (kind === "class") await db.timetableClassSection.update({ where: { id }, data: { isActive: false } });
    if (kind === "subject") await db.timetableSubject.update({ where: { id }, data: { isActive: false } });
    await saveSubstituteAssignment(db, actor, f.input);
    await expect(withTimetableMutation<unknown>(db, actor, "MANAGE_TIMETABLE_MASTER", { kind, id }, tx =>
      kind === "teacher" ? tx.timetableTeacher.update({ where: { id }, data: { isActive: true } }) :
      kind === "class" ? tx.timetableClassSection.update({ where: { id }, data: { isActive: true } }) :
      tx.timetableSubject.update({ where: { id }, data: { isActive: true } }))).rejects.toThrow("regular timetable duty");
  });

  it("refuses a late canonical teacher link and preserves the unlinked staff record", async () => {
    const f = await fixture(); await regular(db, f);
    await db.staffMember.update({ where: { id: f.candidate.id }, data: { timetableTeacherId: null } });
    await saveSubstituteAssignment(db, actor, f.input);
    await expect(withTimetableMutation(db, actor, "MANAGE_STAFF", { kind: "staff", id: f.candidate.id }, tx =>
      tx.staffMember.update({ where: { id: f.candidate.id }, data: { timetableTeacherId: f.teacher.id } }))).rejects.toThrow("regular timetable duty");
    expect((await db.staffMember.findUniqueOrThrow({ where: { id: f.candidate.id } })).timetableTeacherId).toBeNull();
  });

  it("refuses a template timing edit that changes adjacency into overlap", async () => {
    const f = await fixture(); await regular(db, f); await saveSubstituteAssignment(db, actor, { ...f.input, periodStartTime: "09:40", periodEndTime: "10:20" });
    const template = await db.timetablePeriodTemplate.findFirstOrThrow({ where: { academicYear: year, dayOfWeek: "MONDAY", groupName: "VI-X", periodNumber: 1 } });
    await expect(withTimetableMutation(db, actor, "MANAGE_TIMETABLE_MASTER", { kind: "period-template", id: template.id }, tx =>
      tx.timetablePeriodTemplate.update({ where: { id: template.id }, data: { endTime: "09:41" } }))).rejects.toThrow("regular timetable duty");
    expect((await db.timetablePeriodTemplate.findUniqueOrThrow({ where: { id: template.id } })).endTime).toBe("09:40");
  });

  it("arbitrates simultaneous regular/substitute writes from independent real clients", async () => {
    const f = await fixture();
    const results = await Promise.allSettled([regular(db, f), saveSubstituteAssignment(contender, actor, f.input)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    const [entries, substitutes] = await Promise.all([db.timetableEntry.count({ where: { draftId: f.draft.id } }), db.substituteAssignment.count({ where: { substituteStaffMemberId: f.candidate.id } })]);
    expect(entries + substitutes).toBe(1);
  });

  it("arbitrates a simultaneous activation and substitute without leaving a double booking", async () => {
    const f = await fixture(); await db.timetableDraft.update({ where: { id: f.draft.id }, data: { status: "DRAFT" } }); await regular(db, f);
    const results = await Promise.allSettled([activate(db, f), saveSubstituteAssignment(contender, actor, f.input)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const active = (await db.timetableDraft.findUniqueOrThrow({ where: { id: f.draft.id } })).status === "ACTIVE";
    const assignments = await db.substituteAssignment.count({ where: { substituteStaffMemberId: f.candidate.id } });
    expect(Number(active) + assignments).toBe(1);
  });

  it("keeps only one effective draft after independent overlapping activations", async () => {
    const a = await fixture(), b = await fixture();
    await db.timetableDraft.updateMany({ where: { id: { in: [a.draft.id, b.draft.id] } }, data: { status: "DRAFT" } });
    await regular(db, a); await regular(db, b);
    const results = await Promise.allSettled([activate(db, a), activate(contender, b)]);
    expect(results.some(result => result.status === "fulfilled")).toBe(true);
    expect(await db.timetableDraft.count({ where: { academicYear: year, status: "ACTIVE" } })).toBe(1);
  });

  it("rechecks current permissions, revocation and credentials before writing", async () => {
    const f = await fixture(); const scope: TimetableMutationScope = { kind: "draft", id: f.draft.id };
    const edit = (who: SubstituteActor) => withTimetableMutation(db, who, "MANAGE_TIMETABLE_BUILDER", scope, tx => tx.timetableDraft.update({ where: { id: f.draft.id }, data: { notes: "UNAUTHORIZED" } }));
    await expect(edit(teacherActor)).rejects.toThrow("permission");
    const revoked = await identity("SUPER_ADMIN"); await db.userRoleAssignment.update({ where: { id: revoked.roleAssignmentId }, data: { status: "REVOKED", endedAt: new Date() } });
    await expect(edit(revoked)).rejects.toThrow("permission");
    const stale = await identity("SUPER_ADMIN"); await db.user.update({ where: { id: stale.userId }, data: { credentialVersion: { increment: 1 } } });
    await expect(edit(stale)).rejects.toThrow(/session|permission/);
    expect((await db.timetableDraft.findUniqueOrThrow({ where: { id: f.draft.id } })).notes).toBeNull();
  });
});

