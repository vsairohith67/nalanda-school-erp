import { createHash, randomBytes, randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { grantMarksDelegation, listMarksDelegationAdministration } from "../lib/academic-integrity";

const workspace = path.resolve(".");
const ignoredRoot = path.resolve(workspace, "tmp", "product-experience-1a");
const databasePath = path.join(ignoredRoot, "synthetic.db");
const credentialsPath = path.join(ignoredRoot, "browser-credentials.json");
const manifestPath = path.join(ignoredRoot, "fixture-manifest.json");
const operationalPath = path.resolve(workspace, "prisma", "dev.db");
const databaseUrl = `file:${databasePath.replaceAll("\\", "/")}`;

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function canonical(candidate: string) {
  const resolved = path.resolve(candidate);
  return existsSync(resolved) ? realpathSync.native(resolved) : resolved;
}

function sameFile(left: string, right: string) {
  if (!existsSync(left) || !existsSync(right)) return false;
  const leftStat = statSync(left, { bigint: true });
  const rightStat = statSync(right, { bigint: true });
  return leftStat.dev === rightStat.dev && leftStat.ino === rightStat.ino;
}

function checkedRoot() {
  const parent = path.resolve(workspace, "tmp");
  const resolved = path.resolve(ignoredRoot);
  invariant(resolved.startsWith(`${parent}${path.sep}`) && resolved.endsWith(`${path.sep}product-experience-1a`), "PRODUCT_EXPERIENCE_FIXTURE_SCOPE_REFUSED");
  return resolved;
}

function cleanup() {
  const target = checkedRoot();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

function run(command: string, args: string[], environment: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { cwd: workspace, env: environment, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(`PRODUCT_EXPERIENCE_FIXTURE_COMMAND_FAILED:${command}:${args.join(" ")}:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createPersonaUser(prisma: PrismaClient, role: string, username: string, name: string, password: string) {
  const id = randomUUID();
  const iamPublicKey = randomUUID();
  await prisma.user.create({ data: { id, iamPublicKey, name, designation: `${role.replaceAll("_", " ")} synthetic persona`, username, email: `${username}@example.test`, passwordHash: await hashPassword(password), role, isActive: true, lifecycleStatus: "ACTIVE" } });
  await prisma.authLoginAlias.create({ data: { id: `px1a_${username}`, userId: id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await prisma.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: id, role, reason: "PRODUCT-EXPERIENCE-1A isolated synthetic persona", activeKey: `${id}:${role}` } });
  return { id, iamPublicKey, username, password, role, name };
}

async function main() {
  if (process.argv[2] === "cleanup") {
    cleanup();
    console.log("PRODUCT_EXPERIENCE_SYNTHETIC_FIXTURE_CLEANED");
    return;
  }
  invariant(process.env.PRODUCT_EXPERIENCE_SYNTHETIC_OPT_IN === "true", "PRODUCT_EXPERIENCE_SYNTHETIC_OPT_IN_REQUIRED");
  invariant(process.env.NALANDA_ENVIRONMENT === "TEST" && process.env.NODE_ENV !== "production", "PRODUCT_EXPERIENCE_SYNTHETIC_ENVIRONMENT_REFUSED");
  cleanup();
  mkdirSync(checkedRoot(), { recursive: true });
  invariant(canonical(databasePath).toLowerCase() !== canonical(operationalPath).toLowerCase() && !sameFile(databasePath, operationalPath), "PRODUCT_EXPERIENCE_OPERATIONAL_DATABASE_REFUSED");
  closeSync(openSync(databasePath, "wx"));

  const seedPasswords = {
    director: `PX1A-Director-${randomBytes(12).toString("hex")}!`,
    admin: `PX1A-Admin-${randomBytes(12).toString("hex")}!`,
    accountant: `PX1A-Accountant-${randomBytes(12).toString("hex")}!`,
    viewer: `PX1A-Viewer-${randomBytes(12).toString("hex")}!`
  };
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    DATABASE_URL: databaseUrl,
    NODE_ENV: "development",
    NALANDA_ENVIRONMENT: "TEST",
    ALLOW_DEMO_USERS: "true",
    DEMO_USER_DATABASE_ROOT: ignoredRoot,
    ALLOW_DEMO_BUSINESS_DATA: "true",
    DEMO_BUSINESS_DATA_ROOT: ignoredRoot,
    SEED_DIRECTOR_PASSWORD: seedPasswords.director,
    SEED_ADMIN_PASSWORD: seedPasswords.admin,
    SEED_ACCOUNTANT_PASSWORD: seedPasswords.accountant,
    SEED_VIEWER_PASSWORD: seedPasswords.viewer
  };
  run(process.execPath, [path.join(workspace, "node_modules", "prisma", "build", "index.js"), "migrate", "deploy", "--schema", "prisma/schema.prisma"], environment);
  run(process.execPath, [path.join(workspace, "node_modules", "tsx", "dist", "cli.mjs"), "prisma/seed.ts"], environment);

  const prisma = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const director = await prisma.user.findUniqueOrThrow({ where: { username: "director" } });
    await prisma.$transaction([
      prisma.user.update({ where: { id: director.id }, data: { role: "SUPER_ADMIN", designation: "Super Admin synthetic persona" } }),
      prisma.userRoleAssignment.updateMany({ where: { userId: director.id, status: "ACTIVE" }, data: { role: "SUPER_ADMIN", activeKey: `${director.id}:SUPER_ADMIN`, reason: "PRODUCT-EXPERIENCE-1A isolated synthetic Super Admin" } })
    ]);

    const password = (label: string) => `PX1A-${label}-${randomBytes(12).toString("hex")}!`;
    const personas = [
      { id: director.id, iamPublicKey: director.iamPublicKey, username: "director", password: seedPasswords.director, role: "SUPER_ADMIN", name: "Synthetic Super Admin" },
      await createPersonaUser(prisma, "PRINCIPAL", "px1a-principal", "Synthetic Principal", password("Principal")),
      await createPersonaUser(prisma, "DIRECTOR", "px1a-director", "Synthetic Director", password("Director")),
      { id: (await prisma.user.findUniqueOrThrow({ where: { username: "accountant" } })).id, username: "accountant", password: seedPasswords.accountant, role: "ACCOUNTANT", name: "Synthetic Accountant" },
      await createPersonaUser(prisma, "COMPUTER_OPERATOR", "px1a-operator", "Synthetic Computer Operator", password("Operator")),
      await createPersonaUser(prisma, "COMPUTER_OPERATOR", "px1a-marks", "Synthetic Marks Entry Operator", password("MarksOperator")),
      await createPersonaUser(prisma, "TEACHER", "px1a-teacher", "Synthetic Teacher", password("Teacher")),
      await createPersonaUser(prisma, "PARENT", "px1a-parent", "Synthetic Parent", password("Parent")),
      await createPersonaUser(prisma, "GATE_STAFF", "px1a-gate", "Synthetic Gate Staff", password("Gate")),
      { id: (await prisma.user.findUniqueOrThrow({ where: { username: "viewer" } })).id, username: "viewer", password: seedPasswords.viewer, role: "VIEWER", name: "Synthetic Viewer" }
    ];
    const teacher = personas.find((persona) => persona.role === "TEACHER")!;
    const principal = personas.find((persona) => persona.role === "PRINCIPAL")!;
    const parent = personas.find((persona) => persona.role === "PARENT")!;
    const operator = personas.find((persona) => persona.role === "COMPUTER_OPERATOR")!;

    const staffRows = await Promise.all([
      prisma.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "PX1A-T001", fullName: "Synthetic Teacher", displayName: "Ms Synthetic Teacher", designation: "Teacher", department: "Academics", primarySubject: "Mathematics", qualification: "Synthetic qualification", experienceYears: 8, dateOfJoining: new Date("2018-06-01T00:00:00.000Z"), status: "ACTIVE", userId: teacher.id } }),
      prisma.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "PX1A-P001", fullName: "Synthetic Principal", designation: "Principal", department: "Leadership", status: "ACTIVE", userId: principal.id } }),
      prisma.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "PX1A-O001", fullName: "Synthetic Computer Operator", designation: "Computer Operator", department: "Operations", status: "ACTIVE", userId: operator.id } })
    ]);
    const students = await prisma.student.findMany({ orderBy: { admissionNo: "asc" } });
    invariant(students.length >= 8, "PRODUCT_EXPERIENCE_SYNTHETIC_STUDENTS_MISSING");
    await prisma.academicYearEnrollment.createMany({ data: students.map((student) => ({ studentId: student.id, academicYear: student.academicYear, className: student.className, section: student.section, rollNo: student.rollNo, status: "ACTIVE", enrollmentDate: new Date("2026-06-01T00:00:00.000Z") })) });
    const syntheticExam = await prisma.examCycle.create({ data: { examCode: "PX1A-EXAM", academicYear: students[0].academicYear, name: "Synthetic Product Experience Examination", examType: "UNIT_TEST", startDate: new Date("2026-08-24T00:00:00.000Z"), endDate: new Date("2026-08-31T00:00:00.000Z"), status: "OPEN_FOR_ENTRY", createdByUserId: director.id, openedByUserId: director.id, openedAt: new Date("2026-08-24T00:00:00.000Z") } });
    const syntheticAssessment = await prisma.examAssessment.create({ data: { examCycleId: syntheticExam.id, academicYear: students[0].academicYear, className: students[0].className, section: students[0].section ?? "", subjectName: "Mathematics", componentName: "Main", assessmentType: "MARKS", maxMarks: 100, passMarks: 35, entryStatus: "OPEN", instructions: "Synthetic exact-scope marks acceptance only.", createdByUserId: director.id } });
    await prisma.studentMark.create({ data: { assessmentId: syntheticAssessment.id, studentId: students[0].id, academicYear: students[0].academicYear, entryStatus: "PRESENT" } });
    const guardian = await prisma.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "Synthetic Parent", primaryMobile: "9000000999", email: "px1a-parent@example.test", relationship: "Parent", status: "Active" } });
    await prisma.$transaction([
      prisma.studentGuardian.create({ data: { guardianId: guardian.id, studentId: students[0].id, relationshipToStudent: "Parent", isPrimaryContact: true, canViewFees: true, canReceiveReminders: true } }),
      prisma.user.update({ where: { id: parent.id }, data: { guardianId: guardian.id } })
    ]);
    const studentSession = await prisma.studentAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-25T00:00:00.000Z"), className: students[0].className, section: students[0].section ?? "", academicYear: students[0].academicYear, status: "LOCKED", takenByUserId: teacher.id, submittedByUserId: teacher.id, lockedByUserId: principal.id, submittedAt: new Date("2026-08-25T04:30:00.000Z"), lockedAt: new Date("2026-08-25T05:00:00.000Z"), notes: "Synthetic review attendance" } });
    await prisma.studentAttendanceRecord.create({ data: { sessionId: studentSession.id, studentId: students[0].id, admissionNo: students[0].admissionNo, status: "PRESENT", remarks: "Synthetic record" } });
    const staffSession = await prisma.staffAttendanceSession.create({ data: { attendanceDate: new Date("2026-08-25T00:00:00.000Z"), academicYear: "2026-27", status: "LOCKED", takenByUserId: principal.id, submittedByUserId: principal.id, lockedByUserId: director.id, submittedAt: new Date("2026-08-25T04:30:00.000Z"), lockedAt: new Date("2026-08-25T05:00:00.000Z"), notes: "Synthetic review attendance" } });
    await prisma.staffAttendanceRecord.createMany({ data: staffRows.map((staff, index) => ({ sessionId: staffSession.id, staffMemberId: staff.id, staffCode: staff.staffCode, status: index === 2 ? "LATE" : "PRESENT", checkInTime: index === 2 ? "09:18" : "08:45", checkOutTime: "16:30", lateMinutes: index === 2 ? 18 : 0, source: "SYNTHETIC_MANUAL" })) });
    await prisma.notice.create({ data: { title: "Synthetic product-experience review", body: "This announcement contains synthetic data only.", audienceType: "ALL_STAFF", status: "PUBLISHED", publishDate: new Date("2026-08-26T00:00:00.000Z"), createdById: director.id, updatedById: director.id } });

    const marksPersona = personas.find((persona) => persona.username === "px1a-marks")!;
    const syntheticActor = { id: director.id, name: "Synthetic Super Admin", role: "SUPER_ADMIN" as const };
    const delegationAdministration = await listMarksDelegationAdministration(prisma, syntheticActor);
    const exactMarksScope = delegationAdministration.scopes[0];
    invariant(exactMarksScope, "PRODUCT_EXPERIENCE_SYNTHETIC_MARKS_SCOPE_MISSING");
    await grantMarksDelegation(prisma, syntheticActor, {
      userHandle: marksPersona.iamPublicKey,
      kind: exactMarksScope.kind,
      targetId: exactMarksScope.targetId,
      reason: "PRODUCT-EXPERIENCE-1A isolated exact-scope synthetic acceptance"
    });
    const credentials = {
      synthetic: true,
      generatedAt: new Date().toISOString(),
      personas: personas.map(({ username, password, role, name }) => ({ username, password, role, name })),
      marksEntryOperator: {
        username: marksPersona.username,
        password: marksPersona.password,
        role: marksPersona.role,
        activation: "ACTIVE_EXACT_SYNTHETIC_SCOPE",
        reviewRoute: "/marks/governed"
      }
    };
    writeFileSync(credentialsPath, `${JSON.stringify(credentials, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
    const databaseSha256 = createHash("sha256").update(readFileSync(databasePath)).digest("hex");
    writeFileSync(manifestPath, `${JSON.stringify({ synthetic: true, databasePath, databaseSha256, credentialsPath, studentId: students[0].id, staffId: staffRows[0].id, counts: { personas: personas.length, students: students.length, staff: staffRows.length } }, null, 2)}\n`);
    console.log(JSON.stringify({ verdict: "PASS", synthetic: true, databasePath, credentialsPath, manifestPath, students: students.length, staff: staffRows.length, personas: personas.length }));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "PRODUCT_EXPERIENCE_SYNTHETIC_FIXTURE_FAILED");
  process.exitCode = 1;
});
