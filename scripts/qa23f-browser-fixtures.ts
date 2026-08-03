import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { createClassworkDraft, publishClassworkVersion, reviewClassworkSubmission, saveSubmissionDraft, submitClasswork } from "../lib/classwork";
import type { ClassworkLearnerContext } from "../lib/classwork-access";
import { ensureDefaultRolePermissions } from "../lib/role-permissions";
import { hashPassword } from "../lib/password";
import type { Role } from "../lib/permissions";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const SUITE = process.argv.includes("--independent") ? "CLASS23FQA" : "CLASS23F";
const ROOT_NAME = `${SUITE.toLowerCase()}-browser`;
const ROOT = path.join(WORKSPACE, "tmp", ROOT_NAME);
const DATABASE = path.join(ROOT, `${ROOT_NAME}.db`);
const CREDENTIALS = path.join(ROOT, "credentials.json");
const RUNTIME_ENV = path.join(ROOT, "runtime-env.json");
const UPLOAD_FIXTURE = path.join(ROOT, "valid-still.png");
const YEAR = "2026-27";
const CLASS_NAME = `${SUITE}-VII`;
const SECTION = "A";
const PREFIX = `${SUITE}-BROWSER`;
const PORT = SUITE === "CLASS23FQA" ? 3222 : 3221;

