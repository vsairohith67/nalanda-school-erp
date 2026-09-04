import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import { beginTotpEnrollment, confirmTotpEnrollment, consumeRecoveryCode } from "@/lib/real-user-access/mfa-service";
import { beginActivationTotp, confirmActivationTotp } from "@/lib/real-user-access/activation-mfa";
import { generateTotpForSyntheticQa } from "@/lib/real-user-access/totp";
import { createStepUpChallenge, completeStepUpChallenge } from "@/lib/real-user-access/step-up";
import {
  acknowledgeActivationPolicy, approveAccessRequest, completeAccountActivation,
  beginActivationTraining, completeActivationTraining, confirmActivationRoles, establishActivationPassword,
  issueSyntheticInvitation, prepareAccessRequest, reviewAccessRequest, submitAccessRequest
} from "@/lib/real-user-access/workflow";
import { acceptOneTimeInvitation } from "@/lib/real-user-access/invitations";
import { completeLoginMfaChallenge, createLoginMfaChallenge } from "@/lib/real-user-access/login-mfa";
import { approveMfaRecovery, decideAccessCertification, expireTemporaryAccess, offboardUser, requestMfaRecovery, reviewMfaRecovery } from "@/lib/real-user-access/governance";
import { loadRealUserAccessBackup, validateRealUserAccessBackup } from "@/lib/real-user-access/backup";
import { restoreRealUserAccessBackup } from "@/lib/real-user-access/restore";

const SUITE = "REALUSERACCESSREADINESS1A";
const workspace = path.resolve(".");
const root = path.join(workspace, "tmp", `real-user-access-1a-${process.pid}`);
const ciSyntheticBaseline = process.env.REAL_USER_ACCESS_CREATE_CI_BASELINE === "1";
const operational = ciSyntheticBaseline ? path.join(root, "ci-operational-baseline.db") : path.resolve(process.env.REAL_USER_ACCESS_OPERATIONAL_DB?.trim() || "C:/Users/rohit/Documents/school software/prisma/dev.db");
// Node exposes the provided 2026-08-10T10:55:19.8897824Z timestamp rounded to milliseconds.
const knownOperational = { sha256: "65F47EFA37DA321023439303770645F8D656F2BE58458C1A03B341408EF9A6FA", size: 8_409_088, lastWriteUtc: "2026-08-10T10:55:19.890Z" };
const copiedDatabase = path.join(root, "copy.db");
const freshDatabase = path.join(root, "fresh.db");
const restoreDatabase = path.join(root, "restore.db");
const environment = "SYNTHETIC_QA";
let stage = "preflight";
let totpStep = 0;

