import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type ExamSubjectPaper, type User } from "@prisma/client";
import { fileSha256 } from "./migration-check-utils";
import { listChildContexts, resolveActiveParentChildContext, switchChildContext } from "../lib/iam/contexts";
import { loadParentAttendance, loadParentExaminationTimetables } from "../lib/parent-academics";
import {
  createExaminationTimetable,
  ExaminationTimetableError,
  inspectExaminationTimetable,
  saveExaminationTimetableDraft,
  transitionExaminationTimetable
} from "../lib/examination-timetables";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { emptyExamGovernanceBackup, restoreExamGovernanceBackup, validateExamGovernanceBackup } from "../lib/exam-governance-backup";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const QA_PARENT = path.join(WORKSPACE, "tmp", "parent23d");
const ROOT = path.join(QA_PARENT, `PARENT23D-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "PARENT23D-copied.db");
const RESTORE_DATABASE = path.join(ROOT, "PARENT23D-restore.db");
const PREFIX = `PARENT23D-${process.pid}`;
const ACADEMIC_YEAR = "2026-27";
const secret = randomBytes(48).toString("base64url");
let stage = "preflight";

type Fixture = { user: User; assignmentId: string; sessionId: string };

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) {
  return `file:${file.replaceAll("\\", "/")}`;
}

function runPrisma(args: string[], databasePath = DATABASE) {
  const pnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  invariant(existsSync(pnpmEntry), "PARENT23D_PNPM_RUNTIME_NOT_FOUND");
  const result = spawnSync(process.execPath, [pnpmEntry, "exec", "prisma", ...args], {
    cwd: WORKSPACE,
    env: { ...process.env, DATABASE_URL: databaseUrl(databasePath), SESSION_SECRET: secret, AUTH_SECRET: secret },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.error || result.status !== 0) throw new Error(`PARENT23D_PRISMA_FAILED:${args.join(" ")}:${result.error?.message ?? combined}`);
  return combined;
}

function cleanup() {
  const root = path.resolve(ROOT);
  invariant(root.startsWith(`${path.resolve(QA_PARENT)}${path.sep}`), "PARENT23D_CLEANUP_SCOPE_REFUSED");
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
}

async function createFixture(client: PrismaClient, input: {
  slug: string;
  role: string;
  guardianId?: string;
  extraRoles?: string[];
  parentActive?: boolean;
}) {
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(),
    name: `${PREFIX} ${input.slug}`,
    username: `${PREFIX}-${input.slug}`.toLowerCase(),
    passwordHash: "PARENT23D-NO-LOGIN-CREDENTIAL",
    role: input.role,
    guardianId: input.guardianId ?? null
  } });
  const assignments = [];
  for (const role of [input.role, ...(input.extraRoles ?? [])]) {
    assignments.push(await client.userRoleAssignment.create({ data: {
      publicKey: randomUUID(),
      userId: user.id,
      role,
      status: role === "PARENT" && input.parentActive === false ? "ENDED" : "ACTIVE",
      reason: "PARENT23D copied-database authorization fixture",
      assignedByUserId: user.id,
      activeKey: role === "PARENT" && input.parentActive === false ? null : `${user.id}:${role}`,
      endedAt: role === "PARENT" && input.parentActive === false ? new Date() : null
    } }));
  }
  const activeAssignment = assignments.find((assignment) => assignment.role === input.role && assignment.status === "ACTIVE") ?? assignments[0];
  const session = await client.authSession.create({ data: {
    userId: user.id,
    tokenHash: randomBytes(32).toString("hex"),
    credentialVersion: user.credentialVersion,
    authorizationVersion: user.authorizationVersion,
    activeRoleAssignmentId: activeAssignment.status === "ACTIVE" ? activeAssignment.id : null,
    expiresAt: new Date(Date.now() + 86_400_000),
    deviceSummary: "PARENT23D copied database",
    browserSummary: "PARENT23D QA harness",
    networkEvidenceMasked: "local"
  } });
  return { user, userId: user.id, assignmentId: activeAssignment.id, roleAssignmentId: activeAssignment.id, sessionId: session.id, assignments };
}

async function createStudent(client: PrismaClient, suffix: string, className: string, section: string) {
  const student = await client.student.create({ data: {
    admissionNo: `${PREFIX}-${suffix}`,
    studentName: `${PREFIX} Child ${suffix}`,
    fatherName: "Synthetic Parent",
    className,
    section,
    phone1: "0000000000"
  } });
  await client.academicYearEnrollment.create({ data: {
    studentId: student.id,
    academicYear: ACADEMIC_YEAR,
    className,
    section,
    status: "ACTIVE"
  } });
  return student;
}

async function denied(work: () => Promise<unknown>, expected?: string) {
  try {
    await work();
    return false;
  } catch (error) {
    return !expected || (error instanceof ExaminationTimetableError && error.code === expected) || String(error).includes(expected);
  }
}

async function main() {
  cleanup();
  mkdirSync(ROOT, { recursive: true });
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  Object.assign(process.env, { DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, NODE_ENV: "test" });
  stage = "copied migration";
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"]);
  invariant(/database schema is up to date/i.test(runPrisma(["migrate", "status", "--schema", "prisma/schema.prisma"])), "PARENT23D_MIGRATION_STATUS_DIRTY");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    stage = "authorization fixtures";
    const guardians = await Promise.all([
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} One`, primaryMobile: "9000023001" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Many`, primaryMobile: "9000023002" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Unrelated`, primaryMobile: "9000023003" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Teacher multi-role`, primaryMobile: "9000023004" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Removed`, primaryMobile: "9000023005" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Director multi-role`, primaryMobile: "9000023006" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Inactive Parent`, primaryMobile: "9000023007" } })
    ]);
    const [childOne, childTwo, unrelated, removedChild] = await Promise.all([
      createStudent(client, "001", "V", "A"),
      createStudent(client, "002", "V", "B"),
      createStudent(client, "003", "VI", "A"),
      createStudent(client, "004", "V", "A")
    ]);
    await client.academicYearEnrollment.create({ data: { studentId: childOne.id, academicYear: "2025-26", className: "IV", section: "A", status: "PROMOTED" } });
    const links = await Promise.all([
      client.studentGuardian.create({ data: { guardianId: guardians[0].id, studentId: childOne.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[1].id, studentId: childOne.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[1].id, studentId: childTwo.id } }),
      client.studentGuardian.create({ data: { guardianId: guardians[2].id, studentId: unrelated.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[3].id, studentId: childOne.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[4].id, studentId: removedChild.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[5].id, studentId: childOne.id, isPrimaryContact: true } }),
      client.studentGuardian.create({ data: { guardianId: guardians[6].id, studentId: childOne.id, isPrimaryContact: true } })
    ]);
    const principal = await createFixture(client, { slug: "principal", role: "PRINCIPAL" });
    const parentOne = await createFixture(client, { slug: "parent-one", role: "PARENT", guardianId: guardians[0].id });
    const parentMany = await createFixture(client, { slug: "parent-many", role: "PARENT", guardianId: guardians[1].id });
    const teacherParent = await createFixture(client, { slug: "teacher-parent", role: "TEACHER", guardianId: guardians[3].id, extraRoles: ["PARENT"] });
    const directorParent = await createFixture(client, { slug: "director-parent", role: "DIRECTOR", guardianId: guardians[5].id, extraRoles: ["PARENT"] });
    const inactiveParent = await createFixture(client, { slug: "inactive-parent", role: "PARENT", guardianId: guardians[6].id, parentActive: false });
    const removedParent = await createFixture(client, { slug: "removed-parent", role: "PARENT", guardianId: guardians[4].id });

    stage = "official attendance";
    const statuses = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"];
    for (const [index, status] of statuses.entries()) {
      await client.studentAttendanceSession.create({ data: {
        attendanceDate: new Date(`2026-07-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        className: "V", section: "A", academicYear: ACADEMIC_YEAR,
        status: index === 4 ? "LOCKED" : "SUBMITTED",
        takenByUserId: principal.user.id,
        submittedByUserId: principal.user.id,
        submittedAt: new Date("2026-07-10T08:00:00.000Z"),
        lockedByUserId: index === 4 ? principal.user.id : null,
        lockedAt: index === 4 ? new Date("2026-07-10T09:00:00.000Z") : null,
        notes: "Teacher-private PARENT23D note",
        records: { create: { studentId: childOne.id, admissionNo: childOne.admissionNo, status, remarks: "Sensitive private remark" } }
      } });
    }
    await client.studentAttendanceSession.create({ data: {
      attendanceDate: new Date("2026-07-10T00:00:00.000Z"), className: "V", section: "A", academicYear: ACADEMIC_YEAR,
      status: "DRAFT", takenByUserId: principal.user.id,
      records: { create: { studentId: childOne.id, admissionNo: childOne.admissionNo, status: "ABSENT", remarks: "Must never be disclosed" } }
    } });

    const oneContexts = await listChildContexts(client, { userId: parentOne.user.id, sessionId: parentOne.sessionId });
    invariant(oneContexts.children.length === 1 && !oneContexts.pickerRequired, "PARENT23D_SINGLE_CHILD_DEFAULT_FAILED");
    const attendance = await loadParentAttendance(client, parentOne, { academicYear: ACADEMIC_YEAR, month: "2026-07", childHandle: oneContexts.children[0].handle, expectedContextVersion: oneContexts.contextVersion });
    invariant(attendance.officialRecordedDayCount === 5, "PARENT23D_OFFICIAL_ATTENDANCE_COUNT_FAILED");
    invariant(statuses.every((status) => attendance.counts[status as keyof typeof attendance.counts] === 1) && attendance.counts.total === 5, "PARENT23D_ATTENDANCE_STATUS_COUNTS_FAILED");
    invariant(attendance.attendancePercentage === null && attendance.workingDayCount === null, "PARENT23D_UNGOVERNED_FORMULA_INFERRED");
    invariant(!JSON.stringify(attendance).includes("Sensitive") && !JSON.stringify(attendance).includes(principal.user.id), "PARENT23D_ATTENDANCE_PRIVACY_FAILED");

    const manyContexts = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId });
    invariant(manyContexts.children.length === 2 && manyContexts.pickerRequired, "PARENT23D_MULTI_CHILD_SELECTOR_FAILED");
    invariant(await denied(() => loadParentAttendance(client, parentMany, { academicYear: ACADEMIC_YEAR, month: "2026-07", childHandle: oneContexts.children[0].handle, expectedContextVersion: manyContexts.contextVersion })), "PARENT23D_CROSS_FAMILY_TAMPERING_ALLOWED");
    await switchChildContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId, handle: manyContexts.children[1].handle, expectedVersion: manyContexts.contextVersion });
    const afterSwitch = await listChildContexts(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId });
    invariant(afterSwitch.contextVersion === manyContexts.contextVersion + 1, "PARENT23D_CHILD_CONTEXT_VERSION_NOT_ROTATED");
    invariant(await denied(() => loadParentAttendance(client, parentMany, { academicYear: ACADEMIC_YEAR, month: "2026-07", childHandle: manyContexts.children[1].handle, expectedContextVersion: manyContexts.contextVersion })), "PARENT23D_STALE_CHILD_CONTEXT_ALLOWED");
    invariant(await denied(() => resolveActiveParentChildContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, academicYear: ACADEMIC_YEAR })), "PARENT23D_TEACHER_CONTEXT_LEAKED_PARENT_CHILD");
    invariant(await denied(() => resolveActiveParentChildContext(client, { userId: directorParent.user.id, sessionId: directorParent.sessionId, academicYear: ACADEMIC_YEAR })), "PARENT23D_DIRECTOR_CONTEXT_LEAKED_PARENT_CHILD");
    invariant(await denied(() => resolveActiveParentChildContext(client, { userId: inactiveParent.user.id, sessionId: inactiveParent.sessionId, academicYear: ACADEMIC_YEAR })), "PARENT23D_INACTIVE_PARENT_ROLE_ALLOWED");
    await client.studentGuardian.delete({ where: { id: links[5].id } });
    invariant(await denied(() => resolveActiveParentChildContext(client, { userId: removedParent.user.id, sessionId: removedParent.sessionId, academicYear: ACADEMIC_YEAR })), "PARENT23D_REMOVED_GUARDIAN_LINK_ALLOWED");

    stage = "timetable lifecycle";
    const existingClassSection = await client.timetableClassSection.findFirst({ where: { academicYear: ACADEMIC_YEAR, className: "V", section: "A" } });
    const classSection = existingClassSection
      ? await client.timetableClassSection.update({ where: { id: existingClassSection.id }, data: { isActive: true } })
      : await client.timetableClassSection.create({ data: { academicYear: ACADEMIC_YEAR, className: "V", section: "A", displayName: "V - A", groupName: "PARENT23D", isActive: true } });
    const examination = await client.examination.create({ data: {
      examCode: `${PREFIX}-TERM1`, academicYear: ACADEMIC_YEAR, name: "PARENT23D Term One", examType: "TERM",
      startDate: new Date("2026-09-01T00:00:00.000Z"), endDate: new Date("2026-09-10T00:00:00.000Z"),
      status: "ACTIVE", createdByUserId: principal.user.id, activatedByUserId: principal.user.id, activatedAt: new Date()
    } });
    const scope = await client.examinationClassScope.create({ data: { examinationId: examination.id, academicYear: ACADEMIC_YEAR, className: "V", section: "A", timetableClassSectionId: classSection.id, status: "ACTIVE", createdByUserId: principal.user.id } });
    const papers: ExamSubjectPaper[] = [];
    for (const [index, name] of ["Mathematics", "Science"].entries()) {
      const subject = await client.timetableSubject.create({ data: { name: `${PREFIX} ${name}`, shortName: `P23D-${index + 1}`, department: "Synthetic", isActive: true } });
      papers.push(await client.examSubjectPaper.create({ data: { examinationId: examination.id, classScopeId: scope.id, academicYear: ACADEMIC_YEAR, className: "V", section: "A", timetableSubjectId: subject.id, subjectNameSnapshot: name, paperCode: `P${index + 1}`, paperName: `${name} Paper`, displayOrder: index + 1, status: "ACTIVE", createdByUserId: principal.user.id } }));
    }
    const actor = { id: principal.user.id, name: principal.user.name, role: "PRINCIPAL" as const };
    let draft = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: scope.id, idempotencyKey: `${PREFIX}-CREATE-0001` }, actor);
    invariant((await loadParentExaminationTimetables(client, parentOne, { academicYear: ACADEMIC_YEAR, childHandle: oneContexts.children[0].handle, expectedContextVersion: oneContexts.contextVersion })).timetables.length === 0, "PARENT23D_DRAFT_VISIBLE_TO_PARENT");
    invariant(await denied(() => saveExaminationTimetableDraft(client, draft.id, { expectedVersion: draft.version, rows: [{ subjectPaperId: papers[0].id, examDate: "2026-09-01", startTime: "10:00", endTime: "09:00", displayOrder: 1 }] }, actor)), "PARENT23D_INVALID_TIME_ACCEPTED");
    draft = await saveExaminationTimetableDraft(client, draft.id, { expectedVersion: draft.version, parentInstructions: "Bring the school identity card.", rows: [
      { subjectPaperId: papers[0].id, examDate: "2026-09-01", startTime: "09:00", endTime: "11:00", reportingTime: "08:30", venue: "Room 5", displayOrder: 1 },
      { subjectPaperId: papers[1].id, examDate: "2026-09-03", startTime: "09:00", endTime: "11:00", reportingTime: "08:30", venue: "Room 5", displayOrder: 2 }
    ] }, actor);
    invariant((await inspectExaminationTimetable(client, draft.id)).valid, "PARENT23D_VALID_DRAFT_REJECTED");
    const staleVersion = draft.version;
    draft = await transitionExaminationTimetable(client, draft.id, { action: "ready", expectedVersion: draft.version }, actor);
    invariant(await denied(() => transitionExaminationTimetable(client, draft.id, { action: "publish", expectedVersion: staleVersion, reason: "Initial governed publication" }, actor), "EXAM_TIMETABLE_STALE_VERSION"), "PARENT23D_STALE_PUBLICATION_ALLOWED");
    let published = await transitionExaminationTimetable(client, draft.id, { action: "publish", expectedVersion: draft.version, reason: "Initial governed publication" }, actor);
    const parentPublished = await loadParentExaminationTimetables(client, parentOne, { academicYear: ACADEMIC_YEAR, childHandle: oneContexts.children[0].handle, expectedContextVersion: oneContexts.contextVersion }, new Date("2026-08-01T00:00:00.000Z"));
    invariant(parentPublished.timetables.length === 1 && parentPublished.timetables[0].rows.length === 2 && !parentPublished.timetables[0].updated, "PARENT23D_PUBLISHED_PARENT_VIEW_FAILED");
    invariant(!JSON.stringify(parentPublished).includes(published.id) && !JSON.stringify(parentPublished).includes(principal.user.id), "PARENT23D_TIMETABLE_INTERNALS_LEAKED");
    invariant(await denied(() => client.examinationTimetableRow.update({ where: { id: published.rows[0].id }, data: { venue: "Tampered" } })), "PARENT23D_PUBLISHED_ROW_MUTABLE");
    const eventCount = await client.examinationTimetableEvent.count({ where: { timetableVersionId: published.id } });
    invariant(await denied(() => client.examinationTimetableEvent.deleteMany({ where: { timetableVersionId: published.id } })), "PARENT23D_AUDIT_NOT_APPEND_ONLY");
    invariant(await client.examinationTimetableEvent.count({ where: { timetableVersionId: published.id } }) === eventCount, "PARENT23D_AUDIT_ROLLBACK_FAILED");

    let replacement = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: scope.id, sourceVersionId: published.id, idempotencyKey: `${PREFIX}-REPLACE-0001` }, actor);
    replacement = await saveExaminationTimetableDraft(client, replacement.id, { expectedVersion: replacement.version, parentInstructions: "Updated reporting time; bring the school identity card.", rows: replacement.rows.map((row: any, index: number) => ({ subjectPaperId: row.subjectPaperId, examDate: row.examDate.toISOString().slice(0, 10), startTime: row.startTime, endTime: row.endTime, reportingTime: index === 0 ? "08:15" : row.reportingTime, venue: row.venue, displayOrder: row.displayOrder })) }, actor);
    replacement = await transitionExaminationTimetable(client, replacement.id, { action: "ready", expectedVersion: replacement.version }, actor);
    replacement = await transitionExaminationTimetable(client, replacement.id, { action: "publish", expectedVersion: replacement.version, reason: "Publish corrected reporting time", replacementReason: "Reporting time was advanced by fifteen minutes" }, actor);
    published = await client.examinationTimetableVersion.findUniqueOrThrow({ where: { id: published.id } });
    invariant(published.status === "REPLACED" && replacement.status === "PUBLISHED", "PARENT23D_REPLACEMENT_HISTORY_FAILED");
    const parentReplacement = await loadParentExaminationTimetables(client, parentOne, { academicYear: ACADEMIC_YEAR, childHandle: oneContexts.children[0].handle, expectedContextVersion: oneContexts.contextVersion }, new Date("2026-08-01T00:00:00.000Z"));
    invariant(parentReplacement.timetables.length === 1 && parentReplacement.timetables[0].updated, "PARENT23D_REPLACEMENT_INDICATOR_FAILED");
    const withdrawn = await transitionExaminationTimetable(client, replacement.id, { action: "withdraw", expectedVersion: replacement.version, reason: "Withdrawn for a governed scheduling review" }, actor);
    invariant(withdrawn.status === "WITHDRAWN", "PARENT23D_WITHDRAWAL_FAILED");
    invariant((await loadParentExaminationTimetables(client, parentOne, { academicYear: ACADEMIC_YEAR, childHandle: oneContexts.children[0].handle, expectedContextVersion: oneContexts.contextVersion })).timetables.length === 0, "PARENT23D_WITHDRAWN_VERSION_VISIBLE");

    stage = "backup validation";
    const backup = await generateFullBackup(client, { generatedBy: "PARENT23D copied-database QA" });
    invariant(backup.metadata.backupVersion === 37, "PARENT23D_BACKUP_VERSION_CHANGED");
    invariant(backup.examGovernance.examinationTimetableVersions.length === 2, "PARENT23D_BACKUP_TIMETABLE_VERSIONS_MISSING");
    invariant(backup.examGovernance.examinationTimetableRows.length === 4, "PARENT23D_BACKUP_TIMETABLE_ROWS_MISSING");
    invariant(backup.examGovernance.examinationTimetableEvents.length >= 8, "PARENT23D_BACKUP_TIMETABLE_EVENTS_MISSING");
    parseAndValidateBackup(serializeBackup(backup));

    stage = "restore rehearsal";
    closeSync(openSync(RESTORE_DATABASE, "wx"));
    runPrisma(["migrate", "deploy", "--schema", "prisma/schema.prisma"], RESTORE_DATABASE);
    const restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(RESTORE_DATABASE) });
    try {
      await restoreClient.timetableClassSection.create({ data: {
        id: classSection.id,
        academicYear: classSection.academicYear,
        className: classSection.className,
        section: classSection.section,
        displayName: classSection.displayName,
        groupName: classSection.groupName,
        isActive: true
      } });
      const sourceSubjects = await client.timetableSubject.findMany({ where: { id: { in: papers.map((paper) => paper.timetableSubjectId) } } });
      for (const subject of sourceSubjects) {
        await restoreClient.timetableSubject.create({ data: { id: subject.id, name: subject.name, shortName: subject.shortName, department: subject.department, isActive: subject.isActive } });
      }
      const subset = emptyExamGovernanceBackup();
      subset.examinations = backup.examGovernance.examinations.filter((row) => row.id === examination.id);
      subset.examinationClassScopes = backup.examGovernance.examinationClassScopes.filter((row) => row.id === scope.id);
      subset.examSubjectPapers = backup.examGovernance.examSubjectPapers.filter((row) => row.examinationId === examination.id);
      subset.examinationTimetableVersions = backup.examGovernance.examinationTimetableVersions.filter((row) => row.examinationId === examination.id);
      const versionIds = new Set(subset.examinationTimetableVersions.map((row) => String(row.id)));
      subset.examinationTimetableRows = backup.examGovernance.examinationTimetableRows.filter((row) => versionIds.has(String(row.timetableVersionId)));
      subset.examinationTimetableEvents = backup.examGovernance.examinationTimetableEvents.filter((row) => versionIds.has(String(row.timetableVersionId)));
      const restoreResult = await restoreExamGovernanceBackup(restoreClient, validateExamGovernanceBackup(subset), new Map());
      invariant(restoreResult.errors.length === 0, `PARENT23D_RESTORE_ERRORS:${restoreResult.errors.join("|")}`);
      invariant(await restoreClient.examinationTimetableVersion.count() === 2, "PARENT23D_RESTORE_VERSION_COUNT_FAILED");
      invariant(await restoreClient.examinationTimetableRow.count() === 4, "PARENT23D_RESTORE_ROW_COUNT_FAILED");
      invariant(await restoreClient.examinationTimetableEvent.count() === subset.examinationTimetableEvents.length, "PARENT23D_RESTORE_EVENT_COUNT_FAILED");
      const restoredPublishedHistory = await restoreClient.examinationTimetableVersion.findMany({ orderBy: { versionNumber: "asc" } });
      invariant(restoredPublishedHistory[0]?.status === "REPLACED" && restoredPublishedHistory[1]?.status === "WITHDRAWN", "PARENT23D_RESTORE_HISTORY_STATE_FAILED");
    } finally {
      await restoreClient.$disconnect();
    }
  } finally {
    await client.$disconnect();
  }
  const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  invariant(JSON.stringify(operationalAfter) === JSON.stringify(operationalBefore), "PARENT23D_OPERATIONAL_DATABASE_MUTATED");
  console.log(JSON.stringify({ result: "PARENT23D_COPIED_DATABASE_QA_PASSED", operationalDatabaseUnchanged: true, migrationDeployIdempotent: true, officialAttendanceCounts: true, crossFamilyLeakage: 0, parentContextFailClosed: true, publishedOnly: true, replacementHistory: true, staleVersionRefused: true, rollbackEvidence: true, backupRestoreCoverage: true }));
}

main().catch((error) => {
  console.error(JSON.stringify({ result: "PARENT23D_COPIED_DATABASE_QA_FAILED", stage, error: error instanceof Error ? error.message : "unknown" }));
  process.exitCode = 1;
}).finally(cleanup);
