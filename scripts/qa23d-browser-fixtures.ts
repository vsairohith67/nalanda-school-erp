import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type ExamSubjectPaper } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { createExaminationTimetable, saveExaminationTimetableDraft, transitionExaminationTimetable } from "../lib/examination-timetables";
import { fileSha256 } from "./migration-check-utils";
import type { Role } from "../lib/permissions";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const INDEPENDENT_QA = process.argv.includes("--independent");
const LABEL = INDEPENDENT_QA ? "PARENT23DQA" : "PARENT23D";
const SLUG = INDEPENDENT_QA ? "parent23dqa" : "parent23d";
const CLASS_NAME = INDEPENDENT_QA ? "P23DQA-V" : "P23D-V";
const PORT = INDEPENDENT_QA ? 3219 : 3218;
const ROOT = path.join(WORKSPACE, "tmp", `${SLUG}-browser`);
const DATABASE = path.join(ROOT, `${SLUG}-browser.db`);
const CREDENTIALS = path.join(ROOT, "credentials.json");
const RUNTIME_ENV = path.join(ROOT, "runtime-env.json");
const ACADEMIC_YEAR = "2026-27";
const REASON = `${LABEL} copied production Browser QA evidence`;

function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }

function assertRoot() {
  const resolved = path.resolve(ROOT);
  if (resolved !== path.join(path.resolve(WORKSPACE, "tmp"), `${SLUG}-browser`)) throw new Error("PARENT23D_BROWSER_CLEANUP_SCOPE_REFUSED");
  return resolved;
}

function migrate(environment: NodeJS.ProcessEnv) {
  const pnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  if (!existsSync(pnpmEntry)) throw new Error("PARENT23D_BROWSER_PNPM_RUNTIME_NOT_FOUND");
  const result = spawnSync(process.execPath, [pnpmEntry, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: WORKSPACE, env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`PARENT23D_BROWSER_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim()}`);
}

async function createUser(client: PrismaClient, input: { username: string; name: string; designation: string; roles: Role[]; guardianId?: string; password: string }) {
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(), name: input.name, designation: input.designation, username: input.username,
    passwordHash: await hashPassword(input.password), role: input.roles[0], guardianId: input.guardianId ?? null,
    authLoginAliases: { create: { type: "USERNAME", normalizedValue: input.username, displayMasked: input.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } }
  } });
  const assignments = [];
  for (const role of input.roles) assignments.push(await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role, reason: REASON, assignedByUserId: user.id, activeKey: `${user.id}:${role}` } }));
  return { user, assignments };
}

