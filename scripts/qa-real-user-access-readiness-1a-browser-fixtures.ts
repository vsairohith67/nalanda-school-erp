import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient, type Role } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { beginTotpEnrollment, confirmTotpEnrollment } from "@/lib/real-user-access/mfa-service";
import { generateTotpForSyntheticQa } from "@/lib/real-user-access/totp";

const workspace = path.resolve(".");
const root = path.join(workspace, "tmp", "real-user-access-readiness-1a-browser");
const database = path.join(root, "browser.db");
const runtimePath = path.join(root, "runtime-env.json");
const credentialsPath = path.join(root, "credentials.json");
const databaseUrl = `file:${database.replaceAll("\\", "/")}`;
const port = 3274;

function assertFixtureRoot() {
  const resolved = path.resolve(root);
  const parent = path.resolve(workspace, "tmp");
  if (resolved !== path.join(parent, "real-user-access-readiness-1a-browser")) throw new Error("REAL_USER_ACCESS_BROWSER_SCOPE_REFUSED");
  return resolved;
}

function cleanup() {
  const target = assertFixtureRoot();
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}

function migrate() {
  const entry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const run = (diagnostic = false) => spawnSync(process.execPath, [entry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], {
    cwd: workspace,
    env: { ...process.env, DATABASE_PROVIDER: "sqlite", DATABASE_URL: databaseUrl, ...(diagnostic ? { RUST_BACKTRACE: "1", RUST_LOG: "info" } : {}) },
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 64 * 1024 * 1024
  });
  let result = run();
  if (!result.error && result.status !== 0 && `${result.stdout}\n${result.stderr}`.includes("Schema engine error")) result = run(true);
  if (result.error || result.status !== 0) throw new Error(`REAL_USER_ACCESS_BROWSER_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

async function createActor(client: PrismaClient, input: { username: string; name: string; role: Role; password: string }) {
  const user = await client.user.create({ data: {
    iamPublicKey: randomUUID(), name: input.name, designation: `${input.role} synthetic Browser QA`, username: input.username,
    passwordHash: await hashPassword(input.password), role: input.role, isActive: true, lifecycleStatus: "ACTIVE",
    authLoginAliases: { create: { type: "USERNAME", normalizedValue: input.username, displayMasked: input.username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } }
  } });
  const assignment = await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: input.role, status: "ACTIVE", reason: "REAL-USER-ACCESS-READINESS-1A synthetic Browser QA", activeKey: `${user.id}:${input.role}` } });
  return { user, assignment };
}

async function setup() {
  cleanup();
  mkdirSync(root, { recursive: true });
  migrate();
  const password = `Synthetic-Browser-${randomBytes(18).toString("base64url")}!9a`;
  const sessionSecret = randomBytes(48).toString("base64url");
  const mfaKeyring = JSON.stringify({ active: "BROWSER1", keys: { BROWSER1: randomBytes(32).toString("base64") } });
  Object.assign(process.env, {
    DATABASE_PROVIDER: "sqlite", DATABASE_URL: databaseUrl, NODE_ENV: "test", APP_ORIGIN: `http://127.0.0.1:${port}`,
    AUTH_BOUND_ENVIRONMENT: "SYNTHETIC_BROWSER_QA", AUTH_WEBAUTHN_RP_ID: "127.0.0.1", AUTH_WEBAUTHN_ORIGIN: `http://127.0.0.1:${port}`,
    RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-user-access-readiness-1a",
    SESSION_SECRET: sessionSecret, AUTH_SECRET: sessionSecret, AUTH_MFA_KEYRING_JSON: mfaKeyring
  });
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await client.rolePermission.createMany({ data: [
      { role: "SUPER_ADMIN", permission: "VIEW_IAM_ACCESS", enabled: true },
      { role: "SUPER_ADMIN", permission: "MANAGE_IAM_USERS", enabled: true },
      { role: "SUPER_ADMIN", permission: "VIEW_IAM_AUDIT", enabled: true },
      { role: "VIEWER", permission: "VIEW_IAM_ACCESS", enabled: true }
    ] });
    const requester = await createActor(client, { username: "rua.browser.requester", name: "Synthetic Browser Requester", role: "ADMIN", password });
    const reviewer = await createActor(client, { username: "rua.browser.reviewer", name: "Synthetic Browser Reviewer", role: "DIRECTOR", password });
    const approver = await createActor(client, { username: "rua.browser.approver", name: "Synthetic Browser Approver", role: "SUPER_ADMIN", password });

    const enrollment = await beginTotpEnrollment(client, { userId: approver.user.id, displayName: "Synthetic Browser authenticator", accountLabel: approver.user.username }, process.env);
    const pendingFactor = await client.mfaAuthenticator.findFirstOrThrow({ where: { publicKey: enrollment.factorHandle, userId: approver.user.id } });
    const setupTimestamp = Date.now();
    const setupCode = generateTotpForSyntheticQa({ secretEnvelope: pendingFactor.secretEnvelope!, userId: approver.user.id, authenticatorId: pendingFactor.id, timestamp: setupTimestamp }, process.env);
    await confirmTotpEnrollment(client, { userId: approver.user.id, factorHandle: enrollment.factorHandle, token: setupCode, environment: "SYNTHETIC_BROWSER_QA", timestamp: setupTimestamp }, process.env);

    const candidateStaff = await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "RUA-BROWSER-CANDIDATE", fullName: "Synthetic Browser Access Candidate", designation: "Read-only operations", department: "Synthetic QA", status: "ACTIVE" } });
    await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "RUA-BROWSER-PREPARE", fullName: "Synthetic Browser Preparation Target", designation: "Teacher", department: "Synthetic QA", status: "ACTIVE" } });
    const request = await client.userAccessRequest.create({ data: {
      personType: "STAFF", staffMemberId: candidateStaff.id, requestedName: candidateStaff.fullName, requestedUsername: "rua.browser.candidate",
      requestedEmail: "rua.browser.candidate@example.test", requestedRolesJson: JSON.stringify(["VIEWER"]), requestedScopesJson: JSON.stringify(["REPORTS:READ_ONLY"]),
      reason: "Synthetic Browser QA account readiness approval", status: "AWAITING_APPROVAL", identityLinkReviewed: true, eligibilityConfirmed: true,
      mfaRequired: false, trainingRequirementsJson: JSON.stringify(["SECURITY_BASICS", "PRIVACY_AND_ACCESS"]), policyRequirementsJson: JSON.stringify(["SECURITY_AND_PRIVACY_POLICY_V1"]),
      conflictWarningsJson: "[]", requestedByUserId: requester.user.id, reviewedByUserId: reviewer.user.id, requestedValidUntil: new Date(Date.now() + 30 * 86_400_000), reviewDueAt: new Date(Date.now() + 7 * 86_400_000)
    } });

    await client.userAccessRequest.createMany({ data: [
      { personType: "OTHER", requestedName: "Synthetic Suspended Account", requestedUsername: "rua.browser.suspended", requestedRolesJson: "[\"VIEWER\"]", requestedScopesJson: "[]", reason: "Synthetic suspended-state Browser QA", status: "SUSPENDED", trainingRequirementsJson: "[]", policyRequirementsJson: "[]", conflictWarningsJson: "[]", requestedByUserId: requester.user.id },
      { personType: "OTHER", requestedName: "Synthetic Offboarded Account", requestedUsername: "rua.browser.offboarded", requestedRolesJson: "[\"VIEWER\"]", requestedScopesJson: "[]", reason: "Synthetic offboarded-state Browser QA", status: "DISABLED", trainingRequirementsJson: "[]", policyRequirementsJson: "[]", conflictWarningsJson: "[]", requestedByUserId: requester.user.id }
    ] });
    const temporary = await createActor(client, { username: "rua.browser.temporary", name: "Synthetic Expired Temporary User", role: "VIEWER", password });
    await client.userRoleAssignment.update({ where: { id: temporary.assignment.id }, data: { validFrom: new Date(Date.now() - 2 * 86_400_000), validUntil: new Date(Date.now() - 86_400_000) } });
    await client.accessCertification.create({ data: { userId: temporary.user.id, status: "REVIEW_DUE", dueAt: new Date(Date.now() - 86_400_000), scopeSnapshotJson: JSON.stringify({ roles: ["VIEWER"], synthetic: true }) } });

    const runtime = {
      DATABASE_PROVIDER: "sqlite", DATABASE_URL: databaseUrl, SESSION_SECRET: sessionSecret, AUTH_SECRET: sessionSecret,
      APP_ORIGIN: `http://127.0.0.1:${port}`, AUTH_BOUND_ENVIRONMENT: "SYNTHETIC_BROWSER_QA",
      AUTH_WEBAUTHN_RP_ID: "127.0.0.1", AUTH_WEBAUTHN_ORIGIN: `http://127.0.0.1:${port}`,
      AUTH_MFA_KEYRING_JSON: mfaKeyring, RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY",
      RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-user-access-readiness-1a", NODE_ENV: "development", PORT: String(port)
    };
    writeFileSync(runtimePath, JSON.stringify(runtime, null, 2), { flag: "wx" });
    writeFileSync(credentialsPath, JSON.stringify({ password, approver: approver.user.username, candidate: request.requestedUsername }, null, 2), { flag: "wx" });
    process.stdout.write(`${JSON.stringify({ result: "REAL_USER_ACCESS_BROWSER_READY", database: "FRESH_SYNTHETIC", operationalDatabaseRead: false, operationalDatabaseMutation: false, port, runtimePath, credentialsPath, approvableRequest: request.publicKey })}\n`);
  } finally {
    await client.$disconnect();
  }
}

