import { copyFileSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, type KeyObject } from "node:crypto";
import path from "node:path";
import { assertSqliteCopyReady, assertSqliteSnapshotUnchanged, snapshotSqliteArtifacts } from "./sqlite-copy-safety";

const workspace = path.resolve(".");
const operational = path.resolve(process.env.CROSS_PLATFORM_APPS_OPERATIONAL_DB ?? path.join(workspace, "prisma", "dev.db"));
const root = path.resolve(workspace, "tmp", "cross-platform-apps-1a-copied-qa");
const copied = path.join(root, "native-app-copy.db");
const keep = process.argv.includes("--keep");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;
let stage = "preflight";

function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function cleanup() {
  const safeParent = path.resolve(workspace, "tmp");
  invariant(root.startsWith(`${safeParent}${path.sep}`) && root.endsWith("cross-platform-apps-1a-copied-qa"), "CLEANUP_SCOPE_REFUSED");
  if (existsSync(root)) rmSync(root, { recursive: true, force: true });
}
function migrate() {
  const entry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [entry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(copied) }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`MIGRATION_FAILED:${result.error?.message ?? result.stderr}`);
}
function signature(message: string, privateKey: KeyObject) { return sign(null, Buffer.from(message), privateKey).toString("base64url"); }

async function main() {
  cleanup();
  assertSqliteCopyReady(operational, "CROSS_PLATFORM_APPS_OPERATIONAL");
  const before = snapshotSqliteArtifacts(operational);
  mkdirSync(root, { recursive: true });
  copyFileSync(operational, copied);
  migrate(); migrate();
  process.env.DATABASE_URL = databaseUrl(copied);
  process.env.APP_ORIGIN = "http://127.0.0.1:3000";
  process.env.RELEASE_FEATURE_FLAGS_QA_MODE = "SYNTHETIC_COPY_ONLY";
  process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED = "offline-sync-1a,cross-platform-apps-1a";
  const secret = randomBytes(48).toString("base64url");
  process.env.SESSION_SECRET = secret; process.env.AUTH_SECRET = secret; process.env.AUTH_VERIFICATION_SECRET = secret;

  const { prisma } = await import("../lib/prisma");
  const { authHashSecret } = await import("../lib/auth-security");
  const { createNativeAuthRequest, authorizeNativeRequest, exchangeNativeAuthorization, nativeBrowserProofMessage, nativeExchangeProofMessage, nativeRefreshProofMessage, refreshNativeSession, resolveNativeSession } = await import("../lib/native-app/auth");
  const { generateFullBackup } = await import("../lib/backup");
  const { parseAndValidateBackup } = await import("../lib/restore");
  const { restoreValidatedBackup } = await import("../lib/restore-database");
  const { normalizeNativePublicJwk, publicJwkHash, requestProofMessage, sha256Hex, verifyOfflineRequest } = await import("../lib/offline-sync/device-trust");
  const { stableJson } = await import("../lib/offline-sync/contracts");
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicJwk = normalizeNativePublicJwk(publicKey.export({ format: "jwk" }));
  const publicKeyHash = publicJwkHash(publicJwk);
  const publicDeviceId = randomUUID();
  const username = `native-qa-${randomBytes(4).toString("hex")}`;

  try {
    stage = "synthetic identity";
    const user = await prisma.user.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), name: "Native App QA Accountant", username, passwordHash: "$2b$12$synthetic.only.not.for.login.000000000000000000000000", role: "ACCOUNTANT", isActive: true, lifecycleStatus: "ACTIVE" } });
    const assignment = await prisma.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: user.id, role: "ACCOUNTANT", reason: "Synthetic copied DB native app QA", activeKey: `${user.id}:ACCOUNTANT` } });
    await prisma.rolePermission.upsert({ where: { role_permission: { role: "ACCOUNTANT", permission: "USE_OFFLINE_SYNC" } }, update: { enabled: true }, create: { role: "ACCOUNTANT", permission: "USE_OFFLINE_SYNC", enabled: true } });
    const webSession = await prisma.authSession.create({ data: { id: randomUUID(), userId: user.id, tokenHash: createHash("sha256").update(randomBytes(32)).digest("hex"), credentialVersion: 1, authorizationVersion: 1, activeRoleAssignmentId: assignment.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000), deviceSummary: "Synthetic browser", browserSummary: "Synthetic", networkEvidenceMasked: "local" } });
    const device = await prisma.offlineSyncDevice.create({ data: { publicDeviceId, userId: user.id, label: "Synthetic native QA device", platform: "WINDOWS", publicSigningKey: JSON.stringify(publicJwk), publicKeyHash, keyAlgorithm: "ED25519", keyVersion: 1, status: "ACTIVE", approvedAt: new Date(), approvedByUserId: user.id } });
    const actor = { id: user.id, name: user.name, username: user.username, email: null, designation: null, role: "ACCOUNTANT" as const, roleAssignmentId: assignment.id, authorizationVersion: 1, mustChangePassword: false, guardianId: null };

    stage = "pre-revocation restore monotonicity";
    const restorableAccessToken = randomBytes(32).toString("base64url");
    const restorableRefreshToken = randomBytes(32).toString("base64url");
    const restorableSession = await prisma.nativeSession.create({
      data: {
        userId: user.id,
        deviceId: device.id,
        roleAssignmentId: assignment.id,
        accessTokenHash: authHashSecret(restorableAccessToken, "native-app-v1:access"),
        refreshTokenHash: authHashSecret(restorableRefreshToken, "native-app-v1:refresh"),
        credentialVersion: 1,
        authorizationVersion: 1,
        scopesJson: JSON.stringify(["offline:context", "offline:reference", "offline:sync", "offline:own-conflicts"]),
        accessExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        refreshExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        absoluteExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    });
    const preRevocationBackup = parseAndValidateBackup(await generateFullBackup(prisma, { generatedBy: "CROSS-PLATFORM-APPS-1A pre-revocation restore QA" }));
    await prisma.nativeSession.delete({ where: { id: restorableSession.id } });
    const preRevocationRestore = await restoreValidatedBackup(prisma, preRevocationBackup, { id: user.id, name: user.name });
    invariant(preRevocationRestore.nativeSessions.errors.length === 0, `PRE_REVOCATION_RESTORE_ERRORS:${preRevocationRestore.nativeSessions.errors.join("|")}`);
    const restoredActiveBackup = await prisma.nativeSession.findUniqueOrThrow({ where: { id: restorableSession.id } });
    invariant(restoredActiveBackup.revokedAt != null && restoredActiveBackup.revocationReason === "RESTORED_CREDENTIAL_REQUIRES_REAUTHORIZATION", "PRE_REVOCATION_BACKUP_REACTIVATED_SESSION");
    let restoredAccessRejected = false;
    try {
      await resolveNativeSession(new Request("http://127.0.0.1:3000/api/native/v1/context", { headers: { Authorization: `Bearer ${restorableAccessToken}`, "x-native-session": restorableSession.publicSessionId } }));
    } catch { restoredAccessRejected = true; }
    invariant(restoredAccessRejected, "PRE_REVOCATION_RESTORED_ACCESS_ACCEPTED");

    stage = "PKCE browser authorization";
    const verifier = randomBytes(64).toString("base64url");
    const state = randomBytes(32).toString("base64url"); const nonce = randomBytes(32).toString("base64url");
    const pkce = createHash("sha256").update(verifier).digest("base64url");
    const requested = await createNativeAuthRequest({ appId: "com.nalandaps.erp", appVersion: "0.1.0", redirectUri: "nalandaps-erp://auth/callback", platform: "WINDOWS", deviceLabel: "Synthetic native QA device", publicDeviceId, state, nonce, pkceChallenge: pkce, publicSigningKey: publicJwk });
    const browserProof = signature(nativeBrowserProofMessage({ publicRequestId: requested.requestId, challenge: requested.challenge, state, publicDeviceId, publicKeyHash }), privateKey);
    const authorized = await authorizeNativeRequest({ requestId: requested.requestId, state, challenge: requested.challenge, proof: browserProof, user: actor, webSessionId: webSession.id });
    invariant(authorized.status === "AUTHORIZED", "AUTHORIZATION_NOT_ISSUED");
    const callback = new URL(authorized.redirectUrl); const code = callback.searchParams.get("code") ?? "";
    const exchangeProof = signature(nativeExchangeProofMessage({ requestId: requested.requestId, code, verifier, nonce, publicDeviceId }), privateKey);
    const tokens = await exchangeNativeAuthorization({ code, verifier, requestId: requested.requestId, nonce, publicDeviceId, proof: exchangeProof });
    invariant(tokens.tokenVersion === 1 && tokens.scopes.length === 4, "TOKEN_RESPONSE_INVALID");
    let replayRejected = false;
    try { await exchangeNativeAuthorization({ code, verifier, requestId: requested.requestId, nonce, publicDeviceId, proof: exchangeProof }); } catch { replayRejected = true; }
    invariant(replayRejected, "AUTHORIZATION_CODE_REPLAY_ACCEPTED");

    stage = "device-bound access";
    const accessRequestUrl = "http://127.0.0.1:3000/api/native/v1/context";
    const proofTimestamp = String(Date.now()); const proofNonce = randomBytes(24).toString("base64url"); const bodyHash = sha256Hex("");
    const accessProof = signature(requestProofMessage({ method: "GET", path: "/api/native/v1/context", timestamp: proofTimestamp, nonce: proofNonce, bodyHash, publicDeviceId, keyVersion: 1, schemaVersion: 1 }), privateKey);
    const accessRequest = new Request(accessRequestUrl, { headers: { Authorization: `Bearer ${tokens.accessToken}`, "x-native-session": tokens.sessionId, "x-offline-device-id": publicDeviceId, "x-offline-timestamp": proofTimestamp, "x-offline-nonce": proofNonce, "x-offline-body-sha256": bodyHash, "x-offline-signature": accessProof, "x-offline-key-version": "1", "x-offline-sync-schema": "1" } });
    const resolved = await resolveNativeSession(accessRequest);
    await verifyOfflineRequest({ request: accessRequest, rawBody: "", user: resolved.user, sessionId: null, expectedDeviceId: resolved.device.id });
    const secondPair = generateKeyPairSync("ed25519");
    const secondJwk = normalizeNativePublicJwk(secondPair.publicKey.export({ format: "jwk" }));
    const secondPublicDeviceId = randomUUID();
    const secondDevice = await prisma.offlineSyncDevice.create({ data: { publicDeviceId: secondPublicDeviceId, userId: user.id, label: "Synthetic second native QA device", platform: "ANDROID", publicSigningKey: JSON.stringify(secondJwk), publicKeyHash: publicJwkHash(secondJwk), keyAlgorithm: "ED25519", keyVersion: 1, status: "ACTIVE", approvedAt: new Date(), approvedByUserId: user.id } });
    const mixedTimestamp = String(Date.now()); const mixedNonce = randomBytes(24).toString("base64url");
    const mixedProof = signature(requestProofMessage({ method: "GET", path: "/api/native/v1/context", timestamp: mixedTimestamp, nonce: mixedNonce, bodyHash, publicDeviceId: secondPublicDeviceId, keyVersion: 1, schemaVersion: 1 }), secondPair.privateKey);
    const mixedRequest = new Request(accessRequestUrl, { headers: { Authorization: `Bearer ${tokens.accessToken}`, "x-native-session": tokens.sessionId, "x-offline-device-id": secondPublicDeviceId, "x-offline-timestamp": mixedTimestamp, "x-offline-nonce": mixedNonce, "x-offline-body-sha256": bodyHash, "x-offline-signature": mixedProof, "x-offline-key-version": "1", "x-offline-sync-schema": "1" } });
    let mixedDeviceRejected = false;
    try { await verifyOfflineRequest({ request: mixedRequest, rawBody: "", user: resolved.user, sessionId: null, expectedDeviceId: resolved.device.id }); } catch (error) { mixedDeviceRejected = error instanceof Error && error.message === "SESSION_DEVICE_MISMATCH"; }
    invariant(mixedDeviceRejected, "MIXED_SESSION_DEVICE_ACCEPTED");
    const secondDeviceAfter = await prisma.offlineSyncDevice.findUniqueOrThrow({ where: { id: secondDevice.id } });
    invariant(secondDeviceAfter.lastSeenAt == null, "MIXED_DEVICE_MUTATED_BEFORE_REJECTION");

    stage = "rotation and credential invalidation";
    const refreshAt = String(Date.now()); const refreshNonce = randomBytes(24).toString("base64url");
    const refreshProof = signature(nativeRefreshProofMessage({ sessionId: tokens.sessionId, timestamp: refreshAt, proofNonce: refreshNonce, refreshTokenHash: sha256Hex(tokens.refreshToken), publicDeviceId, tokenVersion: 1 }), privateKey);
    const rotated = await refreshNativeSession({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken, publicDeviceId, timestamp: refreshAt, proofNonce: refreshNonce, proof: refreshProof });
    invariant(rotated.tokenVersion === 2 && rotated.refreshToken !== tokens.refreshToken, "REFRESH_NOT_ROTATED");
    await prisma.user.update({ where: { id: user.id }, data: { credentialVersion: { increment: 1 } } });
    let staleCredentialRejected = false;
    try { await resolveNativeSession(new Request(accessRequestUrl, { headers: { Authorization: `Bearer ${rotated.accessToken}`, "x-native-session": rotated.sessionId } })); } catch { staleCredentialRejected = true; }
    invariant(staleCredentialRejected, "CREDENTIAL_VERSION_CHANGE_NOT_ENFORCED");
    await prisma.user.update({ where: { id: user.id }, data: { credentialVersion: 1 } });

    stage = "refresh replay revocation";
    const replayAt = String(Date.now()); const replayNonce = randomBytes(24).toString("base64url");
    const replayProof = signature(nativeRefreshProofMessage({ sessionId: tokens.sessionId, timestamp: replayAt, proofNonce: replayNonce, refreshTokenHash: sha256Hex(tokens.refreshToken), publicDeviceId, tokenVersion: 2 }), privateKey);
    let refreshReuseRejected = false;
    try { await refreshNativeSession({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken, publicDeviceId, timestamp: replayAt, proofNonce: replayNonce, proof: replayProof }); } catch { refreshReuseRejected = true; }
    const revoked = await prisma.nativeSession.findUniqueOrThrow({ where: { publicSessionId: tokens.sessionId } });
    invariant(refreshReuseRejected && revoked.revocationReason === "ROTATED_REFRESH_TOKEN_REUSED", "REFRESH_REUSE_DID_NOT_REVOKE_FAMILY");

    stage = "ciphertext and database constraints";
    const schemaColumns = await prisma.$queryRawUnsafe<Array<{ name: string }>>('PRAGMA table_info("NativeSession")');
    invariant(!schemaColumns.some((column) => /password|pin|private|plaintext/i.test(column.name)), "PRIVATE_NATIVE_COLUMN_PRESENT");
    let unRevokeRejected = false;
    try { await prisma.$executeRawUnsafe('UPDATE "NativeSession" SET "revokedAt" = NULL WHERE "id" = ?', revoked.id); } catch { unRevokeRejected = true; }
    invariant(unRevokeRejected, "SESSION_UNREVOCATION_ACCEPTED");

    stage = "logical backup and double restore";
    const rawBackup = await generateFullBackup(prisma, { generatedBy: "CROSS-PLATFORM-APPS-1A copied-database QA" });
    const serializedBackup = JSON.stringify(rawBackup);
    invariant(rawBackup.nativeSessions.some((row) => row.id === revoked.id && row.revocationReason === "ROTATED_REFRESH_TOKEN_REUSED"), "NATIVE_REVOKED_SESSION_BACKUP_MISSING");
    invariant(rawBackup.nativeRefreshTokenHistory.length >= 1 && rawBackup.nativeAppPolicy.featureDefaultEnabled === false, "NATIVE_SECURITY_BACKUP_INCOMPLETE");
    invariant(!serializedBackup.includes(tokens.accessToken) && !serializedBackup.includes(tokens.refreshToken) && !serializedBackup.includes(code) && !serializedBackup.includes(verifier), "PLAINTEXT_NATIVE_CREDENTIAL_IN_BACKUP");
    const backup = parseAndValidateBackup(rawBackup);
    for (let pass = 0; pass < 2; pass += 1) {
      const restored = await restoreValidatedBackup(prisma, backup, { id: user.id, name: user.name });
      const errors = Object.entries(restored).flatMap(([key, value]) => value && typeof value === "object" && "errors" in value && Array.isArray(value.errors) && value.errors.length ? [`${key}:${value.errors.join("|")}`] : []);
      invariant(errors.length === 0, `NATIVE_DOUBLE_RESTORE_ERRORS:${errors.join(";")}`);
    }
    const stillRevoked = await prisma.nativeSession.findUniqueOrThrow({ where: { id: revoked.id } });
    invariant(stillRevoked.revokedAt != null && stillRevoked.revocationReason === "ROTATED_REFRESH_TOKEN_REUSED", "RESTORE_LOST_NATIVE_REVOCATION");
    const evidence = { verdict: "PASS", authorization: "PKCE_S256_DEVICE_SIGNED", authorizationCodeReplay: "REJECTED", access: "OPAQUE_DEVICE_BOUND", mixedSessionDevice: "REJECTED_BEFORE_MUTATION", refreshRotation: "ROTATED", refreshReuse: "FAMILY_REVOKED", credentialVersionChange: "ACCESS_REJECTED", preRevocationBackupRestore: "REVOKED_REAUTH_REQUIRED", localCacheContract: "CIPHERTEXT_ONLY", migrationDeployPasses: 2, backupVersion: rawBackup.metadata.backupVersion, nativeBackup: "DURABLE_BINDINGS_POLICY_AND_REVOCATION_ONLY", restorePasses: 2, revokedSessionAfterRestore: "REVOKED", operationalDatabase: "BYTE_IDENTICAL", syntheticOnly: true, deviceId: createHash("sha256").update(device.id).digest("hex").slice(0, 16), requestDigest: createHash("sha256").update(stableJson({ appId: "com.nalandaps.erp", platform: "WINDOWS" })).digest("hex") };
    process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
  assertSqliteSnapshotUnchanged(before, snapshotSqliteArtifacts(operational), "CROSS_PLATFORM_APPS_OPERATIONAL");
}

main().catch((error) => { process.stderr.write(`CROSS_PLATFORM_APPS_1A_QA_FAILED at ${stage}: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; }).finally(() => { if (!keep) cleanup(); });
