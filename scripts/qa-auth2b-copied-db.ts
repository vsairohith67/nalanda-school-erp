import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { beginAliasVerification, removeLoginAlias, verifyLoginAlias } from "../lib/auth-aliases";
import { configuredAuthDeliveryAdapter } from "../lib/auth-delivery";
import { maskAlias, normalizeAliasValue, resolveLoginIdentifier } from "../lib/auth-identifiers";
import { consumePasswordReset, requestPasswordReset } from "../lib/auth-recovery";
import { createPersistedSession, resolvePersistedSession } from "../lib/auth-sessions";
import { hashPassword, verifyPassword } from "../lib/password";
import { fileSha256 } from "./migration-check-utils";

const WORKSPACE = path.resolve(".");
const OPERATIONAL_DATABASE = path.join(WORKSPACE, "prisma", "dev.db");
const TMP_ROOT = path.join(WORKSPACE, "tmp", "auth2b");
const ROOT = path.join(TMP_ROOT, `AUTH2B-${process.pid}-${randomUUID()}`);
const DATABASE = path.join(ROOT, "auth2b-qa.db");
const MAILBOX = path.join(ROOT, "delivery", "mailbox.json");

function invariant(value: unknown, code: string): asserts value {
  if (!value) throw new Error(code);
}

function databaseUrl(file: string) { return `file:${file.replaceAll("\\", "/")}`; }

