import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient, type User } from "@prisma/client";
import { hashPassword } from "../lib/password";
import { evaluateEffectivePermission } from "../lib/iam/effective-access";
import { createPermissionProfile, updatePermissionProfile } from "../lib/iam/profiles";
import { createNamedUser, mutateNamedUser } from "../lib/iam/users";
import { listChildContexts, listRoleContexts, switchChildContext, switchRoleContext } from "../lib/iam/contexts";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { fileSha256 } from "./migration-check-utils";
import type { IamActor } from "../lib/iam/security";
import type { Role } from "../lib/permissions";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const TMP_PARENT = path.join(WORKSPACE, "tmp", "iam1a");
const ROOT = path.join(TMP_PARENT, `IAM1A-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "iam1a-qa.db");
const REASON = "IAM1A copied database governed test evidence";
let activeStage = "preflight";

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
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
    name: `IAM1A ${input.slug.replaceAll("-", " ")}`,
    designation: input.designation ?? null,
    username: `iam1a-${input.slug}-${process.pid}`,
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
    deviceSummary: "IAM1A copied desktop",
    browserSummary: "IAM1A test harness",
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
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "test",
    DATABASE_URL: databaseUrl(DATABASE),
    SESSION_SECRET: randomBytes(48).toString("base64url"),
    AUTH_SECRET: randomBytes(48).toString("base64url")
  };
  Object.assign(process.env, environment);
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], { cwd: WORKSPACE, env: environment, stdio: "pipe" });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    activeStage = "fixture creation";
    const guardians = await Promise.all([
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A One Child Parent", primaryMobile: "9000001001" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Multi Child Parent", primaryMobile: "9000001002" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Unrelated Parent", primaryMobile: "9000001003" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Teacher Parent", primaryMobile: "9000001004" } }),
      client.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: "IAM1A Director Parent", primaryMobile: "9000001005" } })
    ]);
    const students = await Promise.all([
      client.student.create({ data: { admissionNo: `IAM1A-${process.pid}-001`, studentName: "IAM1A Linked Child One", fatherName: "Synthetic", className: "I", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: `IAM1A-${process.pid}-002`, studentName: "IAM1A Linked Child Two", fatherName: "Synthetic", className: "II", phone1: "0000000000" } }),
      client.student.create({ data: { admissionNo: `IAM1A-${process.pid}-003`, studentName: "IAM1A Unrelated Child", fatherName: "Synthetic", className: "III", phone1: "0000000000" } })
    ]);
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
    await createFixture(client, { slug: "associate-director", role: "DIRECTOR", designation: "Associate Director" });
    await createFixture(client, { slug: "principal", role: "PRINCIPAL", designation: "Principal" });
    await createFixture(client, { slug: "administrator", role: "ADMIN", designation: "Administrator" });
    const accountant = await createFixture(client, { slug: "accountant", role: "ACCOUNTANT", designation: "Accountant" });
    const computerOperator = await createFixture(client, { slug: "computer-operator", role: "COMPUTER_OPERATOR", designation: "Computer Operator" });
    const teacherA = await createFixture(client, { slug: "teacher-a", role: "TEACHER", designation: "Teacher" });
    await createFixture(client, { slug: "teacher-b", role: "TEACHER", designation: "Teacher" });
    await createFixture(client, { slug: "parent-one", role: "PARENT", designation: "Parent", guardianId: guardians[0].id });
    const parentMany = await createFixture(client, { slug: "parent-many", role: "PARENT", designation: "Parent", guardianId: guardians[1].id });
    const teacherParent = await createFixture(client, { slug: "teacher-parent", role: "TEACHER", designation: "Teacher and Parent", guardianId: guardians[3].id, extraRoles: ["PARENT"] });
    await createFixture(client, { slug: "director-parent", role: "DIRECTOR", designation: "Director and Parent", guardianId: guardians[4].id, extraRoles: ["PARENT"] });
    const viewer = await createFixture(client, { slug: "viewer", role: "VIEWER", designation: "Read-only Viewer" });
    const disabled = await createFixture(client, { slug: "disabled", role: "VIEWER", active: false });
    const expired = await createFixture(client, { slug: "expired", role: "VIEWER" });
    await client.userRoleAssignment.update({ where: { id: expired.assignmentId }, data: { validFrom: new Date(Date.now() - 120_000), validUntil: new Date(Date.now() - 60_000), activeKey: null } });
    await client.staffMember.createMany({ data: [
      { iamPublicKey: randomUUID(), staffCode: `IAM1A-${process.pid}-TA`, fullName: "IAM1A Teacher A", designation: "Teacher", userId: teacherA.user.id },
      { iamPublicKey: randomUUID(), staffCode: `IAM1A-${process.pid}-TP`, fullName: "IAM1A Teacher Parent", designation: "Teacher", userId: teacherParent.user.id },
      { iamPublicKey: randomUUID(), staffCode: `IAM1A-${process.pid}-INACTIVE`, fullName: "IAM1A Inactive Staff", designation: "Teacher", status: "INACTIVE" }
    ] });

    activeStage = "permission precedence";
    invariant((await decision(client, disabled, "VIEW_DASHBOARD")).source === "ACCOUNT", "IAM1A_DISABLED_ACCOUNT_NOT_DENIED");
    invariant((await decision(client, expired, "VIEW_DASHBOARD")).source === "ROLE_ASSIGNMENT", "IAM1A_EXPIRED_ASSIGNMENT_NOT_DENIED");
    invariant((await decision(client, director, "GRANT_SUPER_ADMIN")).source === "SYSTEM_RESTRICTION", "IAM1A_INVARIANT_BYPASSED");
    invariant((await decision(client, teacherA, "MANAGE_STUDENT_ATTENDANCE", false)).source === "OBJECT_SCOPE", "IAM1A_OBJECT_SCOPE_BYPASSED");
    invariant((await decision(client, viewer, "UNKNOWN_IAM_PERMISSION")).source === "DEFAULT_DENY", "IAM1A_UNKNOWN_PERMISSION_ALLOWED");
    invariant((await decision(client, computerOperator, "VIEW_PAYMENTS")).source === "SYSTEM_RESTRICTION", "IAM1A_COMPUTER_OPERATOR_FINANCE_ESCALATION");

    activeStage = "profile creation";
    const profile = await createPermissionProfile(client, actor(superOne), {
      name: `IAM1A Limited ${process.pid}`,
      description: "Copied database conflict profile",
      reason: REASON,
      reauthPassword: superOne.password,
      entries: [{ permission: "VIEW_STUDENTS", effect: "ALLOW" }, { permission: "VIEW_PAYMENTS", effect: "DENY" }]
    });
    await client.userPermissionProfileAssignment.create({ data: { publicKey: randomUUID(), userId: accountant.user.id, profileId: (await client.permissionProfile.findUniqueOrThrow({ where: { publicKey: profile.handle } })).id, reason: REASON, assignedByUserId: superOne.user.id, activeKey: `${accountant.user.id}:${profile.handle}` } });
    await client.userPermissionOverride.create({ data: { publicKey: randomUUID(), userId: accountant.user.id, permission: "VIEW_STUDENTS", effect: "DENY", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${accountant.user.id}:VIEW_STUDENTS` } });
    const userDenyDecision = await decision(client, accountant, "VIEW_STUDENTS");
    invariant(userDenyDecision.source === "USER_DENY", `IAM1A_USER_DENY_PRECEDENCE_FAILED:${userDenyDecision.source}`);
    const profileDenyDecision = await decision(client, accountant, "VIEW_PAYMENTS", true);
    invariant(profileDenyDecision.source === "PROFILE_DENY", `IAM1A_PROFILE_DENY_PRECEDENCE_FAILED:${profileDenyDecision.source}`);

    activeStage = "pending user creation";
    const pending = await createNamedUser(client, actor(superOne), {
      name: "IAM1A Pending Named User", username: `iam1a-pending-${process.pid}`, designation: "Sub Director", roles: ["VIEWER"],
      activationMethod: "PENDING", reason: REASON, reauthPassword: superOne.password
    });
    invariant(pending.status === "PENDING_ACTIVATION", "IAM1A_UNSAFE_PENDING_ACTIVATION");
    const pendingRow = await client.user.findUniqueOrThrow({ where: { iamPublicKey: pending.handle } });
    invariant(!pendingRow.isActive && !pendingRow.mustChangePassword, "IAM1A_PENDING_USER_ACTIVE");

    activeStage = "delegated administration";
    await client.userPermissionOverride.createMany({ data: [
      { publicKey: randomUUID(), userId: director.user.id, permission: "MANAGE_IAM_USERS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${director.user.id}:MANAGE_IAM_USERS` },
      { publicKey: randomUUID(), userId: director.user.id, permission: "DELEGATE_IAM_ACCESS", effect: "ALLOW", validFrom: new Date(Date.now() - 1_000), reason: REASON, createdByUserId: superOne.user.id, activeKey: `${director.user.id}:DELEGATE_IAM_ACCESS` }
    ] });
    await mutateNamedUser(client, actor(director), viewer.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: viewer.user.version, reason: REASON, reauthPassword: director.password });
    invariant((await client.user.findUniqueOrThrow({ where: { id: viewer.user.id } })).lifecycleStatus === "SUSPENDED", "IAM1A_DELEGATED_DIRECTOR_FAILED");
    let selfEscalationDenied = false;
    try { await mutateNamedUser(client, actor(director), director.user.iamPublicKey!, { action: "ASSIGN_ROLE", role: "SUPER_ADMIN", expectedVersion: director.user.version, reason: REASON, reauthPassword: director.password }); } catch { selfEscalationDenied = true; }
    invariant(selfEscalationDenied, "IAM1A_SELF_ESCALATION_ALLOWED");

    activeStage = "role and child contexts";
    const roleContexts = await listRoleContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    invariant(roleContexts.contexts.length === 2 && roleContexts.pickerRequired, "IAM1A_MULTI_ROLE_PICKER_INCORRECT");
    const parentContext = roleContexts.contexts.find((context) => context.label === "Parent");
    invariant(parentContext, "IAM1A_PARENT_ROLE_CONTEXT_MISSING");
    let crossUserRoleDenied = false;
    try { await switchRoleContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId, handle: parentContext.handle, expectedVersion: 1 }); } catch { crossUserRoleDenied = true; }
    invariant(crossUserRoleDenied, "IAM1A_CROSS_USER_ROLE_HANDLE_REUSED");
    await switchRoleContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: parentContext.handle, expectedVersion: 1 });
    const children = await listChildContexts(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId });
    invariant(children.children.length === 2 && children.pickerRequired, "IAM1A_CHILD_CONTEXT_MATRIX_INCORRECT");
    let crossFamilyChildDenied = false;
    try { await switchChildContext(client, { userId: parentMany.user.id, sessionId: parentMany.sessionId, handle: children.children[0].handle, expectedVersion: 1 }); } catch { crossFamilyChildDenied = true; }
    invariant(crossFamilyChildDenied, "IAM1A_CROSS_FAMILY_CHILD_HANDLE_REUSED");
    await switchChildContext(client, { userId: teacherParent.user.id, sessionId: teacherParent.sessionId, handle: children.children[0].handle, expectedVersion: 2 });

    activeStage = "profile concurrency";
    const profileRow = await client.permissionProfile.findUniqueOrThrow({ where: { publicKey: profile.handle } });
    const updates = await Promise.allSettled([1, 2].map(() => updatePermissionProfile(client, actor(superOne), profile.handle, {
      expectedVersion: profileRow.version,
      name: profileRow.name,
      description: profileRow.description,
      reason: REASON,
      reauthPassword: superOne.password,
      impactAcknowledged: true,
      entries: [{ permission: "VIEW_STUDENTS", effect: "ALLOW" }, { permission: "VIEW_PAYMENTS", effect: "DENY" }]
    })));
    invariant(updates.filter((item) => item.status === "fulfilled").length === 1 && updates.filter((item) => item.status === "rejected").length === 1, "IAM1A_PROFILE_CONCURRENCY_FAILED");

    activeStage = "last super admin";
    const secondSuper = await client.user.findUniqueOrThrow({ where: { id: superTwo.user.id } });
    await mutateNamedUser(client, actor(superOne), secondSuper.iamPublicKey!, { action: "SUSPEND", expectedVersion: secondSuper.version, reason: REASON, reauthPassword: superOne.password });
    let soleSuperDenied = false;
    try { await mutateNamedUser(client, actor(superOne), superOne.user.iamPublicKey!, { action: "SUSPEND", expectedVersion: superOne.user.version, reason: REASON, reauthPassword: superOne.password }); } catch { soleSuperDenied = true; }
    invariant(soleSuperDenied, "IAM1A_SOLE_SUPER_ADMIN_NOT_PROTECTED");

    activeStage = "forced rollback";
    const beforeRollback = await client.permissionProfile.count();
    try {
      await client.$transaction(async (tx) => { await tx.permissionProfile.create({ data: { publicKey: randomUUID(), name: "IAM1A Forced Rollback", normalizedName: `iam1a forced rollback ${process.pid}`, status: "ACTIVE", version: 1, createdByUserId: superOne.user.id, updatedByUserId: superOne.user.id } }); throw new Error("IAM1A_FORCED_FAILURE"); });
    } catch {}
    invariant(await client.permissionProfile.count() === beforeRollback, "IAM1A_TRANSACTION_ROLLBACK_FAILED");

    activeStage = "backup restore twice";
    await client.authSession.updateMany({ where: { userId: { in: [superOne.user.id, accountant.user.id, teacherParent.user.id] }, revokedAt: null }, data: { revokedAt: new Date(), revocationReason: "IAM1A_BACKUP_REHEARSAL" } });
    const backup = await generateFullBackup(client, { generatedBy: "IAM1A copied database QA" });
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

    invariant(await client.userAudit.count({ where: { action: { startsWith: "IAM_" } } }) >= 7, "IAM1A_AUDIT_EVIDENCE_INCOMPLETE");
    invariant(await client.student.count() === 3 && await client.payment.count() === 0, "IAM1A_FIXTURE_SCOPE_INCORRECT");
    console.log(JSON.stringify({ result: "IAM1A_COPIED_DATABASE_QA_PASSED", fixtures: await client.user.count({ where: { username: { startsWith: "iam1a-" } } }), denialPrecedence: true, delegatedAdministration: true, multiRoleContexts: true, childIsolation: true, concurrentProfileProtection: true, rollback: true, backupRestoreTwice: true }));
  } finally {
    await client.$disconnect();
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    invariant(JSON.stringify(operationalBefore) === JSON.stringify(operationalAfter), "IAM1A_OPERATIONAL_DATABASE_CHANGED");
    const resolvedRoot = path.resolve(ROOT);
    invariant(resolvedRoot.startsWith(`${path.resolve(TMP_PARENT)}${path.sep}`), "IAM1A_CLEANUP_SCOPE_REFUSED");
    if (existsSync(resolvedRoot)) rmSync(resolvedRoot, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(`${activeStage}: ${error instanceof Error ? error.message : error}`); process.exitCode = 1; });