async function setup() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  const root = assertRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const secret = randomBytes(48).toString("base64url");
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret };
  migrate(environment);
  Object.assign(process.env, environment);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const guardians = await Promise.all([
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${LABEL} Browser One Child`, primaryMobile: "9000023101" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${LABEL} Browser Two Children`, primaryMobile: "9000023102" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${LABEL} Browser Teacher Parent`, primaryMobile: "9000023103" } })
    ]);
    const students = await Promise.all([
      client.student.create({ data: { admissionNo: `${LABEL}-BROWSER-001`, studentName: "Aarav Browser", fatherName: "Synthetic Parent", className: CLASS_NAME, section: "A", rollNo: "5", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: `${LABEL}-BROWSER-002`, studentName: "Diya Browser", fatherName: "Synthetic Parent", className: CLASS_NAME, section: "B", rollNo: "7", phone1: "0000000000" } })
    ]);
    await client.academicYearEnrollment.createMany({ data: students.map((student, index) => ({ studentId: student.id, academicYear: ACADEMIC_YEAR, className: CLASS_NAME, section: index === 0 ? "A" : "B", rollNo: index === 0 ? "5" : "7", status: "ACTIVE" })) });
    await client.studentGuardian.createMany({ data: [
      { guardianId: guardians[0].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[1].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[1].id, studentId: students[1].id },
      { guardianId: guardians[2].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[2].id, studentId: students[1].id }
    ] });
    const principal = await createUser(client, { username: `${SLUG}-browser-principal`, name: `${LABEL} Browser Principal`, designation: "Principal", roles: ["PRINCIPAL"], password });
    const parentOne = await createUser(client, { username: `${SLUG}-browser-parent-one`, name: `${LABEL} Browser One Child Parent`, designation: "Parent", roles: ["PARENT"], guardianId: guardians[0].id, password });
    const parentMany = await createUser(client, { username: `${SLUG}-browser-parent-many`, name: `${LABEL} Browser Multi Child Parent`, designation: "Parent", roles: ["PARENT"], guardianId: guardians[1].id, password });
    const teacherParent = await createUser(client, { username: `${SLUG}-browser-teacher-parent`, name: `${LABEL} Browser Teacher Parent`, designation: "Teacher and Parent", roles: ["TEACHER", "PARENT"], guardianId: guardians[2].id, password });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${LABEL}-BROWSER-TP`, fullName: teacherParent.user.name, designation: "Teacher", userId: teacherParent.user.id } });

    for (const [index, status] of ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"].entries()) {
      await client.studentAttendanceSession.create({ data: {
        attendanceDate: new Date(`2026-08-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
        className: CLASS_NAME, section: "A", academicYear: ACADEMIC_YEAR, status: index === 4 ? "LOCKED" : "SUBMITTED",
        takenByUserId: principal.user.id, submittedByUserId: principal.user.id, submittedAt: new Date("2026-08-01T08:30:00.000Z"),
        lockedByUserId: index === 4 ? principal.user.id : null, lockedAt: index === 4 ? new Date("2026-08-01T09:00:00.000Z") : null,
        notes: `${LABEL} Browser private Teacher note`,
        records: { create: { studentId: students[0].id, admissionNo: students[0].admissionNo, status, remarks: `${LABEL} Browser sensitive private remark` } }
      } });
    }
    await client.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-10T00:00:00.000Z"), className: CLASS_NAME, section: "A", academicYear: ACADEMIC_YEAR, status: "DRAFT", takenByUserId: principal.user.id, records: { create: { studentId: students[0].id, admissionNo: students[0].admissionNo, status: "ABSENT", remarks: "Draft must be hidden" } } } });

    const classA = await client.timetableClassSection.create({ data: { academicYear: ACADEMIC_YEAR, className: CLASS_NAME, section: "A", displayName: `${CLASS_NAME} - A`, groupName: `${LABEL} Browser`, isActive: true } });
    await client.timetableClassSection.create({ data: { academicYear: ACADEMIC_YEAR, className: CLASS_NAME, section: "B", displayName: `${CLASS_NAME} - B`, groupName: `${LABEL} Browser`, isActive: true } });
    const examination = await client.examination.create({ data: { examCode: `${LABEL}-BROWSER-TERM1`, academicYear: ACADEMIC_YEAR, name: "September Term Examination", examType: "TERM", startDate: new Date("2026-09-01T00:00:00.000Z"), endDate: new Date("2026-09-10T00:00:00.000Z"), status: "ACTIVE", createdByUserId: principal.user.id, activatedByUserId: principal.user.id, activatedAt: new Date() } });
    const scope = await client.examinationClassScope.create({ data: { examinationId: examination.id, academicYear: ACADEMIC_YEAR, className: CLASS_NAME, section: "A", timetableClassSectionId: classA.id, status: "ACTIVE", createdByUserId: principal.user.id } });
    const papers: ExamSubjectPaper[] = [];
    for (const [index, name] of ["Mathematics", "Environmental Science"].entries()) {
      const subject = await client.timetableSubject.create({ data: { name: `${LABEL} Browser ${name}`, shortName: `${INDEPENDENT_QA ? "P23DQA" : "P23D"}-${index + 1}`, department: `${LABEL} Browser`, isActive: true } });
      papers.push(await client.examSubjectPaper.create({ data: { examinationId: examination.id, classScopeId: scope.id, academicYear: ACADEMIC_YEAR, className: CLASS_NAME, section: "A", timetableSubjectId: subject.id, subjectNameSnapshot: name, paperCode: `P${index + 1}`, paperName: `${name} Paper`, displayOrder: index + 1, status: "ACTIVE", createdByUserId: principal.user.id } }));
    }
    const actor = { id: principal.user.id, name: principal.user.name, role: "PRINCIPAL" as const };
    const rows = [
      { subjectPaperId: papers[0].id, examDate: "2026-09-02", startTime: "09:00", endTime: "11:00", reportingTime: "08:30", venue: "Room 5", displayOrder: 1 },
      { subjectPaperId: papers[1].id, examDate: "2026-09-04", startTime: "09:00", endTime: "11:00", reportingTime: "08:30", venue: "Room 5", displayOrder: 2 }
    ];
    let initial = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: scope.id, idempotencyKey: `${LABEL}-BROWSER-INITIAL-0001` }, actor);
    initial = await saveExaminationTimetableDraft(client, initial.id, { expectedVersion: initial.version, parentInstructions: "Bring the school identity card and permitted stationery.", rows }, actor);
    initial = await transitionExaminationTimetable(client, initial.id, { action: "ready", expectedVersion: initial.version }, actor);
    initial = await transitionExaminationTimetable(client, initial.id, { action: "publish", expectedVersion: initial.version, reason: "Initial Browser fixture publication" }, actor);
    let replacement = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: scope.id, sourceVersionId: initial.id, idempotencyKey: `${LABEL}-BROWSER-REPLACE-0001` }, actor);
    replacement = await saveExaminationTimetableDraft(client, replacement.id, { expectedVersion: replacement.version, parentInstructions: "Updated timetable: report early with the school identity card.", rows: rows.map((row, index) => ({ ...row, reportingTime: index === 0 ? "08:15" : row.reportingTime })) }, actor);
    replacement = await transitionExaminationTimetable(client, replacement.id, { action: "ready", expectedVersion: replacement.version }, actor);
    replacement = await transitionExaminationTimetable(client, replacement.id, { action: "publish", expectedVersion: replacement.version, reason: "Publish updated Browser fixture", replacementReason: "Reporting time updated for supervised Browser QA" }, actor);
    const principalDraft = await createExaminationTimetable(client, { examinationId: examination.id, classScopeId: scope.id, sourceVersionId: replacement.id, idempotencyKey: `${LABEL}-BROWSER-DRAFT-0001` }, actor);

    writeFileSync(CREDENTIALS, JSON.stringify({
      parentOne: { username: parentOne.user.username, password },
      parentMany: { username: parentMany.user.username, password },
      teacherParent: { username: teacherParent.user.username, password },
      principal: { username: principal.user.username, password },
      principalDraftPath: `/exams/timetable/${principalDraft.id}`
    }));
    writeFileSync(RUNTIME_ENV, JSON.stringify({ DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, APP_ORIGIN: `http://127.0.0.1:${PORT}`, NODE_ENV: "production", PORT: String(PORT) }));
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    if (JSON.stringify(operationalBefore) !== JSON.stringify(operationalAfter)) throw new Error("PARENT23D_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: INDEPENDENT_QA ? "PARENT23DQA_BROWSER_FIXTURES_READY" : "PARENT23D_BROWSER_FIXTURES_READY", fixturePrefix: LABEL, copiedDatabase: true, parents: 3, principal: 1, children: 2, officialAttendanceRows: 5, currentPublishedTimetables: 1, principalDrafts: 1 }));
  } finally {
    await client.$disconnect();
  }
}

function cleanup() {
  const root = assertRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify({ result: INDEPENDENT_QA ? "PARENT23DQA_BROWSER_FIXTURES_REMOVED" : "PARENT23D_BROWSER_FIXTURES_REMOVED", fixturePrefix: LABEL, exists: existsSync(root) }));
}

const mode = process.argv[2];
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
else if (mode === "cleanup") cleanup();
else { console.error("Use setup or cleanup"); process.exitCode = 1; }