async function createUser(client: PrismaClient, input: { username: string; role?: string; isActive?: boolean }) {
  const username = normalizeAliasValue("USERNAME", input.username);
  const user = await client.user.create({ data: {
    name: `AUTH2B ${username}`,
    username,
    passwordHash: await hashPassword(`AUTH2B-${username}-${randomBytes(12).toString("hex")}!`),
    role: input.role ?? "VIEWER",
    isActive: input.isActive ?? true
  } });
  await client.authLoginAlias.create({ data: {
    id: `auth2b_username_${user.id}`, userId: user.id, type: "USERNAME", normalizedValue: username,
    displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date()
  } });
  return user;
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
    SESSION_COOKIE_SECURE: "false",
    AUTH2B_DELIVERY_ADAPTER: "LOCAL_TEST_SINK",
    AUTH2B_COPIED_DATABASE_ROOT: ROOT,
    AUTH2B_LOCAL_DELIVERY_MAILBOX: MAILBOX,
    TRUST_PROXY_HEADERS: "true",
    NALANDA_TRUSTED_PROXY_MODE: "single-hop-sanitized"
  };
  Object.assign(process.env, environment);
  execFileSync(process.env.ComSpec || "C:\\Windows\\System32\\cmd.exe", ["/d", "/s", "/c", "pnpm.cmd exec prisma migrate deploy --schema prisma/schema.prisma"], {
    cwd: WORKSPACE,
    env: environment,
    stdio: "pipe"
  });
  const client = new PrismaClient({ datasourceUrl: databaseUrl(DATABASE) });
  try {
    const migratedUsernames = await client.authLoginAlias.count({ where: { type: "USERNAME", status: "VERIFIED" } });
    invariant(migratedUsernames === 4, "AUTH2B_EXISTING_USERNAME_BACKFILL_FAILED");
    const enabled = await createUser(client, { username: "auth2b-enabled", role: "PARENT" });
    const disabled = await createUser(client, { username: "auth2b-disabled", isActive: false });
    const work = normalizeAliasValue("WORK_EMAIL", "enabled.work@example.invalid");
    const personal = normalizeAliasValue("PERSONAL_EMAIL", "enabled.personal@example.invalid");
    const mobile = normalizeAliasValue("MOBILE", "+919876500001");
    for (const [type, normalizedValue] of [["WORK_EMAIL", work], ["PERSONAL_EMAIL", personal], ["MOBILE", mobile]] as const) {
      await client.authLoginAlias.create({ data: { userId: enabled.id, type, normalizedValue, displayMasked: maskAlias(type, normalizedValue), status: "VERIFIED", verifiedAt: new Date() } });
    }
    const pending = await client.authLoginAlias.create({ data: { userId: enabled.id, type: "PERSONAL_EMAIL", normalizedValue: "pending@example.invalid", displayMasked: "pe•••@e•••.invalid" } });
    invariant((await resolveLoginIdentifier(client, work)).kind === "resolved", "AUTH2B_VERIFIED_WORK_ALIAS_NOT_RESOLVED");
    invariant((await resolveLoginIdentifier(client, "pending@example.invalid")).kind === "missing", "AUTH2B_UNVERIFIED_ALIAS_RESOLVED");
    const disabledResolution = await resolveLoginIdentifier(client, disabled.username);
    invariant(disabledResolution.kind === "resolved" && !disabledResolution.user.isActive, "AUTH2B_DISABLED_FIXTURE_INVALID");

    const student = await client.student.create({ data: { admissionNo: "AUTH2B-ADM-001", studentName: "AUTH2B Synthetic Student", fatherName: "Synthetic", className: "I", phone1: "0000000000" } });
    await client.authLoginAlias.create({ data: { userId: enabled.id, type: "ADMISSION_NUMBER", normalizedValue: student.admissionNo, displayMasked: student.admissionNo, status: "VERIFIED", isSchoolGoverned: true, admissionStudentId: student.id, verifiedAt: new Date() } });
    invariant((await resolveLoginIdentifier(client, student.admissionNo)).kind === "resolved", "AUTH2B_ADMISSION_ALIAS_NOT_RESOLVED");
    let duplicateRefused = false;
    try {
      await client.authLoginAlias.create({ data: { userId: disabled.id, type: "WORK_EMAIL", normalizedValue: work, displayMasked: "duplicate", status: "VERIFIED", verifiedAt: new Date() } });
    } catch { duplicateRefused = true; }
    invariant(duplicateRefused, "AUTH2B_DUPLICATE_ALIAS_ACCEPTED");

    const adapter = configuredAuthDeliveryAdapter(environment);
    const limited = await beginAliasVerification(client, { userId: enabled.id, type: "WORK_EMAIL", value: "limited.work@example.invalid" }, adapter);
    const limitedMailbox = JSON.parse(readFileSync(MAILBOX, "utf8")) as { code: string };
    const wrongLimitedCode = limitedMailbox.code === "000000" ? "000001" : "000000";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await verifyLoginAlias(client, { userId: enabled.id, aliasId: limited.aliasId, expectedVersion: limited.aliasVersion, code: wrongLimitedCode });
      } catch {}
    }
    const limitedChallenge = await client.authVerificationChallenge.findFirstOrThrow({
      where: { aliasId: limited.aliasId }, orderBy: { createdAt: "desc" }
    });
    invariant(limitedChallenge.attempts === 5 && Boolean(limitedChallenge.invalidatedAt), "AUTH2B_VERIFICATION_ATTEMPT_LIMIT_NOT_PERSISTED");
    let limitedCodeRefused = false;
    try {
      await verifyLoginAlias(client, { userId: enabled.id, aliasId: limited.aliasId, expectedVersion: limited.aliasVersion, code: limitedMailbox.code });
    } catch { limitedCodeRefused = true; }
    invariant(limitedCodeRefused, "AUTH2B_ATTEMPT_LIMIT_BYPASSED");

    const requested = await beginAliasVerification(client, { userId: enabled.id, type: "PERSONAL_EMAIL", value: "new.personal@example.invalid" }, adapter);
    const verificationMailbox = JSON.parse(readFileSync(MAILBOX, "utf8")) as { code: string };
    await verifyLoginAlias(client, { userId: enabled.id, aliasId: requested.aliasId, expectedVersion: requested.aliasVersion, code: verificationMailbox.code });
    invariant((await client.authLoginAlias.findUniqueOrThrow({ where: { id: requested.aliasId } })).status === "VERIFIED", "AUTH2B_ALIAS_VERIFICATION_FAILED");
    let governedRemovalRefused = false;
    try { await removeLoginAlias(client, { userId: enabled.id, aliasId: `auth2b_username_${enabled.id}`, expectedVersion: 1 }); } catch { governedRemovalRefused = true; }
    invariant(governedRemovalRefused, "AUTH2B_GOVERNED_ALIAS_REMOVED");

    const sessionHeaders = new Headers({ "user-agent": "Mozilla/5.0 Chrome/126.0", "x-forwarded-for": "203.0.113.42" });
    const sessionOne = await createPersistedSession(client, enabled, sessionHeaders);
    const sessionTwo = await createPersistedSession(client, enabled, new Headers({ "user-agent": "Mozilla/5.0 Mobile Safari/605.1", "x-forwarded-for": "2001:db8:abcd:12::7" }));
    invariant(Boolean(await resolvePersistedSession(client, sessionOne.cookieValue)), "AUTH2B_SESSION_NOT_RESOLVED");
    invariant((await client.authSession.findUniqueOrThrow({ where: { id: sessionOne.sessionId } })).networkEvidenceMasked === "203.0.113.*", "AUTH2B_NETWORK_NOT_MASKED");

    await requestPasswordReset(client, { identifier: enabled.username, channelType: "WORK_EMAIL" }, adapter);
    const olderResetMailbox = JSON.parse(readFileSync(MAILBOX, "utf8")) as { resetPath: string };
    const olderResetToken = new URLSearchParams(olderResetMailbox.resetPath.split("#", 2)[1]).get("token") ?? "";
    await requestPasswordReset(client, { identifier: enabled.username, channelType: "WORK_EMAIL" }, adapter);
    const resetMailbox = JSON.parse(readFileSync(MAILBOX, "utf8")) as { resetPath: string };
    invariant(resetMailbox.resetPath.startsWith("/reset-password#token="), "AUTH2B_RESET_TOKEN_NOT_FRAGMENT_BOUND");
    const resetToken = new URLSearchParams(resetMailbox.resetPath.split("#", 2)[1]).get("token") ?? "";
    let olderResetRefused = false;
    const refusedReplacement = ["AUTH2B", "Older", "Reset", "Should", "Be", "Refused"].join("-") + "!";
    try { await consumePasswordReset(client, { token: olderResetToken, newPassword: refusedReplacement, confirmPassword: refusedReplacement }); } catch { olderResetRefused = true; }
    invariant(olderResetRefused, "AUTH2B_NEWER_RESET_DID_NOT_INVALIDATE_OLDER_TOKEN");
    const nextPassword = ["AUTH2B", "New", randomBytes(16).toString("hex")].join("-") + "!";
    await consumePasswordReset(client, { token: resetToken, newPassword: nextPassword, confirmPassword: nextPassword });
    const resetUser = await client.user.findUniqueOrThrow({ where: { id: enabled.id } });
    invariant(await verifyPassword(nextPassword, resetUser.passwordHash), "AUTH2B_RESET_PASSWORD_NOT_APPLIED");
    invariant(await client.authSession.count({ where: { id: { in: [sessionOne.sessionId, sessionTwo.sessionId] }, revokedAt: { not: null } } }) === 2, "AUTH2B_RESET_DID_NOT_REVOKE_SESSIONS");
    invariant(!await resolvePersistedSession(client, sessionTwo.cookieValue), "AUTH2B_REVOKED_SESSION_ACCEPTED");
    invariant(await client.authPasswordResetToken.count({ where: { userId: enabled.id, usedAt: { not: null } } }) === 1, "AUTH2B_RESET_NOT_SINGLE_USE");
    let reuseRefused = false;
    const reuseReplacement = nextPassword + "x";
    try { await consumePasswordReset(client, { token: resetToken, newPassword: reuseReplacement, confirmPassword: reuseReplacement }); } catch { reuseRefused = true; }
    invariant(reuseRefused, "AUTH2B_RESET_TOKEN_REUSED");

    invariant(pending.status === "PENDING", "AUTH2B_PENDING_FIXTURE_CHANGED");
    invariant(await client.authSecurityEvent.count() >= 4, "AUTH2B_SECURITY_EVENTS_MISSING");
    console.log(JSON.stringify({ result: "AUTH2B_COPIED_DATABASE_QA_PASSED", migratedUsernames, verifiedChannels: 3, duplicateRefused, verificationAttemptLimited: true, newerResetWins: true, sessionsRevoked: 2 }));
  } finally {
    await client.$disconnect();
    const operationalAfter = { sha256: fileSha256(OPERATIONAL_DATABASE), size: statSync(OPERATIONAL_DATABASE).size };
    invariant(JSON.stringify(operationalAfter) === JSON.stringify(operationalBefore), "AUTH2B_OPERATIONAL_DATABASE_CHANGED");
    const resolvedRoot = path.resolve(ROOT);
    invariant(resolvedRoot.startsWith(`${path.resolve(TMP_ROOT)}${path.sep}`), "AUTH2B_QA_CLEANUP_SCOPE_REFUSED");
    if (existsSync(resolvedRoot)) rmSync(resolvedRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "AUTH2B_COPIED_DATABASE_QA_FAILED");
  process.exitCode = 1;
});