function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function assertRoot() {
  const resolved = path.resolve(ROOT);
  if (resolved !== path.join(path.resolve(WORKSPACE), "tmp", ROOT_NAME)) throw new Error("CLASS23F_BROWSER_CLEANUP_SCOPE_REFUSED");
  return resolved;
}
function migrate(environment: NodeJS.ProcessEnv) {
  const pnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  if (!existsSync(pnpmEntry)) throw new Error("CLASS23F_BROWSER_PNPM_RUNTIME_NOT_FOUND");
  const result = spawnSync(process.execPath, [pnpmEntry, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: WORKSPACE, env: environment, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`CLASS23F_BROWSER_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}
async function createUser(client: PrismaClient, input: { username: string; name: string; role: Role; password: string; guardianId?: string }) {
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(), name: input.name, designation: input.role === "TEACHER" ? "Teacher" : input.role === "PRINCIPAL" ? "Principal" : input.role === "PARENT" ? "Parent" : "Student",
    username: input.username, passwordHash: await hashPassword(input.password), role: input.role, guardianId: input.guardianId ?? null,
    authLoginAliases: { create: { type: "USERNAME", normalizedValue: input.username, displayMasked: input.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } }
  } });
  const assignment = await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: input.role, reason: `${SUITE} isolated Browser fixture`, assignedByUserId: user.id, activeKey: `${user.id}:${input.role}` } });
  return { user, assignment };
}
function actor(entry: Awaited<ReturnType<typeof createUser>>) {
  return { id: entry.user.id, name: entry.user.name, username: entry.user.username, email: null, designation: entry.user.designation, role: entry.user.role as Role, roleAssignmentId: entry.assignment.id, authorizationVersion: entry.user.authorizationVersion, mustChangePassword: false, guardianId: entry.user.guardianId };
}

async function setup() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  const root = assertRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const secret = randomBytes(48).toString("base64url");
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, APP_ORIGIN: `http://127.0.0.1:${PORT}`, PORT: String(PORT), CLASSWORK_PRIVATE_STORAGE_ROOT: path.join(ROOT, "private-storage") };
  migrate(environment);
  Object.assign(process.env, environment);
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    await ensureDefaultRolePermissions(client);
    const guardian = await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: `${PREFIX} Parent`, primaryMobile: "9000236001" } });
    const students = [];
    for (const [index, name] of ["Aarav", "Diya", "Kabir"].entries()) {
      const student = await client.student.create({ data: { admissionNo: `${PREFIX}-${index + 1}`, studentName: `${name} ${SUITE}`, fatherName: "Synthetic Browser Parent", className: CLASS_NAME, section: SECTION, rollNo: String(index + 1), phone1: "0000000000" } });
      await client.academicYearEnrollment.create({ data: { studentId: student.id, academicYear: YEAR, className: CLASS_NAME, section: SECTION, rollNo: String(index + 1), status: "ACTIVE" } });
      students.push(student);
    }
    await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: students[0].id, isPrimaryContact: true } });
    const slug = SUITE.toLowerCase();
    const principal = await createUser(client, { username: `${slug}-browser-principal`, name: `${PREFIX} Principal`, role: "PRINCIPAL", password });
    const teacher = await createUser(client, { username: `${slug}-browser-teacher`, name: `${PREFIX} Teacher`, role: "TEACHER", password });
    const parent = await createUser(client, { username: `${slug}-browser-parent`, name: `${PREFIX} Parent`, role: "PARENT", guardianId: guardian.id, password });
    const studentUser = await createUser(client, { username: `${slug}-browser-student`, name: `${PREFIX} Student`, role: "STUDENT", password });
    await client.authLoginAlias.create({ data: { userId: studentUser.user.id, type: "ADMISSION_NUMBER", normalizedValue: students[0].admissionNo.toLowerCase(), displayMasked: "***-1", status: "VERIFIED", isSchoolGoverned: true, admissionStudentId: students[0].id, verifiedAt: new Date() } });
    const classSection = await client.timetableClassSection.create({ data: { academicYear: YEAR, className: CLASS_NAME, section: SECTION, displayName: `${CLASS_NAME}-${SECTION}`, groupName: PREFIX, isActive: true } });
    const subject = await client.timetableSubject.create({ data: { name: "Environmental Science", shortName: "C23F-EVS", department: PREFIX, isActive: true } });
    const timetableTeacher = await client.timetableTeacher.create({ data: { name: teacher.user.name, shortName: `${SUITE}-T`, isActive: true, maxPeriodsPerWeek: 30 } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `${SUITE}-BROWSER-T`, fullName: teacher.user.name, designation: "Teacher", status: "ACTIVE", userId: teacher.user.id, timetableTeacherId: timetableTeacher.id } });
    await client.timetableAssignment.create({ data: { academicYear: YEAR, classSectionId: classSection.id, subjectId: subject.id, teacherId: timetableTeacher.id, periodsPerWeek: 5 } });
    const teacherActor = actor(teacher);
    let published = await createClassworkDraft(client, { kind: "ASSIGNMENT", academicYear: YEAR, className: CLASS_NAME, section: SECTION, subjectName: subject.name, timetableSubjectId: subject.id, title: "Water cycle observation", instructions: "Describe evaporation, condensation and precipitation in your own words.", dueAt: new Date(Date.now() - 60_000) }, teacherActor);
    published = await publishClassworkVersion(client, published.item.publicKey, { expectedVersion: published.item.rowVersion, requestKey: `${SUITE}_BROWSER_PUBLISH_0001` }, teacherActor);
    await createClassworkDraft(client, { kind: "HOMEWORK", academicYear: YEAR, className: CLASS_NAME, section: SECTION, subjectName: subject.name, timetableSubjectId: subject.id, title: "Private draft: local habitats", instructions: "Draft instructions visible only to authorised staff.", dueAt: null }, teacherActor);
    const learnerContext: ClassworkLearnerContext = { studentId: students[0].id, studentLabel: students[0].studentName, academicYear: YEAR, className: CLASS_NAME, section: SECTION, actorUserId: parent.user.id, actorRole: "PARENT", guardianId: guardian.id, childHandle: null, contextVersion: null };
    let submission = await saveSubmissionDraft(client, published.item.publicKey, { textBody: "Water rises as vapour, cools into clouds, and returns as rain." }, learnerContext);
    submission = await submitClasswork(client, published.item.publicKey, { expectedVersion: submission.submission.rowVersion, requestKey: `${SUITE}_BROWSER_SUBMIT_0001` }, learnerContext);
    await reviewClassworkSubmission(client, submission.submission.publicKey, { action: "RETURN", body: "Please add one local example before resubmitting.", expectedVersion: submission.submission.rowVersion }, teacherActor);
    await sharp({ create: { width: 16, height: 16, channels: 4, background: "#3b82f6" } }).png().toFile(UPLOAD_FIXTURE);
    writeFileSync(CREDENTIALS, JSON.stringify({
      principal: { username: principal.user.username, password, path: "/classwork" },
      teacher: { username: teacher.user.username, password, path: "/teacher/classwork" },
      parent: { username: parent.user.username, password, path: "/my-classwork" },
      student: { username: studentUser.user.username, password, path: "/my-classwork" },
      uploadFixture: UPLOAD_FIXTURE
    }));
    writeFileSync(RUNTIME_ENV, JSON.stringify({ DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, APP_ORIGIN: `http://127.0.0.1:${PORT}`, NODE_ENV: "production", PORT: String(PORT), CLASSWORK_PRIVATE_STORAGE_ROOT: path.join(ROOT, "private-storage") }));
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    if (JSON.stringify(operationalBefore) !== JSON.stringify(operationalAfter)) throw new Error("CLASS23F_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: `${SUITE}_BROWSER_FIXTURES_READY`, copiedDatabase: true, port: PORT, teachers: 1, parents: 1, students: 3, studentContext: true, published: 1, returned: 1, privateDrafts: 1 }));
  } finally { await client.$disconnect(); }
}

function cleanup() {
  const root = assertRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify({ result: `${SUITE}_BROWSER_FIXTURES_REMOVED`, exists: existsSync(root) }));
}

const mode = process.argv.find((value) => value === "setup" || value === "cleanup");
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
else if (mode === "cleanup") cleanup();
else { console.error("Use setup or cleanup"); process.exitCode = 1; }