async function code(username: string) {
  const runtime = JSON.parse(readFileSync(runtimePath, "utf8")) as Record<string, string>;
  Object.assign(process.env, runtime);
  const client = new PrismaClient({ datasourceUrl: runtime.DATABASE_URL });
  try {
    const user = await client.user.findUniqueOrThrow({ where: { username } });
    const factor = await client.mfaAuthenticator.findFirstOrThrow({ where: { userId: user.id, type: "TOTP", status: { in: ["ACTIVE", "PENDING"] }, revokedAt: null }, orderBy: { createdAt: "desc" } });
    const currentStep = Math.floor(Date.now() / 30_000);
    const requiredStep = Math.max(currentStep + 1, (factor.totpLastUsedStep ?? -1) + 1);
    const usableWhenStep = requiredStep - 1;
    const waitMs = Math.max(0, usableWhenStep * 30_000 - Date.now() + 250);
    if (waitMs > 0) { process.stdout.write(`${JSON.stringify({ result: "WAIT_FOR_NEXT_TOTP_WINDOW", waitMs })}\n`); return; }
    const timestamp = requiredStep * 30_000 + 1_000;
    const token = generateTotpForSyntheticQa({ secretEnvelope: factor.secretEnvelope!, userId: user.id, authenticatorId: factor.id, timestamp }, process.env);
    process.stdout.write(`${JSON.stringify({ result: "SYNTHETIC_TOTP_READY", username, token, step: requiredStep })}\n`);
  } finally { await client.$disconnect(); }
}

