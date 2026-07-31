import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { beginAliasVerification, removeLoginAlias, verifyLoginAlias } from "../lib/auth-aliases";
import { configuredAuthDeliveryAdapter } from "../lib/auth-delivery";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import { authHashSecret, createPasswordResetToken } from "../lib/auth-security";
import { maskAlias, normalizeAliasValue, resolveLoginIdentifier } from "../lib/auth-identifiers";
import { consumePasswordReset, requestPasswordReset } from "../lib/auth-recovery";
import { createPersistedSession, resolvePersistedSession, revokeSessions } from "../lib/auth-sessions";
import { hashPassword, verifyPassword } from "../lib/password";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const TMP_ROOT = path.join(WORKSPACE, "tmp", "auth2bqa");
const ROOT = path.join(TMP_ROOT, `AUTH2BQA-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "auth2bqa.db");
const MAILBOX = path.join(ROOT, "delivery", "sink.json");
const ORIGINAL_CREDENTIAL = ["AUTH2BQA", "Original", "Password", "2026!"].join("-");

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }
function mailbox<T>() { return JSON.parse(readFileSync(MAILBOX, "utf8")) as T; }
function resetToken() {
  const resetPath = mailbox<{ resetPath: string }>().resetPath;
  invariant(resetPath.startsWith("/reset-password#token="), "AUTH2BQA_RESET_TOKEN_URL_LEAK");
  return new URLSearchParams(resetPath.split("#", 2)[1]).get("token") ?? "";
}

async function createUser(client: PrismaClient, username: string, role: string, isActive = true) {
  const normalized = normalizeAliasValue("USERNAME", username);
  const user = await client.user.create({ data: {
    name: `AUTH2BQA ${role}`,
    username: normalized,
    passwordHash: await hashPassword(ORIGINAL_CREDENTIAL),
    role,
    isActive
  } });
  await client.authLoginAlias.create({ data: {
    id: randomUUID(), userId: user.id, type: "USERNAME", normalizedValue: normalized,
    displayMasked: normalized, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date()
  } });
  return user;
}

async function addVerifiedAlias(client: PrismaClient, userId: string, type: "WORK_EMAIL" | "PERSONAL_EMAIL" | "MOBILE", value: string) {
  const normalizedValue = normalizeAliasValue(type, value);
  return client.authLoginAlias.create({ data: {
    userId, type, normalizedValue, displayMasked: maskAlias(type, normalizedValue),
    status: "VERIFIED", verifiedAt: new Date()
  } });
}

async function main() {
  const operationalBefore = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
  mkdirSync(ROOT, { recursive: true });
  copyFileSync(OPERATIONAL_DATABASE, DATABASE);
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
    DATABASE_URL: databaseUrl(DATABASE),
    AUTH_SECRET: randomBytes(48).toString("base64url"),
    AUTH_VERIFICATION_SECRET: randomBytes(48).toString("base64url"),
    SESSION_COOKIE_SECURE: "false",
    AUTH2B_DELIVERY_ADAPTER: "LOCAL_TEST_SINK",
    AUTH2B_COPIED_DATABASE_ROOT: ROOT,
    AUTH2B_LOCAL_DELIVERY_MAILBOX: MAILBOX,
    TRUST_PROXY_HEADERS: "true",
    NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized"
  };
  Object.assign(process.env, environment);
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], {
    cwd: WORKSPACE, env: environment, stdio: "pipe"
  });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const superAdmin = await createUser(client, `auth2bqa-super-${randomUUID().slice(0, 8)}`, "SUPER_ADMIN");
    const teacher = await createUser(client, `auth2bqa-teacher-${randomUUID().slice(0, 8)}`, "TEACHER");
    const parent = await createUser(client, `auth2bqa-parent-${randomUUID().slice(0, 8)}`, "PARENT");
    const disabled = await createUser(client, `auth2bqa-disabled-${randomUUID().slice(0, 8)}`, "VIEWER", false);
    const ambiguous = await createUser(client, "auth2bqa-ambiguous", "VIEWER");
    const lastAliasUser = await createUser(client, `auth2bqa-last-${randomUUID().slice(0, 8)}`, "VIEWER");

    const duplicateContact = `duplicate.${randomUUID().slice(0, 8)}@example.invalid`;
    await client.staffMember.create({ data: {
      staffCode: `A2Q-${randomUUID().slice(0, 6)}`, fullName: "AUTH2BQA Teacher", designation: "Teacher",
      email: duplicateContact, mobile: "+919870000001", userId: teacher.id
    } });
    const guardian = await client.guardian.create({ data: {
      displayName: "AUTH2BQA Parent", primaryMobile: "+919870000002", email: duplicateContact
    } });
    await client.user.update({ where: { id: parent.id }, data: { guardianId: guardian.id } });
    const student = await client.student.create({ data: {
      admissionNo: "AUTH2BQA-ADM-001", studentName: "AUTH2BQA Student", fatherName: "AUTH2BQA Parent",
      className: "I", phone1: "+919870000002"
    } });
    await client.studentGuardian.create({ data: { guardianId: guardian.id, studentId: student.id, isPrimaryContact: true } });
    invariant(await client.authLoginAlias.count({ where: { normalizedValue: duplicateContact } }) === 0, "AUTH2BQA_CONTACT_AUTO_PROMOTED");

    const work = await addVerifiedAlias(client, superAdmin.id, "WORK_EMAIL", `work.${randomUUID().slice(0, 8)}@example.invalid`);
    const personal = await addVerifiedAlias(client, superAdmin.id, "PERSONAL_EMAIL", `personal.${randomUUID().slice(0, 8)}@example.invalid`);
    const mobile = await addVerifiedAlias(client, superAdmin.id, "MOBILE", "+919870000003");
    const disabledWork = await addVerifiedAlias(client, disabled.id, "WORK_EMAIL", `disabled.${randomUUID().slice(0, 8)}@example.invalid`);
    const pending = await client.authLoginAlias.create({ data: {
      userId: teacher.id, type: "WORK_EMAIL", normalizedValue: `pending.${randomUUID().slice(0, 8)}@example.invalid`,
      displayMasked: "pe•••@e•••.invalid", status: "PENDING"
    } });
    await client.authLoginAlias.create({ data: {
      userId: parent.id, type: "ADMISSION_NUMBER", normalizedValue: student.admissionNo,
      displayMasked: student.admissionNo, status: "VERIFIED", isSchoolGoverned: true,
      admissionStudentId: student.id, verifiedAt: new Date()
    } });
    const ambiguousStudent = await client.student.create({ data: {
      admissionNo: "AUTH2BQA-AMBIGUOUS", studentName: "AUTH2BQA Ambiguous", fatherName: "Synthetic",
      className: "I", phone1: "0000000000"
    } });
    await client.authLoginAlias.create({ data: {
      userId: parent.id, type: "ADMISSION_NUMBER", normalizedValue: ambiguousStudent.admissionNo,
      displayMasked: ambiguousStudent.admissionNo, status: "VERIFIED", isSchoolGoverned: true,
      admissionStudentId: ambiguousStudent.id, verifiedAt: new Date()
    } });

    for (const identifier of [superAdmin.username.toUpperCase(), `  ${work.normalizedValue.toUpperCase()}  `, personal.normalizedValue.toUpperCase(), "+91 98700-00003", ` ${student.admissionNo.toLowerCase()} `]) {
      const resolved = await resolveLoginIdentifier(client, identifier);
      invariant(resolved.kind === "resolved", `AUTH2BQA_LOGIN_NORMALIZATION_FAILED:${identifier}`);
    }
    invariant((await resolveLoginIdentifier(client, pending.normalizedValue)).kind === "missing", "AUTH2BQA_UNVERIFIED_ALIAS_AUTHENTICATED");
    invariant((await resolveLoginIdentifier(client, "auth2bqa-ambiguous")).kind === "ambiguous", "AUTH2BQA_AMBIGUOUS_ALIAS_NOT_REFUSED");
    invariant((await resolveLoginIdentifier(client, disabledWork.normalizedValue)).kind === "resolved", "AUTH2BQA_DISABLED_FIXTURE_INVALID");

    let takeoverRefused = false;
    try { await addVerifiedAlias(client, teacher.id, "WORK_EMAIL", work.normalizedValue); } catch { takeoverRefused = true; }
    invariant(takeoverRefused, "AUTH2BQA_CROSS_USER_ALIAS_TAKEOVER_ALLOWED");

    const adapter = configuredAuthDeliveryAdapter(environment);
    const expiredStart = new Date(Date.now() - 11 * 60_000);
    const expiredVerification = await beginAliasVerification(client, { userId: teacher.id, type: "PERSONAL_EMAIL", value: `expired.${randomUUID().slice(0, 8)}@example.invalid` }, adapter, expiredStart);
    const expiredCode = mailbox<{ code: string }>().code;
    let expiredVerificationRefused = false;
    try { await verifyLoginAlias(client, { userId: teacher.id, aliasId: expiredVerification.aliasId, expectedVersion: expiredVerification.aliasVersion, code: expiredCode }); } catch { expiredVerificationRefused = true; }
    invariant(expiredVerificationRefused, "AUTH2BQA_EXPIRED_VERIFICATION_ACCEPTED");

    const limited = await beginAliasVerification(client, { userId: teacher.id, type: "PERSONAL_EMAIL", value: `limited.${randomUUID().slice(0, 8)}@example.invalid` }, adapter);
    const limitedCode = mailbox<{ code: string }>().code;
    const wrongCode = limitedCode === "000000" ? "000001" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try { await verifyLoginAlias(client, { userId: teacher.id, aliasId: limited.aliasId, expectedVersion: limited.aliasVersion, code: wrongCode }); } catch {}
    }
    const limitedRow = await client.authVerificationChallenge.findFirstOrThrow({ where: { aliasId: limited.aliasId }, orderBy: { createdAt: "desc" } });
    invariant(limitedRow.attempts === 5 && Boolean(limitedRow.invalidatedAt), "AUTH2BQA_VERIFICATION_ATTEMPT_LIMIT_FAILED");

    const verified = await beginAliasVerification(client, { userId: teacher.id, type: "WORK_EMAIL", value: `verified.${randomUUID().slice(0, 8)}@example.invalid` }, adapter);
    await verifyLoginAlias(client, { userId: teacher.id, aliasId: verified.aliasId, expectedVersion: verified.aliasVersion, code: mailbox<{ code: string }>().code });
    const verifiedRow = await client.authLoginAlias.findUniqueOrThrow({ where: { id: verified.aliasId } });
    await removeLoginAlias(client, { userId: teacher.id, aliasId: verifiedRow.id, expectedVersion: verifiedRow.version });
    invariant((await client.authLoginAlias.findUniqueOrThrow({ where: { id: verifiedRow.id } })).status === "REMOVED", "AUTH2BQA_ALIAS_HISTORY_NOT_RETAINED");

    const lastUsername = await client.authLoginAlias.findFirstOrThrow({ where: { userId: lastAliasUser.id, type: "USERNAME" } });
    await client.authLoginAlias.update({ where: { id: lastUsername.id }, data: { status: "REMOVED", removedAt: new Date() } });
    const lastEmail = await addVerifiedAlias(client, lastAliasUser.id, "PERSONAL_EMAIL", `last.${randomUUID().slice(0, 8)}@example.invalid`);
    let lastRemovalRefused = false;
    try { await removeLoginAlias(client, { userId: lastAliasUser.id, aliasId: lastEmail.id, expectedVersion: lastEmail.version }); } catch { lastRemovalRefused = true; }
    invariant(lastRemovalRefused, "AUTH2BQA_LAST_USABLE_ALIAS_REMOVED");
    let governedRemovalRefused = false;
    try {
      const usernameAlias = await client.authLoginAlias.findFirstOrThrow({ where: { userId: superAdmin.id, type: "USERNAME", status: "VERIFIED" } });
      await removeLoginAlias(client, { userId: superAdmin.id, aliasId: usernameAlias.id, expectedVersion: usernameAlias.version });
    } catch { governedRemovalRefused = true; }
    invariant(governedRemovalRefused, "AUTH2BQA_GOVERNED_ALIAS_REMOVED");

    const headers = new Headers({ "user-agent": "Mozilla/5.0 Chrome/126.0", "x-forwarded-for": "203.0.113.42" });
    const sessionOne = await createPersistedSession(client, superAdmin, headers);
    const firstSeen = (await client.authSession.findUniqueOrThrow({ where: { id: sessionOne.sessionId } })).lastSeenAt;
    invariant(Boolean(await resolvePersistedSession(client, sessionOne.cookieValue, new Date(firstSeen.getTime() + 60_000))), "AUTH2BQA_CURRENT_SESSION_DENIED");
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: sessionOne.sessionId } })).lastSeenAt.getTime() === firstSeen.getTime(), "AUTH2BQA_LAST_SEEN_WRITE_AMPLIFICATION");
    await resolvePersistedSession(client, sessionOne.cookieValue, new Date(firstSeen.getTime() + 6 * 60_000));
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: sessionOne.sessionId } })).lastSeenAt.getTime() > firstSeen.getTime(), "AUTH2BQA_LAST_SEEN_BOUND_NOT_UPDATED");
    const tamperedCookie = `${sessionOne.cookieValue.slice(0, -1)}x`;
    invariant(!await resolvePersistedSession(client, tamperedCookie), "AUTH2BQA_TAMPERED_SESSION_ACCEPTED");
    const expiredSession = await createPersistedSession(client, superAdmin, headers, new Date(Date.now() - 31 * 24 * 60 * 60_000));
    invariant(!await resolvePersistedSession(client, expiredSession.cookieValue), "AUTH2BQA_EXPIRED_SESSION_ACCEPTED");
    const sessionTwo = await createPersistedSession(client, superAdmin, new Headers({ "user-agent": "Mozilla/5.0 Mobile Safari/605.1", "x-forwarded-for": "2001:db8:abcd:12::7" }));
    await revokeSessions(client, { userId: superAdmin.id, sessionId: sessionTwo.sessionId, reason: "AUTH2BQA_REVOKE_ONE" });
    invariant(!await resolvePersistedSession(client, sessionTwo.cookieValue), "AUTH2BQA_REVOKED_SESSION_ACCEPTED");
    const sessionThree = await createPersistedSession(client, superAdmin, headers);
    const sessionFour = await createPersistedSession(client, superAdmin, headers);
    await revokeSessions(client, { userId: superAdmin.id, excludeSessionId: sessionThree.sessionId, reason: "AUTH2BQA_REVOKE_OTHERS" });
    invariant(Boolean(await resolvePersistedSession(client, sessionThree.cookieValue)) && !await resolvePersistedSession(client, sessionFour.cookieValue), "AUTH2BQA_REVOKE_OTHERS_FAILED");
    const sessionFive = await createPersistedSession(client, superAdmin, headers);
    await Promise.all([revokeSessions(client, { userId: superAdmin.id, sessionId: sessionFive.sessionId, reason: "AUTH2BQA_CONCURRENT_REVOKE" }), resolvePersistedSession(client, sessionFive.cookieValue)]);
    invariant(!await resolvePersistedSession(client, sessionFive.cookieValue), "AUTH2BQA_CONCURRENT_REVOKE_LOST");
    const maskedSessions = await client.authSession.findMany({ where: { userId: superAdmin.id } });
    invariant(maskedSessions.every((row) => !/\d+\.\d+\.\d+\.\d+$/.test(row.networkEvidenceMasked)), "AUTH2BQA_EXACT_IP_STORED");

    const disabledResetBefore = await client.authPasswordResetToken.count({ where: { userId: disabled.id } });
    await requestPasswordReset(client, { identifier: disabled.username, channelType: "WORK_EMAIL" }, adapter);
    invariant(await client.authPasswordResetToken.count({ where: { userId: disabled.id } }) === disabledResetBefore, "AUTH2BQA_DISABLED_ACCOUNT_RECOVERY_CREATED");

    const rollbackSession = await createPersistedSession(client, superAdmin, headers);
    await requestPasswordReset(client, { identifier: superAdmin.username, channelType: "PERSONAL_EMAIL" }, adapter);
    const rollbackToken = resetToken();
    const rollbackRow = await client.authPasswordResetToken.findFirstOrThrow({ where: { userId: superAdmin.id, invalidatedAt: null }, orderBy: { createdAt: "desc" } });
    invariant(rollbackRow.tokenHash !== rollbackToken, "AUTH2BQA_RAW_RESET_TOKEN_STORED");
    const beforeRollback = await client.user.findUniqueOrThrow({ where: { id: superAdmin.id } });
    await client.$executeRawUnsafe(`CREATE TRIGGER "AUTH2BQA_force_reset_failure" BEFORE INSERT ON "AuthSecurityEvent" WHEN NEW."eventType" = 'PASSWORD_RESET_COMPLETED' BEGIN SELECT RAISE(ABORT, 'AUTH2BQA_FORCED_FAILURE'); END`);
    let forcedFailure = false;
    const rollbackCredential = ["AUTH2BQA", "Rollback", "New", "Password!"].join("-");
    try { await consumePasswordReset(client, { token: rollbackToken, newPassword: rollbackCredential, confirmPassword: rollbackCredential }); } catch { forcedFailure = true; }
    await client.$executeRawUnsafe(`DROP TRIGGER "AUTH2BQA_force_reset_failure"`);
    const afterRollback = await client.user.findUniqueOrThrow({ where: { id: superAdmin.id } });
    invariant(forcedFailure && afterRollback.passwordHash === beforeRollback.passwordHash && afterRollback.credentialVersion === beforeRollback.credentialVersion, "AUTH2BQA_FORCED_FAILURE_DID_NOT_ROLL_BACK_PASSWORD");
    invariant(!(await client.authPasswordResetToken.findUniqueOrThrow({ where: { id: rollbackRow.id } })).usedAt, "AUTH2BQA_FORCED_FAILURE_CONSUMED_TOKEN");
    invariant(!(await client.authSession.findUniqueOrThrow({ where: { id: rollbackSession.sessionId } })).revokedAt, "AUTH2BQA_FORCED_FAILURE_REVOKED_SESSION");

    const expiredAt = new Date(Date.now() - 20 * 60_000);
    await requestPasswordReset(client, { identifier: superAdmin.username, channelType: "PERSONAL_EMAIL" }, adapter, expiredAt);
    const expiredResetToken = resetToken();
    let expiredResetRefused = false;
    const expiredCredential = ["AUTH2BQA", "Expired", "New", "Password!"].join("-");
    try { await consumePasswordReset(client, { token: expiredResetToken, newPassword: expiredCredential, confirmPassword: expiredCredential }); } catch { expiredResetRefused = true; }
    invariant(expiredResetRefused, "AUTH2BQA_EXPIRED_RESET_ACCEPTED");

    const attemptToken = createPasswordResetToken();
    const attemptRow = await client.authPasswordResetToken.create({ data: {
      userId: superAdmin.id, aliasId: personal.id, channelType: "PERSONAL_EMAIL", tokenHash: authHashSecret(attemptToken, "password-reset"),
      credentialVersion: superAdmin.credentialVersion + 10, expiresAt: new Date(Date.now() + 10 * 60_000)
    } });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const attemptCredential = ["AUTH2BQA", "Attempt", "New", "Password!"].join("-");
      try { await consumePasswordReset(client, { token: attemptToken, newPassword: attemptCredential, confirmPassword: attemptCredential }); } catch {}
    }
    const limitedReset = await client.authPasswordResetToken.findUniqueOrThrow({ where: { id: attemptRow.id } });
    invariant(limitedReset.attempts === 5 && limitedReset.invalidationReason === "ATTEMPT_LIMIT", "AUTH2BQA_RESET_ATTEMPT_LIMIT_FAILED");

    await requestPasswordReset(client, { identifier: superAdmin.username, channelType: "PERSONAL_EMAIL" }, adapter, new Date(Date.now() + 16 * 60_000));
    const finalToken = resetToken();
    let mismatchRefused = false;
    const mismatchCredential = ["AUTH2BQA", "Mismatch", "New", "Password!"].join("-");
    const otherCredential = ["AUTH2BQA", "Other", "New", "Password!"].join("-");
    try { await consumePasswordReset(client, { token: finalToken, newPassword: mismatchCredential, confirmPassword: otherCredential }); } catch { mismatchRefused = true; }
    let weakRefused = false;
    try { await consumePasswordReset(client, { token: finalToken, newPassword: "short", confirmPassword: "short" }); } catch { weakRefused = true; }
    let oldRefused = false;
    try { await consumePasswordReset(client, { token: finalToken, newPassword: ORIGINAL_CREDENTIAL, confirmPassword: ORIGINAL_CREDENTIAL }); } catch { oldRefused = true; }
    invariant(mismatchRefused && weakRefused && oldRefused, "AUTH2BQA_PASSWORD_POLICY_BYPASSED");
    const priorA = await createPersistedSession(client, superAdmin, headers);
    const priorB = await createPersistedSession(client, superAdmin, headers);
    const replacementCredential = `AUTH2BQA-New-${randomBytes(16).toString("hex")}!`;
    const concurrent = await Promise.allSettled([
      consumePasswordReset(client, { token: finalToken, newPassword: replacementCredential, confirmPassword: replacementCredential }),
      consumePasswordReset(client, { token: finalToken, newPassword: replacementCredential, confirmPassword: replacementCredential })
    ]);
    invariant(concurrent.filter((row) => row.status === "fulfilled").length === 1, "AUTH2BQA_CONCURRENT_RESET_NOT_SINGLE_USE");
    const resetUser = await client.user.findUniqueOrThrow({ where: { id: superAdmin.id } });
    invariant(!await verifyPassword(ORIGINAL_CREDENTIAL, resetUser.passwordHash) && await verifyPassword(replacementCredential, resetUser.passwordHash), "AUTH2BQA_PASSWORD_TRANSITION_FAILED");
    invariant(await client.authSession.count({ where: { id: { in: [priorA.sessionId, priorB.sessionId] }, revokedAt: { not: null } } }) === 2, "AUTH2BQA_RESET_DID_NOT_REVOKE_ALL_SESSIONS");

    const backup = await generateFullBackup(client, { generatedBy: "AUTH2BQA copied-database rehearsal", generatedAt: new Date() });
    const serialized = serializeBackup(backup);
    invariant(!/(?:codeHash|tokenHash|AUTH2BQA-New-|AUTH2BQA-Original-Password)/.test(serialized), "AUTH2BQA_BACKUP_CONTAINS_CREDENTIAL_MATERIAL");
    const validated = parseAndValidateBackup(serialized);
    const originalCounts = {
      aliases: await client.authLoginAlias.count(), verification: await client.authVerificationChallenge.count(),
      resets: await client.authPasswordResetToken.count(), sessions: await client.authSession.count(), events: await client.authSecurityEvent.count()
    };
    const originalHashes = new Set([
      ...(await client.authVerificationChallenge.findMany({ select: { codeHash: true } })).map((row) => row.codeHash),
      ...(await client.authPasswordResetToken.findMany({ select: { tokenHash: true } })).map((row) => row.tokenHash),
      ...(await client.authSession.findMany({ select: { tokenHash: true } })).map((row) => row.tokenHash)
    ]);
    await client.$transaction([
      client.authVerificationChallenge.deleteMany(), client.authPasswordResetToken.deleteMany(), client.authSession.deleteMany(),
      client.authSecurityEvent.deleteMany(), client.authLoginAlias.deleteMany()
    ]);
    const firstRestore = await restoreValidatedBackup(client, validated, { id: superAdmin.id, name: "AUTH2BQA Restore Actor" });
    invariant(firstRestore.authSecurity.errors.length === 0, "AUTH2BQA_FIRST_AUTH_RESTORE_ERRORS");
    const restoredCounts = {
      aliases: await client.authLoginAlias.count(), verification: await client.authVerificationChallenge.count(),
      resets: await client.authPasswordResetToken.count(), sessions: await client.authSession.count(), events: await client.authSecurityEvent.count()
    };
    invariant(JSON.stringify(restoredCounts) === JSON.stringify(originalCounts), "AUTH2BQA_AUTH_BACKUP_COUNTS_NOT_PRESERVED");
    invariant(await client.authSession.count({ where: { revokedAt: null } }) === 0, "AUTH2BQA_RESTORE_REVIVED_SESSION");
    const restoredHashes = [
      ...(await client.authVerificationChallenge.findMany({ select: { codeHash: true } })).map((row) => row.codeHash),
      ...(await client.authPasswordResetToken.findMany({ select: { tokenHash: true } })).map((row) => row.tokenHash),
      ...(await client.authSession.findMany({ select: { tokenHash: true } })).map((row) => row.tokenHash)
    ];
    invariant(restoredHashes.every((hash) => !originalHashes.has(hash)), "AUTH2BQA_RESTORE_REUSED_CREDENTIAL_HASH");
    const secondRestore = await restoreValidatedBackup(client, validated, { id: superAdmin.id, name: "AUTH2BQA Restore Actor" });
    invariant(secondRestore.authSecurity.errors.length === 0, "AUTH2BQA_SECOND_AUTH_RESTORE_ERRORS");
    invariant(await client.authLoginAlias.count() === originalCounts.aliases && await client.authSession.count() === originalCounts.sessions, "AUTH2BQA_SECOND_RESTORE_NOT_IDEMPOTENT");
    invariant(await client.authSecurityEvent.count({ where: { eventType: "LOGIN_ALIAS_REMOVED" } }) >= 1, "AUTH2BQA_APPEND_ONLY_AUDIT_MISSING");

    console.log(JSON.stringify({
      result: "AUTH2BQA_INDEPENDENT_MATRIX_PASSED",
      roles: ["SUPER_ADMIN", "TEACHER", "PARENT", "STUDENT_LINKED", "DISABLED"],
      aliasTypes: 5,
      ambiguousRefused: true,
      verificationAttemptLimited: true,
      resetSingleUse: true,
      forcedRollback: true,
      sessionRevocation: true,
      backupRestores: 2
    }));
  } finally {
    await client.$disconnect();
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    invariant(JSON.stringify(operationalAfter) === JSON.stringify(operationalBefore), "AUTH2BQA_OPERATIONAL_DATABASE_CHANGED");
    cleanup();
    cleanup();
    invariant(!existsSync(ROOT), "AUTH2BQA_CLEANUP_INCOMPLETE");
  }
}

function cleanup() {
  const resolved = path.resolve(ROOT);
  invariant(resolved.startsWith(`${path.resolve(TMP_ROOT)}${path.sep}`), "AUTH2BQA_CLEANUP_SCOPE_REFUSED");
  if (existsSync(resolved)) rmSync(resolved, { recursive: true, force: true });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : "AUTH2BQA_INDEPENDENT_MATRIX_FAILED");
  process.exitCode = 1;
});