type Identity = { sha256: string; size: number; lastWriteUtc: string };
function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function identity(file: string): Identity { const stat = statSync(file); return { sha256: createHash("sha256").update(readFileSync(file)).digest("hex").toUpperCase(), size: stat.size, lastWriteUtc: stat.mtime.toISOString() }; }
function databaseUrl(file: string) { return `file:${path.resolve(file).replaceAll("\\", "/")}`; }
function prismaFor(file: string) { return new PrismaClient({ datasourceUrl: databaseUrl(file) }); }
function cleanup() {
  const target = path.resolve(root), permitted = path.resolve(workspace, "tmp");
  invariant(target.startsWith(`${permitted}${path.sep}`) && path.basename(target) === `real-user-access-1a-${process.pid}`, `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
function migrate(file: string, schema = "prisma/schema.prisma") {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const run = (diagnostic = false) => spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", schema], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file), DATABASE_PROVIDER: "sqlite", ...(diagnostic ? { RUST_BACKTRACE: "1", RUST_LOG: "info" } : {}) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  let result = run();
  if (!result.error && result.status !== 0 && `${result.stdout}\n${result.stderr}`.includes("Schema engine error")) result = run(true);
  if (result.error || result.status !== 0) throw new Error(`${SUITE}_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
  return `${result.stdout}\n${result.stderr}`;
}
function createCiSyntheticBaseline() {
  invariant(process.env.CI === "true" && process.env.NALANDA_ENVIRONMENT === "TEST" && process.env.RELEASE_CI_SYNTHETIC_OPT_IN === "true", `${SUITE}_CI_BASELINE_OPT_IN_REQUIRED`);
  const legacyPrisma = path.join(root, "legacy-prisma"), legacyMigrations = path.join(legacyPrisma, "migrations");
  mkdirSync(legacyMigrations, { recursive: true });
  copyFileSync(path.join(workspace, "prisma", "schema.prisma"), path.join(legacyPrisma, "schema.prisma"));
  for (const entry of readdirSync(path.join(workspace, "prisma", "migrations"), { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === "20260902090000_real_user_access_readiness_1a") continue;
    cpSync(path.join(workspace, "prisma", "migrations", entry.name), path.join(legacyMigrations, entry.name), { recursive: true });
  }
  migrate(operational, path.join(legacyPrisma, "schema.prisma"));
}
async function expectRefusal(run: () => unknown | Promise<unknown>, code: string) {
  try { await run(); } catch (error) { if (error instanceof Error && error.message.includes(code)) return; throw error; }
  throw new Error(`${SUITE}_EXPECTED_REFUSAL_MISSING:${code}`);
}
function resultBucket() { return { created: 0, updated: 0, skipped: 0, errors: [] as string[] }; }

async function main() {
  cleanup(); mkdirSync(root, { recursive: true });
  if (ciSyntheticBaseline) createCiSyntheticBaseline();
  invariant(existsSync(operational), `${SUITE}_OPERATIONAL_DATABASE_MISSING`);
  const before = identity(operational);
  const expectedOperational = ciSyntheticBaseline ? before : knownOperational;
  invariant(before.sha256 === expectedOperational.sha256 && before.size === expectedOperational.size && before.lastWriteUtc === expectedOperational.lastWriteUtc, `${SUITE}_OPERATIONAL_BASELINE_MISMATCH:${JSON.stringify(before)}`);
  invariant(!["-journal", "-wal", "-shm"].some((suffix) => existsSync(`${operational}${suffix}`)), `${SUITE}_OPERATIONAL_SIDECAR_PRESENT`);
  copyFileSync(operational, copiedDatabase);

  stage = "migration matrix";
  const freshOutput = migrate(freshDatabase), copyOutput = migrate(copiedDatabase), repeatOutput = migrate(copiedDatabase), restoreOutput = migrate(restoreDatabase);
  invariant(freshOutput.includes("20260902090000_real_user_access_readiness_1a"), `${SUITE}_FRESH_MIGRATION_MISSING`);
  invariant(copyOutput.includes("20260902090000_real_user_access_readiness_1a"), `${SUITE}_COPY_MIGRATION_MISSING`);
  invariant(repeatOutput.includes("No pending migrations"), `${SUITE}_MIGRATION_NOT_IDEMPOTENT`);
  invariant(restoreOutput.includes("20260902090000_real_user_access_readiness_1a"), `${SUITE}_RESTORE_MIGRATION_MISSING`);

  Object.assign(process.env, {
    DATABASE_PROVIDER: "sqlite", DATABASE_URL: databaseUrl(copiedDatabase), NODE_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3000",
    RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: "real-user-access-readiness-1a",
    AUTH_BOUND_ENVIRONMENT: environment, AUTH_WEBAUTHN_RP_ID: "127.0.0.1", AUTH_WEBAUTHN_ORIGIN: "http://127.0.0.1:3000",
    SESSION_SECRET: "synthetic-real-user-access-session-secret-2026-09-03",
    AUTH_MFA_KEYRING_JSON: JSON.stringify({ active: "QA1", keys: { QA1: Buffer.alloc(32, 7).toString("base64") } })
  });
  const prisma = prismaFor(copiedDatabase);
  const restore = prismaFor(restoreDatabase);
  try {
    stage = "synthetic actor and person fixtures";
    const suffix = randomUUID().slice(0, 8), passwordHash = await hashPassword(`Synthetic-QA-${randomBytes(24).toString("base64url")}!`);
    for (const [role, permission] of [["ADMIN", "MANAGE_IAM_USERS"], ["DIRECTOR", "VIEW_IAM_ACCESS"], ["SUPER_ADMIN", "MANAGE_IAM_USERS"], ["SUPER_ADMIN", "VIEW_IAM_AUDIT"]] as const) {
      await prisma.rolePermission.upsert({ where: { role_permission: { role, permission } }, create: { role, permission, enabled: true }, update: { enabled: true } });
    }
    async function actor(label: string, role: "ADMIN" | "DIRECTOR" | "SUPER_ADMIN") {
      const user = await prisma.user.create({ data: { iamPublicKey: randomUUID(), name: `Synthetic ${label}`, username: `rua.${label}.${suffix}`, passwordHash, role, isActive: true, lifecycleStatus: "ACTIVE", designation: `${role} isolated QA` } });
      const assignment = await prisma.userRoleAssignment.create({ data: { userId: user.id, role, status: "ACTIVE", reason: "Synthetic isolated access-readiness rehearsal", activeKey: `${user.id}:${role}` } });
      const session = await prisma.authSession.create({ data: { userId: user.id, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: user.credentialVersion, authorizationVersion: user.authorizationVersion, activeRoleAssignmentId: assignment.id, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "Synthetic QA browser", browserSummary: "Synthetic browser", networkEvidenceMasked: "loopback" } });
      return { row: user, assignment, session, iam: { user: { id: user.id, name: user.name, username: user.username, email: user.email, designation: user.designation, role, roleAssignmentId: assignment.id, authorizationVersion: user.authorizationVersion, mustChangePassword: user.mustChangePassword, guardianId: user.guardianId }, sessionId: session.id } };
    }
    const preparer = await actor("preparer", "ADMIN"), reviewer = await actor("reviewer", "DIRECTOR"), approver = await actor("approver", "SUPER_ADMIN");
    const staff = await prisma.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: `RUA-${suffix}`, fullName: "Synthetic Readiness Teacher", designation: "Teacher", department: "Synthetic QA", status: "ACTIVE" } });

    stage = "governed request approvals";
    await expectRefusal(() => prepareAccessRequest(prisma, preparer.iam, { personType: "STAFF", personHandle: staff.iamPublicKey, username: `unsafe.${suffix}`, email: `unsafe.${suffix}@example.test`, roles: ["TEACHER", "PARENT"], scopes: ["SYNTHETIC"], reason: "Synthetic cross-person role refusal rehearsal" }), "ACCESS_PERSON_ROLE_LINK_INCOMPATIBLE");
    const prepared = await prepareAccessRequest(prisma, preparer.iam, { personType: "STAFF", personHandle: staff.iamPublicKey, username: `teacher.${suffix}`, email: `teacher.${suffix}@example.test`, roles: ["TEACHER"], scopes: ["CLASS:VII:A"], reason: "Synthetic account activation workflow rehearsal" });
    await submitAccessRequest(prisma, preparer.iam, prepared.requestKey);
    await expectRefusal(() => reviewAccessRequest(prisma, preparer.iam, prepared.requestKey), "ACCESS_REQUEST_SELF_REVIEW_REFUSED");
    const reviewerInParentContext = { ...reviewer.iam, user: { ...reviewer.iam.user, role: "PARENT" as const } };
    await expectRefusal(() => reviewAccessRequest(prisma, reviewerInParentContext, prepared.requestKey), "ACCESS_APPROVER_ROLE_INELIGIBLE");
    await reviewAccessRequest(prisma, reviewer.iam, prepared.requestKey);

    const enrollment = await beginTotpEnrollment(prisma, { userId: approver.row.id, displayName: "Synthetic approver authenticator", accountLabel: approver.row.username }, process.env);
    const approverFactor = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: enrollment.factorHandle } });
    const firstTimestamp = Date.now();
    const firstCode = generateTotpForSyntheticQa({ secretEnvelope: approverFactor.secretEnvelope!, userId: approver.row.id, authenticatorId: approverFactor.id, timestamp: firstTimestamp }, process.env);
    await confirmTotpEnrollment(prisma, { userId: approver.row.id, factorHandle: enrollment.factorHandle, token: firstCode, environment, timestamp: firstTimestamp }, process.env);
    async function stepUp(action: string) {
      const challenge = await createStepUpChallenge(prisma, { userId: approver.row.id, sessionId: approver.session.id, action, environment }, process.env);
      invariant(challenge.factorType === "TOTP", `${SUITE}_UNEXPECTED_STEP_UP_FACTOR`);
      const timestamp = firstTimestamp + (++totpStep * 30_000);
      const current = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { id: approverFactor.id } });
      const code = generateTotpForSyntheticQa({ secretEnvelope: current.secretEnvelope!, userId: approver.row.id, authenticatorId: current.id, timestamp }, process.env);
      return completeStepUpChallenge(prisma, { challengeToken: challenge.challengeToken, userId: approver.row.id, sessionId: approver.session.id, action, environment, factor: "TOTP", response: code, timestamp }, process.env);
    }
    const approvalGrant = await stepUp("ACCESS_REQUEST_APPROVE");
    const approved = await approveAccessRequest(prisma, approver.iam, { requestKey: prepared.requestKey, stepUpToken: approvalGrant.stepUpToken, environment }, process.env);
    const invitationGrant = await stepUp("ACCESS_INVITATION_ISSUE");
    const issued = await issueSyntheticInvitation(prisma, approver.iam, { requestKey: prepared.requestKey, environment, activationOrigin: "http://127.0.0.1:3000", stepUpToken: invitationGrant.stepUpToken }, process.env);
    invariant(issued.preview.link.includes("/activate#token=") && !issued.preview.link.includes("?token="), `${SUITE}_INVITATION_FRAGMENT_POLICY_FAILED`);
    const oneTimeToken = decodeURIComponent(new URL(issued.preview.link).hash.slice("#token=".length));
    await expectRefusal(async () => { const wrong = await acceptOneTimeInvitation(prisma, oneTimeToken, "WRONG_ENVIRONMENT", new Date(), process.env); if (!wrong.valid) throw new Error("INVITATION_WRONG_ENVIRONMENT_REFUSED"); }, "INVITATION_WRONG_ENVIRONMENT_REFUSED");
    const accepted = await acceptOneTimeInvitation(prisma, oneTimeToken, environment, new Date(), process.env);
    invariant(accepted.valid && "activationToken" in accepted && typeof accepted.activationToken === "string", `${SUITE}_INVITATION_ACCEPTANCE_FAILED`);
    const activationToken = accepted.activationToken;
    invariant(!(await acceptOneTimeInvitation(prisma, oneTimeToken, environment, new Date(), process.env)).valid, `${SUITE}_INVITATION_REPLAY_ACCEPTED`);

    stage = "activation MFA training and login";
    await establishActivationPassword(prisma, { activationToken, environment, password: "Synthetic-Activation-Phrase-2026!" }, process.env);
    const candidateId = approved.userHandle ? (await prisma.user.findUniqueOrThrow({ where: { iamPublicKey: approved.userHandle } })).id : "";
    const candidateEnrollment = await beginActivationTotp(prisma, { activationToken, environment, displayName: "Synthetic candidate authenticator" }, process.env);
    const candidateFactor = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: candidateEnrollment.factorHandle } });
    const candidateTimestamp = Date.now();
    const candidateCode = generateTotpForSyntheticQa({ secretEnvelope: candidateFactor.secretEnvelope!, userId: candidateId, authenticatorId: candidateFactor.id, timestamp: candidateTimestamp }, process.env);
    const supersededCodes = await confirmActivationTotp(prisma, { activationToken, environment, factorHandle: candidateEnrollment.factorHandle, token: candidateCode }, process.env);
    const replacementEnrollment = await beginActivationTotp(prisma, { activationToken, environment, displayName: "Synthetic replacement authenticator" }, process.env);
    const replacementFactor = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { publicKey: replacementEnrollment.factorHandle } });
    const replacementTimestamp = Date.now();
    const replacementCode = generateTotpForSyntheticQa({ secretEnvelope: replacementFactor.secretEnvelope!, userId: candidateId, authenticatorId: replacementFactor.id, timestamp: replacementTimestamp }, process.env);
    const candidateConfirmed = await confirmActivationTotp(prisma, { activationToken, environment, factorHandle: replacementEnrollment.factorHandle, token: replacementCode }, process.env);
    invariant(!(await consumeRecoveryCode(prisma, { userId: candidateId, code: supersededCodes.recoveryCodes[0], environment }, process.env)).verified, `${SUITE}_SUPERSEDED_RECOVERY_CODE_ACCEPTED`);
    invariant(await prisma.mfaRecoveryCode.count({ where: { userId: candidateId, status: "ACTIVE", usedAt: null, revokedAt: null } }) === 10, `${SUITE}_RECOVERY_CODE_ROTATION_COUNT_FAILED`);
    const request = await prisma.userAccessRequest.findUniqueOrThrow({ where: { publicKey: prepared.requestKey } });
    for (const moduleKey of JSON.parse(request.trainingRequirementsJson) as string[]) {
      const trainingStartedAt = new Date();
      const module = await beginActivationTraining(prisma, { activationToken, environment, moduleKey, now: trainingStartedAt }, process.env);
      await expectRefusal(() => completeActivationTraining(prisma, { activationToken, environment, moduleKey, moduleHandle: module.moduleHandle, acknowledgement: "I_COMPLETED_THE_TRAINING", now: trainingStartedAt }, process.env), "TRAINING_SERVER_EVIDENCE_INCOMPLETE");
      await completeActivationTraining(prisma, { activationToken, environment, moduleKey, moduleHandle: module.moduleHandle, acknowledgement: "I_COMPLETED_THE_TRAINING", now: new Date(trainingStartedAt.getTime() + 6_000) }, process.env);
    }
    await acknowledgeActivationPolicy(prisma, { activationToken, environment, acknowledgement: "I_ACCEPT_THE_SECURITY_AND_PRIVACY_POLICY" }, process.env);
    await confirmActivationRoles(prisma, { activationToken, environment, roles: ["TEACHER"] }, process.env);
    const injectedRole = await prisma.userRoleAssignment.create({ data: { userId: candidateId, role: "DIRECTOR", status: "PENDING", reason: "Synthetic role-injection refusal rehearsal" } });
    await expectRefusal(() => completeAccountActivation(prisma, { activationToken, environment }, process.env), "ACTIVATION_ROLE_ASSIGNMENTS_CHANGED");
    await prisma.userRoleAssignment.delete({ where: { id: injectedRole.id } });
    await completeAccountActivation(prisma, { activationToken, environment }, process.env);
    const active = await prisma.user.findUniqueOrThrow({ where: { id: candidateId } });
    invariant(active.isActive && active.lifecycleStatus === "ACTIVE" && (await prisma.staffMember.findUniqueOrThrow({ where: { id: staff.id } })).userId === candidateId, `${SUITE}_ACTIVATION_NOT_ATOMIC`);
    const loginChallenge = await createLoginMfaChallenge(prisma, { userId: candidateId, environment }, process.env);
    invariant(loginChallenge.required && loginChallenge.enrolled && "challengeToken" in loginChallenge, `${SUITE}_LOGIN_MFA_NOT_REQUIRED`);
    const loginTimestamp = candidateTimestamp + 30_000;
    const activeFactor = await prisma.mfaAuthenticator.findUniqueOrThrow({ where: { id: candidateFactor.id } });
    const loginCode = generateTotpForSyntheticQa({ secretEnvelope: activeFactor.secretEnvelope!, userId: candidateId, authenticatorId: activeFactor.id, timestamp: loginTimestamp }, process.env);
    const login = await completeLoginMfaChallenge(prisma, { challengeToken: loginChallenge.challengeToken, environment, factor: "TOTP", response: loginCode, timestamp: loginTimestamp }, process.env);
    invariant(login.verified, `${SUITE}_LOGIN_MFA_FAILED`);
    invariant(!(await completeLoginMfaChallenge(prisma, { challengeToken: loginChallenge.challengeToken, environment, factor: "TOTP", response: loginCode, timestamp: loginTimestamp }, process.env)).verified, `${SUITE}_LOGIN_CHALLENGE_REPLAYED`);
    invariant((await consumeRecoveryCode(prisma, { userId: candidateId, code: candidateConfirmed.recoveryCodes[0], environment }, process.env)).verified, `${SUITE}_RECOVERY_CODE_FAILED`);
    invariant(!(await consumeRecoveryCode(prisma, { userId: candidateId, code: candidateConfirmed.recoveryCodes[0], environment }, process.env)).verified, `${SUITE}_RECOVERY_CODE_REPLAYED`);

    stage = "recertification expiry recovery and offboarding";
    const certification = await prisma.accessCertification.findFirstOrThrow({ where: { userId: candidateId } });
    const certificationGrant = await stepUp("ACCESS_CERTIFICATION_DECIDE");
    await decideAccessCertification(prisma, approver.iam, { certificationKey: certification.publicKey, decision: "RETAIN", reason: "Synthetic periodic access review retained", stepUpToken: certificationGrant.stepUpToken, environment }, process.env);
    const candidateAssignment = await prisma.userRoleAssignment.findFirstOrThrow({ where: { userId: candidateId, status: "ACTIVE" } });
    const candidateSession = await prisma.authSession.create({ data: { userId: candidateId, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: active.credentialVersion, authorizationVersion: active.authorizationVersion, activeRoleAssignmentId: candidateAssignment.id, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "Synthetic candidate device", browserSummary: "Synthetic browser", networkEvidenceMasked: "loopback" } });
    const device = await prisma.offlineSyncDevice.create({ data: { userId: candidateId, label: "Synthetic device", platform: "WINDOWS", publicSigningKey: "synthetic-public-key", publicKeyHash: createHash("sha256").update("synthetic-public-key").digest("hex"), status: "ACTIVE", approvedAt: new Date(), approvedByUserId: approver.row.id } });
    const native = await prisma.nativeSession.create({ data: { userId: candidateId, deviceId: device.id, roleAssignmentId: candidateAssignment.id, accessTokenHash: createHash("sha256").update("access" + suffix).digest("hex"), refreshTokenHash: createHash("sha256").update("refresh" + suffix).digest("hex"), credentialVersion: active.credentialVersion, authorizationVersion: active.authorizationVersion, scopesJson: "[]", accessExpiresAt: new Date(Date.now() + 300_000), refreshExpiresAt: new Date(Date.now() + 86_400_000), absoluteExpiresAt: new Date(Date.now() + 86_400_000) } });
    const candidateActor = { user: { ...approver.iam.user, id: candidateId, name: active.name, username: active.username, email: active.email, designation: active.designation, role: "TEACHER" as const, roleAssignmentId: candidateAssignment.id, authorizationVersion: active.authorizationVersion, guardianId: active.guardianId }, sessionId: candidateSession.id };
    const recovery = await requestMfaRecovery(prisma, candidateActor, { userId: candidateId, factorType: "TOTP", reason: "Synthetic lost authenticator recovery rehearsal" });
    await reviewMfaRecovery(prisma, preparer.iam, { requestKey: recovery.requestKey, evidence: "Synthetic identity and device-loss review completed" });
    const recoveryGrant = await stepUp("MFA_RECOVERY_APPROVE");
    await approveMfaRecovery(prisma, approver.iam, { requestKey: recovery.requestKey, stepUpToken: recoveryGrant.stepUpToken, environment }, process.env);
    const recoveryDecision = await prisma.mfaRecoveryRequest.findUniqueOrThrow({ where: { publicKey: recovery.requestKey } });
    invariant(recoveryDecision.requestedByUserId === candidateId && recoveryDecision.reviewedByUserId === preparer.row.id && recoveryDecision.approvedByUserId === approver.row.id, `${SUITE}_RECOVERY_SEPARATION_FAILED`);
    invariant((await prisma.user.findUniqueOrThrow({ where: { id: candidateId } })).lifecycleStatus === "LOCKED", `${SUITE}_RECOVERY_DID_NOT_LOCK_ACCOUNT`);
    invariant((await prisma.nativeSession.findUniqueOrThrow({ where: { id: native.id } })).revokedAt && (await prisma.offlineSyncDevice.findUniqueOrThrow({ where: { id: device.id } })).revokedAt, `${SUITE}_RECOVERY_DEVICE_REVOCATION_FAILED`);

    const tempUser = await prisma.user.create({ data: { iamPublicKey: randomUUID(), name: "Synthetic Temporary Viewer", username: `temp.${suffix}`, passwordHash, role: "VIEWER", isActive: true, lifecycleStatus: "ACTIVE" } });
    await prisma.userRoleAssignment.create({ data: { userId: tempUser.id, role: "VIEWER", status: "ACTIVE", reason: "Synthetic expired temporary access", activeKey: `${tempUser.id}:VIEWER`, validFrom: new Date(Date.now() - 86_400_000), validUntil: new Date(Date.now() - 1_000) } });
    await prisma.authSession.create({ data: { userId: tempUser.id, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: tempUser.credentialVersion, authorizationVersion: tempUser.authorizationVersion, expiresAt: new Date(Date.now() + 86_400_000), deviceSummary: "Synthetic", browserSummary: "Synthetic", networkEvidenceMasked: "loopback" } });
    const expired = await expireTemporaryAccess(prisma);
    invariant(expired.affectedUsers >= 1 && await prisma.authSession.count({ where: { userId: tempUser.id, revokedAt: null } }) === 0, `${SUITE}_TEMPORARY_EXPIRY_FAILED`);

    const target = await prisma.user.create({ data: { iamPublicKey: randomUUID(), name: "Synthetic Offboard Target", username: `offboard.${suffix}`, passwordHash, role: "VIEWER", isActive: true, lifecycleStatus: "ACTIVE" } });
    await prisma.userRoleAssignment.create({ data: { userId: target.id, role: "VIEWER", status: "ACTIVE", reason: "Synthetic offboarding", activeKey: `${target.id}:VIEWER` } });
    const offboardGrant = await stepUp("USER_OFFBOARD");
    await offboardUser(prisma, approver.iam, { userHandle: target.iamPublicKey!, reason: "Synthetic employment separation rehearsal", stepUpToken: offboardGrant.stepUpToken, environment }, process.env);
    invariant(!(await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).isActive, `${SUITE}_OFFBOARDING_FAILED`);

    stage = "backup restore twice";
    await prisma.userInvitation.create({ data: { accessRequestId: request.id, userId: candidateId, tokenHash: createHash("sha256").update("unrecoverable" + suffix).digest("hex"), environment, roleSnapshotHash: createHash("sha256").update("roles" + suffix).digest("hex"), credentialVersion: active.credentialVersion, expiresAt: new Date(Date.now() + 86_400_000), issuedByUserId: approver.row.id } });
    const backup = await loadRealUserAccessBackup(prisma);
    const serialized = JSON.stringify(backup);
    invariant(!/(provisioningUri|challengeToken|activationToken|oneTimeToken|privateKey)/i.test(serialized) && !candidateConfirmed.recoveryCodes.some((code) => serialized.includes(code)) && !serialized.includes(oneTimeToken), `${SUITE}_PLAINTEXT_SECRET_EXPORTED`);
    const userIds = new Set<string>(), studentIds = new Set<string>(), guardianIds = new Set<string>(), staffIds = new Set<string>();
    for (const row of backup.accessRequests) { for (const key of ["candidateUserId", "requestedByUserId", "reviewedByUserId", "approvedByUserId", "rejectedByUserId"]) if (typeof row[key] === "string") userIds.add(row[key] as string); if (typeof row.studentId === "string") studentIds.add(row.studentId); if (typeof row.guardianId === "string") guardianIds.add(row.guardianId); if (typeof row.staffMemberId === "string") staffIds.add(row.staffMemberId); }
    for (const [key, fields] of [["invitations", ["userId", "issuedByUserId"]], ["mfaAuthenticators", ["userId", "revokedByUserId"]], ["mfaRecoveryCodes", ["userId"]], ["trainingAcknowledgements", ["userId", "waiverApprovedByUserId"]], ["policyAcknowledgements", ["userId"]], ["accessCertifications", ["userId", "reviewerUserId"]], ["mfaRecoveryRequests", ["userId", "requestedByUserId", "reviewedByUserId", "approvedByUserId"]]] as const) for (const row of backup[key]) for (const field of fields) if (typeof row[field] === "string") userIds.add(row[field] as string);
    const validated = validateRealUserAccessBackup(backup, { userIds, studentIds, guardianIds, staffMemberIds: staffIds });
    const users = await prisma.user.findMany({ where: { id: { in: [...userIds] } } });
    for (const row of users) await restore.user.create({ data: { id: row.id, iamPublicKey: row.iamPublicKey, name: row.name, username: row.username, email: row.email, passwordHash, role: row.role, isActive: row.isActive, lifecycleStatus: row.lifecycleStatus, designation: row.designation } });
    for (const id of staffIds) { const row = await prisma.staffMember.findUniqueOrThrow({ where: { id } }); await restore.staffMember.create({ data: { id: row.id, iamPublicKey: row.iamPublicKey, staffCode: row.staffCode, fullName: row.fullName, designation: row.designation, status: row.status, userId: row.userId } }); }
    const restoreResult = { authSecurity: resultBucket(), warnings: [] as string[] };
    const same = <T extends string>(ids: Iterable<T>) => new Map([...ids].map((id) => [id, id]));
    await restoreRealUserAccessBackup(restore, validated, { users: same(userIds), students: same(studentIds), guardians: same(guardianIds), staff: same(staffIds) }, restoreResult);
    invariant(restoreResult.authSecurity.errors.length === 0, `${SUITE}_RESTORE_ERRORS:${JSON.stringify(restoreResult.authSecurity.errors)}`);
    const firstCreated = restoreResult.authSecurity.created;
    await restoreRealUserAccessBackup(restore, validated, { users: same(userIds), students: same(studentIds), guardians: same(guardianIds), staff: same(staffIds) }, restoreResult);
    invariant(firstCreated > 0 && restoreResult.authSecurity.skipped >= firstCreated, `${SUITE}_RESTORE_NOT_IDEMPOTENT`);
    invariant(await restore.userInvitation.count({ where: { status: "REVOKED", revocationReason: "RESTORED_WITHOUT_SECRET" } }) >= 1, `${SUITE}_RESTORED_INVITATION_NOT_REVOKED`);
    invariant(await restore.mfaRecoveryCode.count({ where: { status: "USED" } }) >= 1 && await restore.mfaAuthenticator.count({ where: { status: "REVOKED" } }) >= 1, `${SUITE}_RESTORE_STATE_NOT_PRESERVED`);

    const after = identity(operational);
    invariant(JSON.stringify(before) === JSON.stringify(after), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    invariant(!["-journal", "-wal", "-shm"].some((tail) => existsSync(`${operational}${tail}`)), `${SUITE}_OPERATIONAL_SIDECAR_CREATED`);
    process.stdout.write(`${JSON.stringify({ suite: SUITE, result: "PASSED", operationalDatabase: { path: operational, provenance: ciSyntheticBaseline ? "CI_SYNTHETIC_PRE_MIGRATION_BASELINE" : "LOCAL_OPERATIONAL_READ_ONLY", before, after, byteIdentical: true }, migrations: { fresh: true, copied: true, repeatNoPending: true, restoreFresh: true }, workflow: { requesterReviewerApproverSeparated: true, localInvitationOnly: true, fragmentToken: true, oneTimeInvitation: true, activationAtomic: true }, authentication: { totp: true, recoveryCodeReplayRefused: true, loginChallengeReplayRefused: true, passkeyPolicyCoveredByUnitTests: true }, governance: { recertification: true, temporaryExpiry: true, mfaRecoveryLock: true, offboarding: true, nativeAndOfflineRevocation: true }, backupRestore: { durableRows: firstCreated, twice: true, transientSecretsExcluded: true, unusedInvitationsRevoked: true } }, null, 2)}\n`);
  } finally { await prisma.$disconnect(); await restore.$disconnect(); }
}

main().catch((error) => {
  const after = existsSync(operational) ? identity(operational) : null;
  process.stderr.write(`${JSON.stringify({ suite: SUITE, result: "FAILED", stage, error: error instanceof Error ? error.message : String(error), operationalDatabase: { path: operational, after } }, null, 2)}\n`);
  process.exitCode = 1;
}).finally(() => cleanup());
