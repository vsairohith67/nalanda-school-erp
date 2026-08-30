import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { closeSync, copyFileSync, existsSync, mkdirSync, openSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type User } from "@prisma/client";
import { hashPassword, verifyPassword } from "../lib/password";
import { evaluateEffectivePermission } from "../lib/iam/effective-access";
import { archivePermissionProfile, clonePermissionProfile, createPermissionProfile, updatePermissionProfile } from "../lib/iam/profiles";
import { createNamedUser, mutateNamedUser } from "../lib/iam/users";
import { listChildContexts, listRoleContexts, switchChildContext, switchRoleContext } from "../lib/iam/contexts";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { fileSha256 } from "./migration-check-utils";
import type { IamActor } from "../lib/iam/security";
import type { Role } from "../lib/permissions";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.resolve(process.env.IAM1A_OPERATIONAL_DB ?? path.join(WORKSPACE, "prisma", "dev.db"));
const TMP_PARENT = path.join(WORKSPACE, "tmp", "iam1aqa");
const ROOT = path.join(TMP_PARENT, `IAM1AQA-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "iam1aqa-copied.db");
const FRESH_DATABASE = path.join(ROOT, "iam1aqa-fresh.db");
const REASON = "IAM1AQA independent copied database evidence";
let activeStage = "preflight";

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function runPrismaQa(args: string[], databasePath: string, extraEnvironment: NodeJS.ProcessEnv) {
  const pnpmEntry = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  invariant(existsSync(pnpmEntry), "IAM1AQA_PNPM_RUNTIME_NOT_FOUND");
  const result = spawnSync(process.execPath, [pnpmEntry, "exec", "prisma", ...args], {
    cwd: WORKSPACE,
    env: { ...extraEnvironment, DATABASE_URL: databaseUrl(databasePath) },
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    windowsHide: true
  });
  if (result.error) throw new Error(`IAM1AQA_COMMAND_START_FAILED:${result.error.message}`);
  const combined = `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim();
  if (result.status !== 0) throw new Error(`IAM1AQA_PRISMA_COMMAND_FAILED:${args.join(" ")}:${combined}`);
  return { combined };
}
function cleanupRoot() {
  const resolvedRoot = path.resolve(ROOT);
  invariant(resolvedRoot.startsWith(`${path.resolve(TMP_PARENT)}${path.sep}`), "IAM1A_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolvedRoot)) rmSync(resolvedRoot, { recursive: true, force: true });
  invariant(!existsSync(resolvedRoot), "IAM1AQA_CLEANUP_INSPECTION_FAILED");
}
function prohibitedPath(value: unknown, pathLabel = "backup"): string | null {
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = prohibitedPath(value[index], `${pathLabel}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (/^(passwordHash|tokenHash|activeRoleAssignmentId|activeChildLinkId)$/i.test(key)) return `${pathLabel}.${key}`;
      const found = prohibitedPath(child, `${pathLabel}.${key}`);
      if (found) return found;
    }
  }
  return null;
}

type Fixture = { user: User; assignmentId: string; assignmentKey: string; password: string; sessionId: string };

async function createFixture(client: PrismaClient, input: { slug: string; role: Role; designation?: string; guardianId?: string; extraRoles?: Role[]; active?: boolean; lifecycle?: string }): Promise<Fixture> {
  const password = randomBytes(24).toString("base64url") + "Aa1!";
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(),
    name: `IAM1AQA ${input.slug.replaceAll("-", " ")}`,
    designation: input.designation ?? null,
    username: `iam1aqa-${input.slug}-${process.pid}`,
    passwordHash: await hashPassword(password),
    role: input.role,
    isActive: input.active ?? true,
    lifecycleStatus: input.lifecycle ?? (input.active === false ? "SUSPENDED" : "ACTIVE"),
    guardianId: input.guardianId ?? null
  } });
  const roles = [input.role, ...(input.extraRoles ?? [])];
  const assignments = [];
  for (const role of roles) assignments.push(await client.userRoleAssignment.create({ data: {
    publicKey: randomUUID(), userId: user.id, role, reason: REASON, assignedByUserId: user.id, activeKey: `${user.id}:${role}`
  } }));
  const session = await client.authSession.create({ data: {
    userId: user.id,
    tokenHash: randomBytes(32).toString("hex"),
    credentialVersion: user.credentialVersion,
    authorizationVersion: user.authorizationVersion,
    activeRoleAssignmentId: assignments[0].id,
    expiresAt: new Date(Date.now() + 86_400_000),
    deviceSummary: "IAM1AQA copied desktop",
    browserSummary: "IAM1AQA independent harness",
    networkEvidenceMasked: "local"
  } });
  return { user, assignmentId: assignments[0].id, assignmentKey: assignments[0].publicKey, password, sessionId: session.id };
}

function actor(fixture: Fixture): IamActor {
  return {
    sessionId: fixture.sessionId,
    user: {
      id: fixture.user.id,
      name: fixture.user.name,
      designation: fixture.user.designation,
      username: fixture.user.username,
      email: fixture.user.email,
      guardianId: fixture.user.guardianId,
      role: fixture.user.role as Role,
      roleAssignmentId: fixture.assignmentId,
      authorizationVersion: fixture.user.authorizationVersion,
      mustChangePassword: fixture.user.mustChangePassword
    }
  };
}

async function decision(client: PrismaClient, fixture: Fixture, permission: string, scope?: boolean) {
  return evaluateEffectivePermission(client, { userId: fixture.user.id, sessionId: fixture.sessionId, roleAssignmentId: fixture.assignmentId, permission, objectScopeSatisfied: scope });
}

async function main() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  mkdirSync(ROOT, { recursive: true });
  const freshDescriptor = openSync(FRESH_DATABASE, "wx");
  closeSync(freshDescriptor);
  activeStage = "fresh migration deploy twice";
  const sharedSecret = randomBytes(48).toString("base64url");
  const freshEnvironment: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test", DATABASE_URL: databaseUrl(FRESH_DATABASE), SESSION_SECRET: sharedSecret, AUTH_SECRET: sharedSecret };
  runPrismaQa(["migrate", "deploy", "--schema", "prisma/schema.prisma"], FRESH_DATABASE, freshEnvironment);
  runPrismaQa(["migrate", "deploy", "--schema", "prisma/schema.prisma"], FRESH_DATABASE, freshEnvironment);
  invariant(/database schema is up to date/i.test(runPrismaQa(["migrate", "status", "--schema", "prisma/schema.prisma"], FRESH_DATABASE, freshEnvironment).combined), "IAM1AQA_FRESH_MIGRATION_STATUS_DIRTY");
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl(DATABASE),
    SESSION_SECRET: sharedSecret,
    AUTH_SECRET: sharedSecret
  };
  Object.assign(process.env, environment);
  activeStage = "copied migration deploy twice";
  runPrismaQa(["migrate", "deploy", "--schema", "prisma/schema.prisma"], DATABASE, environment);
  runPrismaQa(["migrate", "deploy", "--schema", "prisma/schema.prisma"], DATABASE, environment);
  invariant(/database schema is up to date/i.test(runPrismaQa(["migrate", "status", "--schema", "prisma/schema.prisma"], DATABASE, environment).combined), "IAM1AQA_COPIED_MIGRATION_STATUS_DIRTY");
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const safetyTriggers = await client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'iam_prevent_%super_admin%'`;
    invariant(Number(safetyTriggers[0]?.count ?? 0) === 5, "IAM1AQA_SUPER_ADMIN_DATABASE_GUARDS_MISSING");
    const duplicateBackfills = await client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM (SELECT userId, role, COUNT(*) AS copies FROM UserRoleAssignment WHERE status = 'ACTIVE' GROUP BY userId, role HAVING copies > 1)`;
    invariant(Number(duplicateBackfills[0]?.count ?? 0) === 0, "IAM1AQA_DUPLICATE_ROLE_BACKFILL");
    activeStage = "fixture creation";
    const guardians = await Promise.all([
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA One Child Parent", primaryMobile: "9000001001" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA Multi Child Parent", primaryMobile: "9000001002" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA Unrelated Parent", primaryMobile: "9000001003" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA Teacher Parent", primaryMobile: "9000001004" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA Director Parent", primaryMobile: "9000001005" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1AQA Inactive Guardian", primaryMobile: "9000001006", status: "INACTIVE" } })
    ]);
    const students = await Promise.all([
      client.student.create({ data: { admissionNo: `IAM1AQA-${process.pid}-001`, studentName: "IAM1AQA Linked Child One", fatherName: "Synthetic", className: "I", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: `IAM1AQA-${process.pid}-002`, studentName: "IAM1AQA Linked Child Two", fatherName: "Synthetic", className: "II", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: `IAM1AQA-${process.pid}-003`, studentName: "IAM1AQA Unrelated Child", fatherName: "Synthetic", className: "III", phone1: "0000000000" } })
    ]);
    await client.academicYearEnrollment.createMany({ data: students.map((student) => ({
      studentId: student.id,
      academicYear: "2026-27",
      className: student.className,
      section: student.section,
      status: "ACTIVE"
    })) });
    await client.studentGuardian.createMany({ data: [
      { guardianId: guardians[0].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[1].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[1].id, studentId: students[1].id },
      { guardianId: guardians[2].id, studentId: students[2].id, isPrimaryContact: true },
      { guardianId: guardians[3].id, studentId: students[0].id, isPrimaryContact: true },
      { guardianId: guardians[3].id, studentId: students[1].id },
      { guardianId: guardians[4].id, studentId: students[0].id, isPrimaryContact: true }
    ] });

    const superOne = await createFixture(client, { slug: "super-one", role: "SUPER_ADMIN", designation: "Super Admin" });
    const superTwo = await createFixture(client, { slug: "super-two", role: "SUPER_ADMIN", designation: "Super Admin" });
    const director = await createFixture(client, { slug: "director", role: "DIRECTOR", designation: "Director" });
    const associateDirector = await createFixture(client, { slug: "associate-director", role: "DIRECTOR", designation: "Associate Director" });
    const principal = await createFixture(client, { slug: "principal", role: "PRINCIPAL", designation: "Principal" });
    const administrator = await createFixture(client, { slug: "administrator", role: "ADMIN", designation: "Administrator" });
    const accountant = await createFixture(client, { slug: "accountant", role: "ACCOUNTANT", designation: "Accountant" });
    const computerOperator = await createFixture(client, { slug: "computer-operator", role: "COMPUTER_OPERATOR", designation: "Computer Operator" });
    const teacherA = await createFixture(client, { slug: "teacher-a", role: "TEACHER", designation: "Teacher" });
    const teacherB = await createFixture(client, { slug: "teacher-b", role: "TEACHER", designation: "Teacher" });
    const parentOne = await createFixture(client, { slug: "parent-one", role: "PARENT", designation: "Parent", guardianId: guardians[0].id });
    const parentMany = await createFixture(client, { slug: "parent-many", role: "PARENT", designation: "Parent", guardianId: guardians[1].id });
    const teacherParent = await createFixture(client, { slug: "teacher-parent", role: "TEACHER", designation: "Teacher and Parent", guardianId: guardians[3].id, extraRoles: ["PARENT"] });
    const directorParent = await createFixture(client, { slug: "director-parent", role: "DIRECTOR", designation: "Director and Parent", guardianId: guardians[4].id, extraRoles: ["PARENT"] });
    const viewer = await createFixture(client, { slug: "viewer", role: "VIEWER", designation: "Read-only Viewer" });
    const disabled = await createFixture(client, { slug: "disabled", role: "VIEWER", active: false });
    const expired = await createFixture(client, { slug: "expired", role: "VIEWER" });
    const inactiveAssignment = await createFixture(client, { slug: "inactive-assignment", role: "VIEWER" });
    const revokedSession = await createFixture(client, { slug: "revoked-session", role: "VIEWER" });
    const expiredSession = await createFixture(client, { slug: "expired-session", role: "VIEWER" });
    await client.userRoleAssignment.update({ where: { id: expired.assignmentId }, data: { validFrom: new Date(Date.now() - 120_000), validUntil: new Date(Date.now() - 60_000), activeKey: null } });
    await client.userRoleAssignment.update({ where: { id: inactiveAssignment.assignmentId }, data: { status: "ENDED", endedAt: new Date(), activeKey: null } });
    await client.authSession.update({ where: { id: revokedSession.sessionId }, data: { revokedAt: new Date(), revocationReason: "IAM1AQA_REVOKED_SESSION" } });
    await client.authSession.update({ where: { id: expiredSession.sessionId }, data: { expiresAt: new Date(Date.now() - 60_000) } });
    await client.staffMember.createMany({ data: [
      { iamPublicKey: randomUUID(), staffCode: `IAM1AQA-${process.pid}-TA`, fullName: "IAM1AQA Teacher A", designation: "Teacher", userId: teacherA.user.id },
      { iamPublicKey: randomUUID(), staffCode: `IAM1AQA-${process.pid}-TB`, fullName: "IAM1AQA Teacher B", designation: "Teacher", userId: teacherB.user.id },
      { iamPublicKey: randomUUID(), staffCode: `IAM1AQA-${process.pid}-TP`, fullName: "IAM1AQA Teacher Parent", designation: "Teacher", userId: teacherParent.user.id },
      { iamPublicKey: randomUUID(), staffCode: `IAM1AQA-${process.pid}-INACTIVE`, fullName: "IAM1AQA Inactive Staff", designation: "Teacher", status: "INACTIVE" }
    ] });

    activeStage = "permission precedence";
    invariant((await decision(client, disabled, "VIEW_DASHBOARD")).source === "ACCOUNT", "IAM1A_DISABLED_ACCOUNT_NOT_DENIED");
    invariant((await decision(client, revokedSession, "VIEW_DASHBOARD")).source === "SESSION", "IAM1AQA_REVOKED_SESSION_NOT_DENIED");
    invariant((await decision(client, expiredSession, "VIEW_DASHBOARD")).source === "SESSION", "IAM1AQA_EXPIRED_SESSION_NOT_DENIED");
    invariant((await decision(client, inactiveAssignment, "VIEW_DASHBOARD")).source === "ROLE_ASSIGNMENT", "IAM1AQA_INACTIVE_ASSIGNMENT_NOT_DENIED");
    invariant((await decision(client, expired, "VIEW_DASHBOARD")).source === "ROLE_ASSIGNMENT", "IAM1A_EXPIRED_ASSIGNMENT_NOT_DENIED");
    invariant((await decision(client, director, "GRANT_SUPER_ADMIN")).source === "SYSTEM_RESTRICTION", "IAM1A_INVARIANT_BYPASSED");
    invariant((await decision(client, teacherA, "MANAGE_STUDENT_ATTENDANCE", false)).source === "OBJECT_SCOPE", "IAM1A_OBJECT_SCOPE_BYPASSED");
    invariant((await decision(client, viewer, "UNKNOWN_IAM_PERMISSION")).source === "DEFAULT_DENY", "IAM1A_UNKNOWN_PERMISSION_ALLOWED");
    invariant((await decision(client, viewer, "VIEW_DASHBOARD")).source === "BASE_ROLE", "IAM1AQA_BASE_ROLE_NOT_FINAL_ALLOW");
    invariant((await decision(client, computerOperator, "VIEW_PAYMENTS")).source === "SYSTEM_RESTRICTION", "IAM1A_COMPUTER_OPERATOR_FINANCE_ESCALATION");
    await client.userPermissionOverride.createMany({ data: [
      { publicKey: randomUUID(), userId: teacherB.user.id, permission: "VIEW_SETTINGS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), validUntil: new Date(Date.now() + 60_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${teacherB.user.id}:VIEW_SETTINGS` },
      { publicKey: randomUUID(), userId: parentOne.user.id, permission: "VIEW_PAYMENTS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${parentOne.user.id}:VIEW_PAYMENTS` }
    ] });
    invariant((await decision(client, teacherB, "VIEW_SETTINGS")).source === "USER_ALLOW", "IAM1AQA_USER_ALLOW_FAILED");
    invariant((await decision(client, parentOne, "VIEW_PAYMENTS")).source === "SYSTEM_RESTRICTION", "IAM1AQA_CROSS_CONTEXT_OBJECT_GRANT_ALLOWED");

    activeStage = "profile creation";
    const profile = await createPermissionProfile(client, actor(superOne), {
      name: `IAM1AQA Limited ${process.pid}`,
      description: "Copied database conflict profile",
      reason: REASON,
      reauthPassword: superOne.password,
      entries: [{ permission: "VIEW_SETTINGS", effect: "ALLOW" }, { permission: "VIEW_PAYMENTS", effect: "DENY" }]
    });
    let duplicateProfileDenied = false;
    try { await createPermissionProfile(client, actor(superOne), { name: `IAM1AQA Duplicate ${process.pid}`, reason: REASON, reauthPassword: superOne.password, entries: [{ permission: "VIEW_SETTINGS", effect: "ALLOW" }, { permission: "VIEW_SETTINGS", effect: "DENY" }] }); } catch { duplicateProfileDenied = true; }
    invariant(duplicateProfileDenied, "IAM1AQA_DUPLICATE_PROFILE_PERMISSION_ACCEPTED");
    const profileRowForAssignment = await client.permissionProfile.findUniqueOrThrow({ where: { publicKey: profile.handle } });
    await client.userPermissionProfileAssignment.createMany({ data: [
      { publicKey: randomUUID(), userId: accountant.user.id, profileId: profileRowForAssignment.id, reason: REASON, assignedByUserId: superOne.user.id, validUntil: new Date(Date.now() + 86_400_000), activeKey: `${accountant.user.id}:${profileRowForAssignment.id}` },
      { publicKey: randomUUID(), userId: viewer.user.id, profileId: profileRowForAssignment.id, reason: REASON, assignedByUserId: superOne.user.id, activeKey: `${viewer.user.id}:${profileRowForAssignment.id}` }
    ] });
    await client.userPermissionOverride.create({ data: { publicKey: randomUUID(), userId: accountant.user.id, permission: "VIEW_SETTINGS", effect: "DENY", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${accountant.user.id}:VIEW_SETTINGS` } });
    const userDenyDecision = await decision(client, accountant, "VIEW_SETTINGS");
    invariant(userDenyDecision.source === "USER_DENY", `IAM1A_USER_DENY_PRECEDENCE_FAILED:${userDenyDecision.source}`);
    invariant((await decision(client, viewer, "VIEW_SETTINGS")).source === "PROFILE_ALLOW", "IAM1AQA_PROFILE_ALLOW_FAILED");
    const profileDenyDecision = await decision(client, accountant, "VIEW_PAYMENTS", true);
    invariant(profileDenyDecision.source === "PROFILE_DENY", `IAM1A_PROFILE_DENY_PRECEDENCE_FAILED:${profileDenyDecision.source}`);
    const clone = await clonePermissionProfile(client, actor(superOne), profile.handle, { name: `IAM1AQA Clone ${process.pid}`, reason: REASON, reauthPassword: superOne.password });
    invariant(clone.version === 1 && clone.entries.length === 2, "IAM1AQA_PROFILE_CLONE_FAILED");
    const archivedClone = await archivePermissionProfile(client, actor(superOne), clone.handle, { expectedVersion: clone.version, reason: REASON, reauthPassword: superOne.password, impactAcknowledged: true });
    invariant(archivedClone.status === "ARCHIVED" && await client.permissionProfileVersion.count({ where: { profile: { publicKey: clone.handle } } }) === 2, "IAM1AQA_PROFILE_ARCHIVE_HISTORY_FAILED");

    activeStage = "pending user creation";
    const failedReauthenticationUsername = `iam1aqa-wrong-reauth-${process.pid}`;
    let wrongReauthenticationDenied = false;
    try {
      await createNamedUser(client, actor(superOne), {
        name: "IAM1AQA Wrong Reauthentication",
        username: failedReauthenticationUsername,
        roles: ["VIEWER"],
        activationMethod: "PENDING",
        reason: REASON,
        reauthPassword: superOne.password.concat("wrong")
      });
    } catch { wrongReauthenticationDenied = true; }
    invariant(wrongReauthenticationDenied && await client.user.count({ where: { username: failedReauthenticationUsername } }) === 0, "IAM1AQA_CRITICAL_REAUTHENTICATION_BYPASSED");
    const pending = await createNamedUser(client, actor(superOne), {
      name: "IAM1AQA Pending Named User", username: `iam1aqa-pending-${process.pid}`, designation: "Sub Director", roles: ["VIEWER"],
      activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password
    });
    invariant(pending.status === "PENDING_ACTIVATION", "IAM1A_UNSAFE_PENDING_ACTIVATION");
    const pendingRow = await client.user.findUniqueOrThrow({ where: { iamPublicKey: pending.handle } });
    invariant(!pendingRow.isActive && !pendingRow.mustChangePassword, "IAM1A_PENDING_USER_ACTIVE");
    const invitationPending = await createNamedUser(client, actor(superOne), {
      name: "IAM1AQA Invitation Pending", username: `iam1aqa-invitation-${process.pid}`, designation: "Additional Director", roles: ["VIEWER"],
      activationMethod: "INVITATION", reason: REASON, reauthPassword: superOne.password
    });
    invariant(invitationPending.status === "PENDING_ACTIVATION", "IAM1AQA_UNAVAILABLE_INVITATION_NOT_PENDING");
    const temporaryPassword = randomBytes(24).toString("base64url") + "Aa1!";
    const temporary = await createNamedUser(client, actor(superOne), {
      name: "IAM1AQA Temporary Password", username: `iam1aqa-temporary-${process.pid}`, designation: "Viewer", roles: ["VIEWER"],
      activationMethod: "TEMPORARY_PASSWORD", temporaryPassword, temporaryPasswordDays: 1, reason: REASON, reauthPassword: superOne.password
    });
    const temporaryRow = await client.user.findUniqueOrThrow({ where: { iamPublicKey: temporary.handle } });
    invariant(temporaryRow.isActive && temporaryRow.mustChangePassword && Boolean(temporaryRow.temporaryPasswordExpiresAt), "IAM1AQA_TEMPORARY_PASSWORD_LIFECYCLE_FAILED");
    invariant(await verifyPassword(temporaryPassword, temporaryRow.passwordHash), "IAM1AQA_TEMPORARY_PASSWORD_NOT_HASHED_FOR_LOGIN");
    invariant(!JSON.stringify(temporary).includes(temporaryPassword) && !("passwordHash" in temporary), "IAM1AQA_TEMPORARY_PASSWORD_EXPOSED");
    let duplicateAliasDenied = false;
    try { await createNamedUser(client, actor(superOne), { name: "IAM1AQA Duplicate Alias", username: pendingRow.username, roles: ["VIEWER"], activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password }); } catch { duplicateAliasDenied = true; }
    invariant(duplicateAliasDenied && await client.authLoginAlias.count({ where: { normalizedValue: pendingRow.username, status: "VERIFIED" } }) === 1, "IAM1AQA_ALIAS_TAKEOVER_ALLOWED");
    let missingStaffDenied = false;
    try { await createNamedUser(client, actor(superOne), { name: "IAM1AQA Missing Staff", username: `iam1aqa-missing-staff-${process.pid}`, roles: ["TEACHER"], activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password }); } catch { missingStaffDenied = true; }
    invariant(missingStaffDenied, "IAM1AQA_TEACHER_WITHOUT_STAFF_ALLOWED");
    let missingGuardianDenied = false;
    try { await createNamedUser(client, actor(superOne), { name: "IAM1AQA Missing Guardian", username: `iam1aqa-missing-guardian-${process.pid}`, roles: ["PARENT"], activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password }); } catch { missingGuardianDenied = true; }
    invariant(missingGuardianDenied, "IAM1AQA_PARENT_WITHOUT_GUARDIAN_ALLOWED");
    const inactiveStaff = await client.staffMember.findUniqueOrThrow({ where: { staffCode: `IAM1AQA-${process.pid}-INACTIVE` } });
    let inactiveStaffDenied = false;
    try { await createNamedUser(client, actor(superOne), { name: "IAM1AQA Inactive Staff", username: `iam1aqa-inactive-staff-${process.pid}`, roles: ["VIEWER"], staffHandle: inactiveStaff.iamPublicKey, activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password }); } catch { inactiveStaffDenied = true; }
    invariant(inactiveStaffDenied, "IAM1AQA_INACTIVE_STAFF_LINK_ALLOWED");
    let inactiveGuardianDenied = false;
    try { await createNamedUser(client, actor(superOne), { name: "IAM1AQA Inactive Guardian", username: `iam1aqa-inactive-guardian-${process.pid}`, roles: ["VIEWER"], guardianHandle: guardians[5].iamPublicKey, activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password }); } catch { inactiveGuardianDenied = true; }
    invariant(inactiveGuardianDenied, "IAM1AQA_INACTIVE_GUARDIAN_LINK_ALLOWED");

    activeStage = "delegated administration";
    await client.userPermissionOverride.createMany({ data: [
      { publicKey: randomUUID(), userId: director.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${director.user.id}:MANAGE_IAM_USERS` },
      { publicKey: randomUUID(), userId: director.user.id, permission: "DELEGATE_IAM_ACCESS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${director.user.id}:DELEGATE_IAM_ACCESS` }
    ] });
    await mutateNamedUser(client, actor(director), viewer.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: viewer.user.version, reason: REASON, reauthPassword: director.password });
    invariant((await client.user.findUniqueOrThrow({ where: { id: viewer.user.id } })).lifecycleStatus === "SUSPENDED", "IAM1A_DELEGATED_DIRECTOR_FAILED");
    const suspendedViewer = await client.user.findUniqueOrThrow({ where: { id: viewer.user.id } });
    await mutateNamedUser(client, actor(superOne), suspendedViewer.iamPublicKey!, { action: "REACTIVATE", expectedVersion: suspendedViewer.version, reason: REASON, reauthPassword: superOne.password });
    invariant((await client.user.findUniqueOrThrow({ where: { id: viewer.user.id } })).lifecycleStatus === "ACTIVE", "IAM1AQA_REACTIVATION_FAILED");
    let directorWithoutDelegationDenied = false;
    try { await mutateNamedUser(client, actor(associateDirector), temporary.handle, { action: "SUSPEND", expectedVersion: temporaryRow.version, reason: REASON, reauthPassword: associateDirector.password }); } catch { directorWithoutDelegationDenied = true; }
    invariant(directorWithoutDelegationDenied, "IAM1AQA_DIRECTOR_WITHOUT_DELEGATION_ALLOWED");
    await client.userPermissionOverride.create({ data: { publicKey: randomUUID(), userId: principal.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${principal.user.id}:MANAGE_IAM_USERS` } });
    await mutateNamedUser(client, actor(principal), teacherA.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: teacherA.user.version, reason: REASON, reauthPassword: principal.password });
    const suspendedTeacher = await client.user.findUniqueOrThrow({ where: { id: teacherA.user.id } });
    invariant(suspendedTeacher.lifecycleStatus === "SUSPENDED", "IAM1AQA_PRINCIPAL_BOUNDARY_FAILED");
    await mutateNamedUser(client, actor(superOne), suspendedTeacher.iamPublicKey!, { action: "REACTIVATE", expectedVersion: suspendedTeacher.version, reason: REASON, reauthPassword: superOne.password });
    await client.userPermissionOverride.create({ data: { publicKey: randomUUID(), userId: computerOperator.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${computerOperator.user.id}:MANAGE_IAM_USERS` } });
    let operatorAdminDenied = false;
    try { await createNamedUser(client, actor(computerOperator), { name: "IAM1AQA Operator Admin", username: `iam1aqa-operator-admin-${process.pid}`, roles: ["ADMIN"], activationMethod: "PENDING", reason: REASON, reauthPassword: computerOperator.password }); } catch { operatorAdminDenied = true; }
    invariant(operatorAdminDenied, "IAM1AQA_COMPUTER_OPERATOR_ADMIN_ESCALATION");
    await client.userPermissionOverride.createMany({ data: [
      { publicKey: randomUUID(), userId: accountant.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${accountant.user.id}:MANAGE_IAM_USERS` },
      { publicKey: randomUUID(), userId: accountant.user.id, permission: "MANAGE_USER_PERMISSION_OVERRIDES", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${accountant.user.id}:MANAGE_USER_PERMISSION_OVERRIDES` }
    ] });
    let accountantSelfGrantDenied = false;
    try { await mutateNamedUser(client, actor(accountant), accountant.user.iamPublicKey!, { action: "SET_OVERRIDE", permission: "VIEW_PAYMENTS", effect: "ALLOW", expectedVersion: accountant.user.version, reason: REASON, reauthPassword: accountant.password }); } catch { accountantSelfGrantDenied = true; }
    invariant(accountantSelfGrantDenied, "IAM1AQA_ACCOUNTANT_SELF_GRANT_ALLOWED");
    const undelegableProfile = await createPermissionProfile(client, actor(superOne), { name: `IAM1AQA Director Missing ${process.pid}`, reason: REASON, reauthPassword: superOne.password, entries: [{ permission: "MANAGE_PERMISSION_PROFILES", effect: "ALLOW" }] });
    let missingAuthorityDelegationDenied = false;
    try { await createNamedUser(client, actor(director), { name: "IAM1AQA Missing Authority", username: `iam1aqa-missing-authority-${process.pid}`, roles: ["VIEWER"], profileHandles: [undelegableProfile.handle], activationMethod: "PENDING", reason: REASON, reauthPassword: director.password }); } catch { missingAuthorityDelegationDenied = true; }
    invariant(missingAuthorityDelegationDenied, "IAM1AQA_ACTOR_DELEGATED_PERMISSION_NOT_POSSESSED");
    let selfEscalationDenied = false;
    try { await mutateNamedUser(client, actor(director), director.user.iamPublicKey!, { action: "ASSIGN_ROLE", role: "SUPER_ADMIN", expectedVersion: director.user.version, reason: REASON, reauthPassword: director.password }); } catch { selfEscalationDenied = true; }
    invariant(selfEscalationDenied, "IAM1A_SELF_ESCALATION_ALLOWED");
    let delegatedSuperGrantDenied = false;
    try { await mutateNamedUser(client, actor(director), temporary.handle, { action: "ASSIGN_ROLE", role: "SUPER_ADMIN", expectedVersion: temporaryRow.version, reason: REASON, reauthPassword: director.password }); } catch { delegatedSuperGrantDenied = true; }
    invariant(delegatedSuperGrantDenied, "IAM1AQA_DELEGATED_SUPER_ADMIN_GRANT_ALLOWED");

    activeStage = "role profile and override lifecycle";
    let administratorVersion = administrator.user.version;
    const assignedRole = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "ASSIGN_ROLE", role: "VIEWER", validUntil: new Date(Date.now() + 86_400_000).toISOString(), expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = assignedRole.version;
    const viewerAssignment = await client.userRoleAssignment.findFirstOrThrow({ where: { userId: administrator.user.id, role: "VIEWER", status: "ACTIVE" } });
    invariant(Boolean(viewerAssignment.validUntil) && await client.authSession.count({ where: { userId: administrator.user.id, revokedAt: null } }) === 0, "IAM1AQA_ROLE_ASSIGNMENT_DID_NOT_INVALIDATE_SESSION");
    const endedRole = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "END_ROLE", assignmentHandle: viewerAssignment.publicKey, expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = endedRole.version;
    invariant((await client.userRoleAssignment.findUniqueOrThrow({ where: { id: viewerAssignment.id } })).status === "ENDED", "IAM1AQA_ROLE_HISTORY_DELETED_OR_ACTIVE");
    const assignedProfile = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "ASSIGN_PROFILE", profileHandle: profile.handle, validUntil: new Date(Date.now() + 86_400_000).toISOString(), expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = assignedProfile.version;
    const profileAssignment = await client.userPermissionProfileAssignment.findFirstOrThrow({ where: { userId: administrator.user.id, profileId: profileRowForAssignment.id, status: "ACTIVE" } });
    const endedProfile = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "END_PROFILE", assignmentHandle: profileAssignment.publicKey, expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = endedProfile.version;
    invariant((await client.userPermissionProfileAssignment.findUniqueOrThrow({ where: { id: profileAssignment.id } })).status === "ENDED", "IAM1AQA_PROFILE_ASSIGNMENT_HISTORY_DELETED");
    const setOverride = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "SET_OVERRIDE", permission: "VIEW_SETTINGS", effect: "DENY", validUntil: new Date(Date.now() + 86_400_000).toISOString(), expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = setOverride.version;
    const override = await client.userPermissionOverride.findFirstOrThrow({ where: { userId: administrator.user.id, permission: "VIEW_SETTINGS", status: "ACTIVE" } });
    const revokedOverride = await mutateNamedUser(client, actor(superOne), administrator.user.iamPublicKey!, { action: "REVOKE_OVERRIDE", overrideHandle: override.publicKey, expectedVersion: administratorVersion, reason: REASON, reauthPassword: superOne.password });
    administratorVersion = revokedOverride.version;
    invariant((await client.userPermissionOverride.findUniqueOrThrow({ where: { id: override.id } })).status === "REVOKED", "IAM1AQA_OVERRIDE_HISTORY_DELETED");
    invariant(administratorVersion === 7, "IAM1AQA_USER_VERSION_EVIDENCE_INCORRECT");

    activeStage = "role and child contexts";
    const teacherParentSecondSession = await client.authSession.create({ data: { userId: teacherParent.user.id, tokenHash: randomBytes(32).toString("hex"), credentialVersion: teacherParent.user.credentialVersion, authorizationVersion: teacherParent.user.authorizationVersion, activeRoleAssignmentId: teacherParent.assignmentId, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "IAM1AQA second session", browserSummary: "IAM1AQA harness", networkEvidenceMasked: "local" } });
    const singleRoleContexts = await listRoleContexts(client, { userId: parentOne.user.id, sessionId: parentOne.sessionId });
    invariant(singleRoleContexts.contexts.length === 1 && !singleRoleContexts.pickerRequired, "IAM1AQA_SINGLE_ROLE_PICKER_SHOWN");
    const singleChild = await listChildContexts(client, { userId: parentOne.user.id, sessionId: parentOne.sessionId });
    invariant(singleChild.children.length === 1 && !singleChild.pickerRequired && singleChild.children[0].active, "IAM1AQA_SINGLE_CHILD_DEFAULT_FAILED");
    const roleContexts = await listRoleContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    invariant(roleContexts.contexts.length === 2 && roleContexts.pickerRequired, "IAM1A_MULTI_ROLE_PICKER_INCORRECT");
    const parentContext = roleContexts.contexts.find((context) => context.label === "Parent");
    const teacherContext = roleContexts.contexts.find((context) => context.label === "Teacher");
    invariant(parentContext, "IAM1A_PARENT_ROLE_CONTEXT_MISSING");
    invariant(teacherContext, "IAM1AQA_TEACHER_ROLE_CONTEXT_MISSING");
    let teacherChildContextDenied = false;
    try { await listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId }); } catch { teacherChildContextDenied = true; }
    invariant(teacherChildContextDenied, "IAM1AQA_CHILD_CONTEXT_LEAKED_INTO_TEACHER");
    let crossUserRoleDenied = false;
    try { await switchRoleContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId, handle: parentContext.handle, expectedVersion: 1 }); } catch { crossUserRoleDenied = true; }
    invariant(crossUserRoleDenied, "IAM1A_CROSS_USER_ROLE_HANDLE_REUSED");
    let rawRoleDenied = false;
    try { await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: "PARENT", expectedVersion: 1 }); } catch { rawRoleDenied = true; }
    invariant(rawRoleDenied, "IAM1AQA_CLIENT_ROLE_STRING_TRUSTED");
    await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: parentContext.handle, expectedVersion: 1 });
    const switchedParentSession = await client.authSession.findUniqueOrThrow({ where: { id: teacherParent.sessionId } });
    const parentAssignment = await client.userRoleAssignment.findUniqueOrThrow({ where: { id: switchedParentSession.activeRoleAssignmentId! } });
    invariant(parentAssignment.role === "PARENT" && switchedParentSession.contextVersion === 2, "IAM1AQA_ROLE_CONTEXT_NOT_STORED_SERVER_SIDE");
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: teacherParentSecondSession.id } })).activeRoleAssignmentId === teacherParent.assignmentId, "IAM1AQA_ROLE_SWITCH_LEAKED_TO_OTHER_SESSION");
    const children = await listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    invariant(children.children.length === 2 && children.pickerRequired, "IAM1A_CHILD_CONTEXT_MATRIX_INCORRECT");
    let crossFamilyChildDenied = false;
    try { await switchChildContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId, handle: children.children[0].handle, expectedVersion: 1 }); } catch { crossFamilyChildDenied = true; }
    invariant(crossFamilyChildDenied, "IAM1A_CROSS_FAMILY_CHILD_HANDLE_REUSED");
    let rawStudentDenied = false;
    try { await switchChildContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: students[2].id, expectedVersion: 2 }); } catch { rawStudentDenied = true; }
    invariant(rawStudentDenied, "IAM1AQA_RAW_STUDENT_ID_TRUSTED");
    await switchChildContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: children.children[0].handle, expectedVersion: 2 });
    const selectedChildSession = await client.authSession.findUniqueOrThrow({ where: { id: teacherParent.sessionId } });
    invariant(Boolean(selectedChildSession.activeChildLinkId) && selectedChildSession.contextVersion === 3, "IAM1AQA_CHILD_CONTEXT_NOT_STORED_SERVER_SIDE");
    await client.studentGuardian.delete({ where: { id: selectedChildSession.activeChildLinkId! } });
    const afterRemovedLink = await listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    invariant(afterRemovedLink.children.length === 1 && !afterRemovedLink.children.some((child) => child.handle === children.children[0].handle), "IAM1AQA_REMOVED_CHILD_LINK_RETAINED");
    await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: teacherContext.handle, expectedVersion: 3 });
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: teacherParent.sessionId } })).activeChildLinkId === null, "IAM1AQA_CHILD_CONTEXT_LEAKED_AFTER_TEACHER_SWITCH");
    const concurrentRoleContexts = await listRoleContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    const concurrentSwitches = await Promise.allSettled([parentContext.handle, teacherContext.handle].map((handle) => switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle, expectedVersion: concurrentRoleContexts.contextVersion })));
    invariant(concurrentSwitches.filter((result) => result.status === "fulfilled").length === 1, "IAM1AQA_CONCURRENT_CONTEXT_SWITCH_NOT_PROTECTED");
    const finalRoleContexts = await listRoleContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: teacherContext.handle, expectedVersion: finalRoleContexts.contextVersion });
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: teacherParent.sessionId } })).activeChildLinkId === null, "IAM1AQA_FINAL_TEACHER_CONTEXT_HAS_CHILD");

    const directorParentAssignment = await client.userRoleAssignment.findFirstOrThrow({ where: { userId: directorParent.user.id, role: "PARENT", status: "ACTIVE" } });
    const endedDirectorParent = await mutateNamedUser(client, actor(superOne), directorParent.user.iamPublicKey!, { action: "END_ROLE", assignmentHandle: directorParentAssignment.publicKey, expectedVersion: directorParent.user.version, reason: REASON, reauthPassword: superOne.password });
    invariant(endedDirectorParent.version === 2 && await client.authSession.count({ where: { userId: directorParent.user.id, revokedAt: null } }) === 0, "IAM1AQA_ROLE_CHANGE_DID_NOT_REVOKE_CONTEXTS");
    let staleDirectorParentContextDenied = false;
    try { await listRoleContexts(client, { userId: directorParent.user.id, sessionId: directorParent.sessionId }); } catch { staleDirectorParentContextDenied = true; }
    invariant(staleDirectorParentContextDenied, "IAM1AQA_STALE_CONTEXT_SURVIVED_ROLE_END");

    activeStage = "profile concurrency";
    const profileRow = await client.permissionProfile.findUniqueOrThrow({ where: { publicKey: profile.handle } });
    let unacknowledgedImpactDenied = false;
    try { await updatePermissionProfile(client, actor(superOne), profile.handle, { expectedVersion: profileRow.version, name: profileRow.name, description: profileRow.description, reason: REASON, reauthPassword: superOne.password, entries: [{ permission: "VIEW_SETTINGS", effect: "ALLOW" }, { permission: "VIEW_PAYMENTS", effect: "DENY" }] }); } catch { unacknowledgedImpactDenied = true; }
    invariant(unacknowledgedImpactDenied && (await client.permissionProfile.findUniqueOrThrow({ where: { id: profileRow.id } })).version === profileRow.version, "IAM1AQA_SHARED_PROFILE_IMPACT_NOT_ENFORCED");
    const updates = await Promise.allSettled([1, 2].map(() => updatePermissionProfile(client, actor(superOne), profile.handle, {
      expectedVersion: profileRow.version,
      name: profileRow.name,
      description: profileRow.description,
      reason: REASON,
      reauthPassword: superOne.password,
      impactAcknowledged: true,
      entries: [{ permission: "VIEW_SETTINGS", effect: "ALLOW" }, { permission: "VIEW_PAYMENTS", effect: "DENY" }]
    })));
    invariant(updates.filter((item) => item.status === "fulfilled").length === 1 && updates.filter((item) => item.status === "rejected").length === 1, "IAM1A_PROFILE_CONCURRENCY_FAILED");
    invariant(await client.permissionProfileEntry.count({ where: { profileId: profileRow.id, status: "REVOKED" } }) === 2 && await client.permissionProfileVersion.count({ where: { profileId: profileRow.id } }) === 2, "IAM1AQA_PROFILE_VERSION_HISTORY_INCOMPLETE");

    activeStage = "account concurrency";
    const concurrentAccountChanges = await Promise.allSettled([1, 2].map(() => mutateNamedUser(client, actor(superOne), temporary.handle, { action: "SUSPEND", expectedVersion: temporaryRow.version, reason: REASON, reauthPassword: superOne.password })));
    invariant(concurrentAccountChanges.filter((result) => result.status === "fulfilled").length === 1 && concurrentAccountChanges.filter((result) => result.status === "rejected").length === 1, "IAM1AQA_ACCOUNT_CONCURRENCY_FAILED");

    activeStage = "last super admin";
    const lastSuperClient = new PrismaClient({ datasourceUrl: databaseUrl(FRESH_DATABASE) });
    try {
      const lastSuperOne = await createFixture(lastSuperClient, { slug: "last-super-one", role: "SUPER_ADMIN", designation: "Super Admin" });
      const lastSuperTwo = await createFixture(lastSuperClient, { slug: "last-super-two", role: "SUPER_ADMIN", designation: "Super Admin" });
      const concurrentSuperChanges = await Promise.allSettled([
        mutateNamedUser(lastSuperClient, actor(lastSuperOne), lastSuperTwo.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: lastSuperTwo.user.version, reason: REASON, reauthPassword: lastSuperOne.password }),
        mutateNamedUser(lastSuperClient, actor(lastSuperTwo), lastSuperOne.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: lastSuperOne.user.version, reason: REASON, reauthPassword: lastSuperTwo.password })
      ]);
      const concurrentSuperSuccesses = concurrentSuperChanges.filter((result) => result.status === "fulfilled").length;
      const concurrentSuperEvidence = concurrentSuperChanges.map((result) => result.status === "fulfilled" ? "fulfilled" : result.reason instanceof Error ? result.reason.message : "rejected").join("|");
      invariant(concurrentSuperSuccesses === 1, `IAM1AQA_CONCURRENT_LAST_SUPER_ADMIN_PROTECTION_FAILED:${concurrentSuperEvidence}`);
      invariant(await lastSuperClient.userRoleAssignment.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } } }) === 1, "IAM1AQA_ACTIVE_SUPER_ADMIN_COUNT_INVALID");
      const lastSuperOneRow = await lastSuperClient.user.findUniqueOrThrow({ where: { id: lastSuperOne.user.id } });
      const lastSuperTwoRow = await lastSuperClient.user.findUniqueOrThrow({ where: { id: lastSuperTwo.user.id } });
      const activeSuper = lastSuperOneRow.isActive ? lastSuperOne : lastSuperTwo;
      const suspendedSuperRow = lastSuperOneRow.isActive ? lastSuperTwoRow : lastSuperOneRow;
      let databaseSoleSuperDenied = false;
      try { await lastSuperClient.user.update({ where: { id: activeSuper.user.id }, data: { isActive: false, lifecycleStatus: "SUSPENDED" } }); } catch { databaseSoleSuperDenied = true; }
      invariant(databaseSoleSuperDenied, "IAM1AQA_DATABASE_LAST_SUPER_ADMIN_GUARD_BYPASSED");
      await mutateNamedUser(lastSuperClient, actor(activeSuper), suspendedSuperRow.iamPublicKey!, { action: "REACTIVATE", expectedVersion: suspendedSuperRow.version, reason: REASON, reauthPassword: activeSuper.password });
      const reactivatedSuper = await lastSuperClient.user.findUniqueOrThrow({ where: { id: suspendedSuperRow.id } });
      const overrideCountBeforeCriticalDenial = await lastSuperClient.userPermissionOverride.count({ where: { userId: reactivatedSuper.id } });
      let criticalDenialDenied = false;
      try { await mutateNamedUser(lastSuperClient, actor(activeSuper), reactivatedSuper.iamPublicKey!, { action: "SET_OVERRIDE", permission: "VIEW_IAM_ACCESS", effect: "DENY", expectedVersion: reactivatedSuper.version, reason: REASON, reauthPassword: activeSuper.password }); } catch { criticalDenialDenied = true; }
      invariant(criticalDenialDenied && await lastSuperClient.userPermissionOverride.count({ where: { userId: reactivatedSuper.id } }) === overrideCountBeforeCriticalDenial, "IAM1AQA_CRITICAL_SUPER_ADMIN_DENIAL_ROLLBACK_FAILED");
      await mutateNamedUser(lastSuperClient, actor(activeSuper), reactivatedSuper.iamPublicKey!, { action: "SUSPEND", expectedVersion: reactivatedSuper.version, reason: REASON, reauthPassword: activeSuper.password });
      invariant(await lastSuperClient.userRoleAssignment.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } } }) === 1, "IAM1AQA_GOVERNED_SECOND_SUPER_TRANSITION_FAILED");
      let soleSuperDenied = false;
      const activeSuperRow = await lastSuperClient.user.findUniqueOrThrow({ where: { id: activeSuper.user.id } });
      try { await mutateNamedUser(lastSuperClient, actor(activeSuper), activeSuperRow.iamPublicKey!, { action: "SUSPEND", expectedVersion: activeSuperRow.version, reason: REASON, reauthPassword: activeSuper.password }); } catch { soleSuperDenied = true; }
      invariant(soleSuperDenied, "IAM1A_SOLE_SUPER_ADMIN_NOT_PROTECTED");
      const suspendedAgain = await lastSuperClient.user.findUniqueOrThrow({ where: { id: reactivatedSuper.id } });
      await mutateNamedUser(lastSuperClient, actor(activeSuper), suspendedAgain.iamPublicKey!, { action: "REACTIVATE", expectedVersion: suspendedAgain.version, reason: REASON, reauthPassword: activeSuper.password });
    } finally {
      await lastSuperClient.$disconnect();
    }

    activeStage = "forced rollback";
    const beforeRollback = await client.permissionProfile.count();
    try {
      await client.$transaction(async (tx) => { await tx.permissionProfile.create({ data: { publicKey: randomUUID(), name: "IAM1AQA Forced Rollback", normalizedName: `iam1aqa forced rollback ${process.pid}`, status: "ACTIVE", version: 1, createdByUserId: superOne.user.id, updatedByUserId: superOne.user.id } }); throw new Error("IAM1AQA_FORCED_FAILURE"); });
    } catch {}
    invariant(await client.permissionProfile.count() === beforeRollback, "IAM1A_TRANSACTION_ROLLBACK_FAILED");

    activeStage = "backup restore twice";
    await client.authSession.updateMany({ where: { userId: { in: [superOne.user.id, accountant.user.id, teacherParent.user.id] }, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: "IAM1A_BACKUP_REHEARSAL" } });
    const backup = await generateFullBackup(client, { generatedBy: "IAM1AQA copied database QA" });
    const serialized = serializeBackup(backup);
    const prohibitedBackupKey = prohibitedPath(backup);
    invariant(!prohibitedBackupKey, `IAM1A_BACKUP_SECRET_OR_CONTEXT_LEAK:${prohibitedBackupKey ?? "unknown"}`);
    const validated = parseAndValidateBackup(serialized);
    const iamCountsBefore = {
      roles: await client.userRoleAssignment.count(), profiles: await client.permissionProfile.count(), entries: await client.permissionProfileEntry.count(),
      assignments: await client.userPermissionProfileAssignment.count(), overrides: await client.userPermissionOverride.count(), audits: await client.userAudit.count({ where: { action: { startsWith: "IAM_" } } })
    };
    await restoreValidatedBackup(client, validated, { id: superOne.user.id, name: superOne.user.name });
    await restoreValidatedBackup(client, validated, { id: superOne.user.id, name: superOne.user.name });
    const iamCountsAfter = {
      roles: await client.userRoleAssignment.count(), profiles: await client.permissionProfile.count(), entries: await client.permissionProfileEntry.count(),
      assignments: await client.userPermissionProfileAssignment.count(), overrides: await client.userPermissionOverride.count(), audits: await client.userAudit.count({ where: { action: { startsWith: "IAM_" } } })
    };
    invariant(JSON.stringify(iamCountsBefore) === JSON.stringify(iamCountsAfter), "IAM1A_RESTORE_DUPLICATED_ACCESS_ROWS");
    invariant(await client.authSession.count({ where: { revokedAt: null, userId: { in: [superOne.user.id, accountant.user.id, teacherParent.user.id] } } }) === 0, "IAM1A_RESTORE_REACTIVATED_SESSION");

    const delegatedAudit = await client.userAudit.findFirst({ where: { action: "IAM_USER_SUSPENDED", actorUserId: director.user.id, targetUserId: viewer.user.id }, orderBy: { createdAt: "desc" } });
    const delegatedAuditDetails = delegatedAudit?.detailsJson ? JSON.parse(delegatedAudit.detailsJson) as Record<string, unknown> : null;
    invariant(Boolean(delegatedAudit?.actorUserId && delegatedAudit.targetUserId && delegatedAuditDetails?.reason && delegatedAuditDetails.before && delegatedAuditDetails.after), "IAM1AQA_DELEGATED_AUDIT_BEFORE_AFTER_INCOMPLETE");
    const iamAuditDetails = await client.userAudit.findMany({ where: { action: { startsWith: "IAM_" } }, select: { detailsJson: true } });
    invariant(!iamAuditDetails.some((entry) => /passwordHash|tokenHash|privateKey|publicKey|credential|temporaryPassword/i.test(entry.detailsJson ?? "")), "IAM1AQA_AUDIT_SECRET_EVIDENCE_LEAK");
    invariant(iamAuditDetails.length >= 7, "IAM1A_AUDIT_EVIDENCE_INCOMPLETE");
    invariant(await client.student.count() === 3 && await client.payment.count() === 0, "IAM1A_FIXTURE_SCOPE_INCORRECT");
    console.log(JSON.stringify({ result: "IAM1AQA_COPIED_DATABASE_QA_PASSED", fixtures: await client.user.count({ where: { username: { startsWith: "iam1aqa-" } } }), denialPrecedence: true, delegatedAdministration: true, multiRoleContexts: true, childIsolation: true, concurrentProfileProtection: true, concurrentAccountProtection: true, lastSuperAdminProtection: true, rollback: true, backupRestoreTwice: true, cleanupInspectedTwice: true }));
  } finally {
    await client.$disconnect();
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    invariant(JSON.stringify(operationalBefore) === JSON.stringify(operationalAfter), "IAM1A_OPERATIONAL_DATABASE_CHANGED");
    cleanupRoot();
    cleanupRoot();
  }
}

main().catch((error) => { console.error(`${activeStage}: ${error instanceof Error ? error.stack ?? error.message : error}`); cleanupRoot(); process.exitCode = 1; });
