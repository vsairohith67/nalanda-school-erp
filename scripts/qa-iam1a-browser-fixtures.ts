import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { fileSha256 } from "./migration-check-utils";
import type { Role } from "../lib/permissions";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const TMP_PARENT = path.join(WORKSPACE, "tmp");
const ROOT = path.join(TMP_PARENT, "iam1a-browser");
const DATABASE = path.join(ROOT, "iam1a-browser.db");
const CREDENTIALS = path.join(ROOT, "credentials.json");
const RUNTIME_ENV = path.join(ROOT, "runtime-env.json");
const REASON = "IAM1A copied browser QA evidence";

function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function assertCleanupRoot() {
  const resolved = path.resolve(ROOT);
  if (resolved !== path.join(path.resolve(TMP_PARENT), "iam1a-browser")) throw new Error("IAM1A_BROWSER_CLEANUP_SCOPE_REFUSED");
  return resolved;
}

async function createUser(client: PrismaClient, input: {
  username: string;
  name: string;
  designation: string;
  roles: Role[];
  password: string;
  guardianId?: string;
  lifecycleStatus?: string;
  active?: boolean;
}) {
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(),
    name: input.name,
    designation: input.designation,
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.roles[0],
    isActive: input.active ?? true,
    lifecycleStatus: input.lifecycleStatus ?? "ACTIVE",
    guardianId: input.guardianId ?? null,
    authLoginAliases: { create: { type: "USERNAME", normalizedValue: input.username, displayMasked: input.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } }
  } });
  const assignments = [];
  for (const role of input.roles) assignments.push(await client.userRoleAssignment.create({ data: {
    publicKey: randomUUID(), userId: user.id, role, reason: REASON, assignedByUserId: user.id, activeKey: `${user.id}:${role}`
  } }));
  return { user, assignments };
}

async function setup() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  const root = assertCleanupRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  mkdirSync(root, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const secret = randomBytes(48).toString("base64url");
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret };
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], { cwd: WORKSPACE, env: environment, stdio: "pipe" });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const superAdmin = await createUser(client, { username: "iam1a-browser-super", name: "IAM1A Browser Super Admin", designation: "Super Admin", roles: ["SUPER_ADMIN"], password });
    const director = await createUser(client, { username: "iam1a-browser-director", name: "IAM1A Browser Director", designation: "Associate Director", roles: ["DIRECTOR"], password });
    const viewer = await createUser(client, { username: "iam1a-browser-viewer", name: "IAM1A Browser Viewer", designation: "Read-Only Leadership", roles: ["VIEWER"], password });

    await client.userPermissionOverride.createMany({ data: [
      { publicKey: randomUUID(), userId: director.user.id, permission: "VIEW_IAM_ACCESS", effect: "ALLOW", reason: REASON, createdByUserId: superAdmin.user.id, activeKey: `${director.user.id}:VIEW_IAM_ACCESS` },
      { publicKey: randomUUID(), userId: director.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", reason: REASON, createdByUserId: superAdmin.user.id, activeKey: `${director.user.id}:MANAGE_IAM_USERS` },
      { publicKey: randomUUID(), userId: director.user.id, permission: "DELEGATE_IAM_ACCESS", effect: "ALLOW", reason: REASON, createdByUserId: superAdmin.user.id, activeKey: `${director.user.id}:DELEGATE_IAM_ACCESS` }
    ] });

    const profile = await client.permissionProfile.create({ data: {
      publicKey: randomUUID(), name: "IAM1A Browser Read Only", normalizedName: "iam1a browser read only", description: "Synthetic copied-database Browser QA profile", status: "ACTIVE", version: 1,
      createdByUserId: superAdmin.user.id, updatedByUserId: superAdmin.user.id,
      entries: { create: [
        { permission: "VIEW_STUDENTS", effect: "ALLOW", reason: REASON, createdByUserId: superAdmin.user.id, activeKey: `${randomUUID()}:VIEW_STUDENTS` },
        { permission: "VIEW_PAYMENTS", effect: "DENY", reason: REASON, createdByUserId: superAdmin.user.id, activeKey: `${randomUUID()}:VIEW_PAYMENTS` }
      ] }
    }, include: { entries: true } });
    await client.permissionProfileVersion.create({ data: { profileId: profile.id, versionNumber: 1, snapshotJson: JSON.stringify({ name: profile.name, entries: profile.entries.map((entry) => ({ permission: entry.permission, effect: entry.effect })) }), reason: REASON, createdByUserId: superAdmin.user.id } });
    await client.userPermissionProfileAssignment.create({ data: { publicKey: randomUUID(), userId: viewer.user.id, profileId: profile.id, reason: REASON, assignedByUserId: superAdmin.user.id, activeKey: `${viewer.user.id}:${profile.id}` } });

    const teacherGuardian = await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Browser Teacher Parent", primaryMobile: "9000011001" } });
    const parentGuardian = await client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Browser Multi Child Parent", primaryMobile: "9000011002" } });
    const students = await Promise.all([
      client.student.create({ data: { admissionNo: "IAM1A-BROWSER-001", studentName: "IAM1A Browser Child One", fatherName: "Synthetic", className: "I", section: "A", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: "IAM1A-BROWSER-002", studentName: "IAM1A Browser Child Two", fatherName: "Synthetic", className: "II", section: "B", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: "IAM1A-BROWSER-003", studentName: "IAM1A Browser Unrelated Child", fatherName: "Synthetic", className: "III", section: "A", phone1: "0000000000" } })
    ]);
    await client.studentGuardian.createMany({ data: [
      { guardianId: teacherGuardian.id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: teacherGuardian.id, studentId: students[1].id },
      { guardianId: parentGuardian.id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: parentGuardian.id, studentId: students[1].id }
    ] });
    const teacherParent = await createUser(client, { username: "iam1a-browser-teacher-parent", name: "IAM1A Browser Teacher Parent", designation: "Teacher and Parent", roles: ["TEACHER", "PARENT"], guardianId: teacherGuardian.id, password });
    await createUser(client, { username: "iam1a-browser-parent", name: "IAM1A Browser Multi Child Parent", designation: "Parent", roles: ["PARENT"], guardianId: parentGuardian.id, password });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "IAM1A-BROWSER-TP", fullName: "IAM1A Browser Teacher Parent", designation: "Teacher", userId: teacherParent.user.id } });

    writeFileSync(CREDENTIALS, JSON.stringify({
      superAdmin: { username: superAdmin.user.username, password },
      director: { username: director.user.username, password },
      teacherParent: { username: teacherParent.user.username, password },
      parent: { username: "iam1a-browser-parent", password }
    }));
    writeFileSync(RUNTIME_ENV, JSON.stringify({ DATABASE_URL: databaseUrl(DATABASE), SESSION_SECRET: secret, AUTH_SECRET: secret, NODE_ENV: "production", PORT: "3217" }));
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    if (JSON.stringify(operationalBefore) !== JSON.stringify(operationalAfter)) throw new Error("IAM1A_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "IAM1A_BROWSER_FIXTURES_READY", users: 6, profiles: 1, children: 3, copiedDatabase: true }));
  } finally {
    await client.$disconnect();
  }
}

function cleanup() {
  const root = assertCleanupRoot();
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
  console.log(JSON.stringify({ result: "IAM1A_BROWSER_FIXTURES_REMOVED", exists: existsSync(root) }));
}

const mode = process.argv[2];
if (mode === "setup") setup().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
else if (mode === "cleanup") cleanup();
else { console.error("Use setup or cleanup"); process.exitCode = 1; }