async function addOtherSession() {
  const runtime = JSON.parse(readFileSync(runtimePath, "utf8")) as Record<string, string>;
  const credentials = JSON.parse(readFileSync(credentialsPath, "utf8")) as { candidate: string };
  const client = new PrismaClient({ datasourceUrl: runtime.DATABASE_URL });
  try {
    const user = await client.user.findUniqueOrThrow({ where: { username: credentials.candidate }, include: { iamRoleAssignments: { where: { status: "ACTIVE" }, take: 1 } } });
    await client.authSession.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion, activeRoleAssignmentId: user.iamRoleAssignments[0]?.id, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "Synthetic secondary laptop", browserSummary: "Synthetic Browser QA", networkEvidenceMasked: "loopback" } });
    process.stdout.write('{"result":"SYNTHETIC_SECOND_SESSION_READY"}\n');
  } finally { await client.$disconnect(); }
}

const mode = process.argv[2];
if (mode === "setup") setup().catch(fail);
else if (mode === "cleanup") { cleanup(); process.stdout.write('{"result":"REAL_USER_ACCESS_BROWSER_REMOVED"}\n'); }
else if (mode === "code") code(String(process.argv[3] ?? "rua.browser.candidate")).catch(fail);
else if (mode === "other-session") addOtherSession().catch(fail);
else { process.stderr.write("Use setup, cleanup, code [username], or other-session\n"); process.exitCode = 1; }

function fail(error: unknown) { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; }
