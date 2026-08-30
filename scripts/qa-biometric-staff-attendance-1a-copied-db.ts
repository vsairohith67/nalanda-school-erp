import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const SUITE = "BIOMETRICSTAFFATTENDANCE1A";
const workspace = path.resolve(".");
const defaultOperational = path.join(process.env.USERPROFILE ?? "C:\\Users\\rohit", "Documents", "school software", "prisma", "dev.db");
const operational = path.resolve(process.env.BIOMETRIC_OPERATIONAL_DB?.trim() || defaultOperational);
const root = path.join(workspace, "tmp", `bio1a-${process.pid}`);
const copiedDatabase = path.join(root, "copy.db");
const restoreDatabase = path.join(root, "restore.db");
let stage = "preflight";

type Identity = { sha256: string; size: number; lastWriteUtc: string };
function invariant(value: unknown, code: string): asserts value { if (!value) throw new Error(code); }
function sha256File(file: string) { return createHash("sha256").update(readFileSync(file)).digest("hex"); }
function identity(file: string): Identity { const stat = statSync(file); return { sha256: sha256File(file), size: stat.size, lastWriteUtc: stat.mtime.toISOString() }; }
function databaseUrl(file: string) { return `file:${path.resolve(file).replaceAll("\\", "/")}`; }
function prismaFor(file: string) { return new PrismaClient({ datasourceUrl: databaseUrl(file) }); }
function cleanup() {
  const target = path.resolve(root), permitted = path.resolve(workspace, "tmp");
  invariant(target.startsWith(`${permitted}${path.sep}`) && path.basename(target) === `bio1a-${process.pid}`, `${SUITE}_CLEANUP_SCOPE_REFUSED`);
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
function migrate(file: string) {
  const prismaEntry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const run = (diagnostic = false) => spawnSync(process.execPath, [prismaEntry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file), DATABASE_PROVIDER: "sqlite", ...(diagnostic ? { RUST_BACKTRACE: "1", RUST_LOG: "info", DEBUG: "prisma:*" } : {}) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  let result = run();
  if (!result.error && result.status !== 0 && `${result.stdout}\n${result.stderr}`.includes("Schema engine error")) result = run(true);
  if (result.error || result.status !== 0) throw new Error(`${SUITE}_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
  return result.stdout;
}
async function expectRefusal(run: () => unknown | Promise<unknown>, code: string) {
  try { await run(); } catch (error) { if (error instanceof Error && error.message.includes(code)) return; throw error; }
  throw new Error(`${SUITE}_EXPECTED_REFUSAL_MISSING:${code}`);
}
function resultRows(keys: readonly string[]) { return Object.fromEntries(keys.map((key) => [key, { created: 0, updated: 0, skipped: 0, errors: [] as string[] }])); }

async function main() {
  cleanup();
  mkdirSync(path.dirname(copiedDatabase), { recursive: true });
  const operationalExists = existsSync(operational);
  const before = operationalExists ? identity(operational) : null;
  if (operationalExists) copyFileSync(operational, copiedDatabase);
  stage = "migration deploy and idempotency";
  const restoreMigration = migrate(restoreDatabase);
  const firstMigration = migrate(copiedDatabase);
  const secondMigration = migrate(copiedDatabase);
  invariant(firstMigration.includes("20260828090000_biometric_staff_attendance_1a") || secondMigration.includes("No pending migrations"), `${SUITE}_MIGRATION_NOT_APPLIED`);
  invariant(secondMigration.includes("No pending migrations"), `${SUITE}_MIGRATION_NOT_IDEMPOTENT`);
  invariant(restoreMigration.includes("20260828090000_biometric_staff_attendance_1a"), `${SUITE}_FRESH_RESTORE_MIGRATION_NOT_APPLIED`);

  process.env.DATABASE_URL = databaseUrl(copiedDatabase);
  process.env.DATABASE_PROVIDER = "sqlite";
  process.env.NODE_ENV = "test";
  process.env.RELEASE_FEATURE_FLAGS_QA_MODE = "true";
  process.env.RELEASE_FEATURE_FLAGS_QA_ENABLED = "biometric-staff-attendance-1a";

  const [{ prisma }, governance, reconciliation, ingestion, contracts, trust, backupModule, bridgeSimulator] = await Promise.all([
    import("../lib/prisma"),
    import("../lib/biometric-attendance/governance"),
    import("../lib/biometric-attendance/reconciliation"),
    import("../lib/biometric-attendance/ingestion"),
    import("../lib/biometric-attendance/contracts"),
    import("../lib/biometric-attendance/trust"),
    import("../lib/biometric-attendance/backup"),
    import("../apps/nalanda-biometric-bridge/src/adapters/simulator")
  ]);

  try {
    stage = "synthetic identities";
    const suffix = randomUUID().slice(0, 8);
    const actors = await Promise.all([
      ["preparer", "ADMIN"], ["approver", "PRINCIPAL"], ["staff", "TEACHER"]
    ].map(async ([label, role]) => prisma.user.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), name: `Biometric QA ${label}`, username: `biometric-${label}-${suffix}`, passwordHash: `synthetic-not-login-${randomBytes(16).toString("hex")}`, role, designation: `${role} synthetic copied-database fixture`, isActive: true, lifecycleStatus: "ACTIVE" } })));
    const [preparer, approver, staffUser] = actors;
    const staff = await prisma.staffMember.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), staffCode: `BIO-${suffix}`, fullName: "Synthetic Biometric Staff", designation: "Teacher", department: "Synthetic QA", status: "ACTIVE", userId: staffUser.id } });
    const inactive = await prisma.staffMember.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), staffCode: `BIO-I-${suffix}`, fullName: "Synthetic Inactive Staff", designation: "Teacher", status: "INACTIVE" } });

    stage = "bridge and device governance";
    const keys = generateKeyPairSync("ed25519");
    const publicJwk = keys.publicKey.export({ format: "jwk" });
    const bridgeSafe = await governance.createBiometricBridge({ label: "Synthetic private-LAN bridge", publicSigningKey: publicJwk }, preparer.id);
    await governance.transitionBiometricBridge(bridgeSafe.id, "APPROVE", approver.id);
    const bridge = await prisma.biometricBridge.findUniqueOrThrow({ where: { id: bridgeSafe.id } });
    const deviceSafe = await governance.registerBiometricDevice({ bridgeId: bridge.id, vendor: "SIMULATOR", model: "Deterministic 1A", firmware: "sim-1", serialReference: "SYNTHETIC-12345678", campus: "Synthetic Campus", location: "QA Lab", protocolProfile: "SIMULATOR" }, preparer.id);
    await governance.transitionBiometricDevice(deviceSafe.id, "APPROVE", approver.id);
    const device = await prisma.biometricDevice.findUniqueOrThrow({ where: { id: deviceSafe.id } });
    invariant(device.serialReferenceMasked === "***5678", `${SUITE}_SERIAL_MASKING_FAILED`);
    const vendorDevice = await governance.registerBiometricDevice({ bridgeId: bridge.id, vendor: "eSSL", model: "K30 Pro candidate", firmware: "unverified", serialReference: "VENDOR1234", campus: "Synthetic Campus", location: "QA Lab", protocolProfile: "ESSL_K30_PRO_PUSH" }, preparer.id);
    await expectRefusal(() => governance.transitionBiometricDevice(vendorDevice.id, "APPROVE", approver.id), "BIOMETRIC_VENDOR_PROTOCOL_NOT_VERIFIED");

    stage = "Staff mapping governance";
    const mapping = await governance.prepareBiometricMapping({ deviceId: device.id, staffMemberId: staff.id, opaqueDeviceUserId: "STAFF-001", effectiveFrom: "2026-01-01", reason: "Synthetic explicit mapping approval" }, preparer.id);
    await expectRefusal(() => governance.transitionBiometricMapping(mapping.id, "APPROVE", preparer.id), "BIOMETRIC_MAPPING_DUAL_CONTROL_REQUIRED");
    await governance.transitionBiometricMapping(mapping.id, "APPROVE", approver.id);
    await expectRefusal(() => governance.prepareBiometricMapping({ deviceId: device.id, staffMemberId: staff.id, opaqueDeviceUserId: "STAFF-001", effectiveFrom: "2026-01-01", reason: "Synthetic duplicate" }, preparer.id), "BIOMETRIC_MAPPING_CONFLICT");
    await expectRefusal(() => governance.prepareBiometricMapping({ deviceId: device.id, staffMemberId: inactive.id, opaqueDeviceUserId: "INACTIVE-1", effectiveFrom: "2026-01-01", reason: "Synthetic inactive refusal" }, preparer.id), "BIOMETRIC_MAPPING_INACTIVE_STAFF");

    stage = "policy and deterministic ingestion";
    const policy = await governance.createBiometricPolicy({ name: "Synthetic day shift", campus: "Synthetic Campus", effectiveFrom: "2026-01-01", shiftStartTime: "08:00", shiftEndTime: "16:00", graceMinutes: 5, earlyDepartureGraceMinutes: 5, halfDayThresholdMinutes: 240, overnightShiftEnabled: false }, preparer.id);
    await expectRefusal(() => governance.approveBiometricPolicy(policy.id, preparer.id), "BIOMETRIC_POLICY_DUAL_CONTROL_REQUIRED");
    await governance.approveBiometricPolicy(policy.id, approver.id);
    await expectRefusal(() => governance.createBiometricPolicy({ name: "Overnight", campus: "Synthetic Campus", effectiveFrom: "2026-01-01", shiftStartTime: "20:00", shiftEndTime: "06:00", graceMinutes: 0, earlyDepartureGraceMinutes: 0, halfDayThresholdMinutes: 240, overnightShiftEnabled: true }, preparer.id), "BIOMETRIC_COMPLEX_SHIFT_REQUIRES_LATER_CONFIGURATION");

    const ingest = async (batchReference: string, events: ReturnType<typeof bridgeSimulator.simulateScenario>, nonce = randomBytes(24).toString("base64url")) => {
      const envelope = contracts.validateBiometricEnvelope({ schemaVersion: 1, batchReference, bridgeTime: "2026-08-28T12:00:00.000Z", events }, new Date("2026-08-28T12:00:00.000Z"));
      const rawBody = JSON.stringify(envelope);
      try {
        return await ingestion.ingestBiometricBatch({ envelope, rawBody, verified: { bridge, nonceHash: contracts.sha256Hex(nonce), keyVersion: bridge.keyVersion, nonceExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      } catch (error) {
        throw new Error(`${SUITE}_INGEST_FAILED:${batchReference}:${error instanceof Error ? error.message : String(error)}`);
      }
    };
    const normal = bridgeSimulator.simulateScenario("normal", device.publicDeviceId);
    const accepted = await ingest(`normal-${suffix}`, normal);
    invariant(accepted.accepted === 2 && accepted.exceptions === 0, `${SUITE}_NORMAL_INGEST_FAILED`);
    const duplicateBatch = await ingest(`normal-${suffix}`, normal);
    invariant(duplicateBatch.status === "DUPLICATE_ACCEPTED", `${SUITE}_BATCH_IDEMPOTENCY_FAILED`);
    await expectRefusal(() => ingest(`normal-${suffix}`, [{ ...normal[0], punchTimestamp: "2026-08-28T02:31:00.000Z" }]), "BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED");
    await expectRefusal(() => ingest(`changed-event-${suffix}`, [{ ...normal[0], punchTimestamp: "2026-08-28T02:31:00.000Z" }]), "BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED");
    invariant(await prisma.biometricAuditEvent.count({ where: { eventType: "BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED" } }) === 1, `${SUITE}_CHANGED_REPLAY_AUDIT_MISSING`);
    const replayNonce = randomBytes(24).toString("base64url");
    const unknownStaff = bridgeSimulator.simulateScenario("unknown-staff", device.publicDeviceId).map((row) => ({ ...row, sequenceNumber: null, eventReference: "NONCE-UNKNOWN-STAFF" }));
    await ingest(`nonce-a-${suffix}`, unknownStaff, replayNonce);
    await expectRefusal(() => ingest(`nonce-b-${suffix}`, [{ ...normal[0], eventReference: "NONCE-REPLAY", sequenceNumber: 99 }], replayNonce), "BIOMETRIC_NONCE_REPLAYED");
    await expectRefusal(() => Promise.resolve(contracts.validateBiometricEnvelope({ schemaVersion: 1, batchReference: `malformed-${suffix}`, bridgeTime: "2026-08-28T12:00:00.000Z", events: bridgeSimulator.simulateScenario("malformed", device.publicDeviceId) }, new Date("2026-08-28T12:00:00.000Z"))), "BIOMETRIC_DEVICE_USER_ID_INVALID");

    const message = trust.biometricRequestMessage({ method: "POST", path: "/api/biometric/ingest", timestamp: "1", nonce: "abcdefghijklmnop", bodyHash: "a".repeat(64), publicBridgeId: bridge.publicBridgeId, keyVersion: 1, schemaVersion: 1 });
    const signature = sign(null, Buffer.from(message), keys.privateKey).toString("base64url");
    invariant(await trust.verifyBridgeSignature(bridge.publicSigningKey, bridge.keyAlgorithm, message, signature), `${SUITE}_SIGNATURE_VERIFICATION_FAILED`);
    invariant(!(await trust.verifyBridgeSignature(bridge.publicSigningKey, bridge.keyAlgorithm, `${message}-tampered`, signature)), `${SUITE}_SIGNATURE_TAMPER_ACCEPTED`);

    const severeDrift = bridgeSimulator.simulateScenario("severe-clock-drift", device.publicDeviceId).map((row, index) => ({ ...row, sequenceNumber: null, eventReference: `SEVERE-DRIFT-${index + 1}`, punchTimestamp: new Date(new Date(row.punchTimestamp).getTime() - 86_400_000).toISOString() }));
    await ingest(`severe-drift-${suffix}`, severeDrift);
    invariant(await prisma.biometricRawPunch.count({ where: { clockDriftStatus: "UNTRUSTED_TIME", reconciliationStatus: "DEVICE_TIME_UNTRUSTED" } }) === 2, `${SUITE}_SEVERE_CLOCK_DRIFT_NOT_QUARANTINED`);

    stage = "reconciliation and correction";
    const prepared = await reconciliation.reconcileBiometricAttendanceDate("2026-08-28", preparer.id);
    invariant(prepared.ready >= 1, `${SUITE}_RECONCILIATION_NOT_READY`);
    const reconciliationRow = await prisma.biometricReconciliation.findUniqueOrThrow({ where: { staffMemberId_attendanceDate: { staffMemberId: staff.id, attendanceDate: new Date("2026-08-28T00:00:00.000Z") } } });
    invariant(reconciliationRow.outcome === "PRESENT", `${SUITE}_RECONCILIATION_OUTCOME_INVALID`);
    await expectRefusal(() => reconciliation.approveBiometricReconciliation(reconciliationRow.id, preparer.id), "BIOMETRIC_RECONCILIATION_DUAL_CONTROL_REQUIRED");
    await reconciliation.approveBiometricReconciliation(reconciliationRow.id, approver.id);
    const attendance = await prisma.staffAttendanceRecord.findFirstOrThrow({ where: { staffMemberId: staff.id } });
    invariant(attendance.source === "BIOMETRIC" && attendance.status === "PRESENT", `${SUITE}_ATTENDANCE_APPROVAL_FAILED`);
    const correction = await reconciliation.requestBiometricCorrection({ reconciliationId: reconciliationRow.id, reason: "Synthetic approved correction", after: { outcome: "LATE", checkInTime: "08:10", checkOutTime: "16:00", lateMinutes: 5, earlyDepartureMinutes: 0 } }, staffUser.id, true);
    await expectRefusal(() => reconciliation.decideBiometricCorrection(correction.id, "APPROVE", staffUser.id), "BIOMETRIC_CORRECTION_DUAL_CONTROL_REQUIRED");
    await reconciliation.decideBiometricCorrection(correction.id, "APPROVE", approver.id);
    const corrected = await prisma.staffAttendanceRecord.findUniqueOrThrow({ where: { id: attendance.id } });
    invariant(corrected.status === "LATE" && corrected.source === "BIOMETRIC", `${SUITE}_CORRECTION_APPROVAL_FAILED`);

    stage = "device exceptions, sequence reset, burst and revocation";
    await ingest(`gap-${suffix}`, [{ ...normal[0], opaqueDeviceUserId: "STAFF-001", eventReference: "SIM-GAP-5", sequenceNumber: 5, punchTimestamp: "2026-08-28T11:00:00.000Z" }]);
    invariant(await prisma.biometricSequenceGap.count({ where: { deviceId: device.id } }) >= 1, `${SUITE}_SEQUENCE_GAP_NOT_DETECTED`);
    await ingest(`reset-${suffix}`, bridgeSimulator.simulateScenario("firmware-reset", device.publicDeviceId));
    invariant((await prisma.biometricDevice.findUniqueOrThrow({ where: { id: device.id } })).sequenceEpoch === 2, `${SUITE}_FIRMWARE_RESET_NOT_TRACKED`);
    const burstDevice = await prisma.biometricDevice.create({ data: { publicDeviceId: randomUUID(), bridgeId: bridge.id, vendor: "SIMULATOR", model: "Burst simulator", campus: "Synthetic Campus", location: "QA Lab", protocolProfile: "SIMULATOR", protocolProofStatus: "NOT_REQUIRED", status: "ACTIVE", healthStatus: "AWAITING_FIRST_SYNC", approvedByUserId: approver.id, approvedAt: new Date() } });
    const burst = await ingest(`burst-${suffix}`, bridgeSimulator.simulateScenario("morning-burst-80", burstDevice.publicDeviceId));
    invariant(burst.accepted === 80 && burst.exceptions === 80, `${SUITE}_MORNING_BURST_FAILED`);
    await governance.transitionBiometricDevice(burstDevice.id, "REVOKE", approver.id, "Synthetic revocation test");
    await expectRefusal(() => ingest(`revoked-${suffix}`, bridgeSimulator.simulateScenario("revoked-device", burstDevice.publicDeviceId)), "BIOMETRIC_DEVICE_REVOKED");

    stage = "immutability";
    const rawPunch = await prisma.biometricRawPunch.findFirstOrThrow({ where: { deviceId: device.id } });
    const tamperedPunchCode = rawPunch.punchCode === "IN" ? "OUT" : "IN";
    await expectRefusal(() => prisma.$executeRaw`UPDATE "BiometricRawPunch" SET "punchCode" = ${tamperedPunchCode} WHERE "id" = ${rawPunch.id}`, "BIOMETRIC_RAW_EVIDENCE_IMMUTABLE");
    await expectRefusal(() => prisma.$executeRaw`DELETE FROM "BiometricRawPunch" WHERE "id" = ${rawPunch.id}`, "BIOMETRIC_RAW_EVIDENCE_IMMUTABLE");
    await expectRefusal(() => prisma.$executeRaw`UPDATE "BiometricCorrection" SET "reason" = ${"silent overwrite"} WHERE "id" = ${correction.id}`, "BIOMETRIC_CORRECTION_EVIDENCE_IMMUTABLE");
    await expectRefusal(() => prisma.$executeRaw`UPDATE "BiometricDevice" SET "protocolProofStatus" = ${"NOT_PROVIDED"} WHERE "id" = ${burstDevice.id}`, "BIOMETRIC_DEVICE_TRANSITION_INVALID");
    invariant(await prisma.biometricReplayNonce.count() > 0, `${SUITE}_REPLAY_LEDGER_EMPTY`);

    stage = "backup and restore";
    const biometricBackup = backupModule.validateBiometricAttendanceBackupRows(await backupModule.loadBiometricAttendanceBackup(prisma));
    invariant(!("biometricReplayNonces" in biometricBackup), `${SUITE}_REPLAY_NONCES_EXPORTED`);
    const serialized = JSON.stringify(biometricBackup);
    invariant(!/(fingerprintTemplate|facialTemplate|fingerprintImage|facialImage|cardSecret|administratorPassword|privateSigningKey)/i.test(serialized), `${SUITE}_PROTECTED_MATERIAL_EXPORTED`);
    const restore = prismaFor(restoreDatabase);
    try {
      for (const actor of actors) await restore.user.create({ data: { ...actor, createdAt: undefined, updatedAt: undefined } });
      await restore.staffMember.create({ data: { id: staff.id, iamPublicKey: staff.iamPublicKey, staffCode: staff.staffCode, fullName: staff.fullName, designation: staff.designation, department: staff.department, status: staff.status, userId: staffUser.id } });
      const maps = { users: new Map(actors.map((row) => [row.id, row.id])), staffMembers: new Map([[staff.id, staff.id]]), restoredBy: approver.id };
      const restoreResult = { ...resultRows(backupModule.BIOMETRIC_ATTENDANCE_BACKUP_KEYS), warnings: [] as string[] } as any;
      await backupModule.restoreBiometricAttendanceBackup(restore, biometricBackup, maps, restoreResult);
      invariant(restoreResult.biometricRawPunches.errors.length === 0 && restoreResult.biometricCorrections.errors.length === 0, `${SUITE}_RESTORE_ERRORS:${JSON.stringify(restoreResult)}`);
      invariant(await restore.biometricRawPunch.count() === biometricBackup.biometricRawPunches.length, `${SUITE}_RESTORE_RAW_PUNCH_COUNT_MISMATCH`);
      invariant(await restore.biometricReplayNonce.count() === 0, `${SUITE}_RESTORE_REPLAY_NONCE_PRESENT`);
      await backupModule.restoreBiometricAttendanceBackup(restore, biometricBackup, maps, restoreResult);
      invariant(restoreResult.biometricRawPunches.skipped >= biometricBackup.biometricRawPunches.length, `${SUITE}_RESTORE_NOT_IDEMPOTENT`);
      invariant(await restore.biometricDevice.count({ where: { status: "REVOKED" } }) === await prisma.biometricDevice.count({ where: { status: "REVOKED" } }), `${SUITE}_RESTORE_REVOKED_DEVICE_STATE_CHANGED`);
    } finally { await restore.$disconnect(); }

    const workspaceState = await governance.loadBiometricWorkspace();
    invariant(workspaceState.punches.length >= 80 && workspaceState.corrections.length >= 1 && workspaceState.auditEvents.length >= 1, `${SUITE}_WORKSPACE_INCOMPLETE`);
    const own = await reconciliation.loadOwnBiometricAttendance(staffUser.id, "2026-08-01", "2026-08-31");
    invariant(own.reconciliations.length === 1, `${SUITE}_OWN_SCOPE_FAILED`);
    const csv = reconciliation.biometricReportCsv(await reconciliation.biometricReportRows("2026-08-01", "2026-08-31"));
    invariant(csv.includes("Synthetic Biometric Staff") && !csv.includes("fingerprintTemplate"), `${SUITE}_REPORT_FAILED`);

    const after = operationalExists ? identity(operational) : null;
    invariant(JSON.stringify(before) === JSON.stringify(after), `${SUITE}_OPERATIONAL_DATABASE_CHANGED`);
    process.stdout.write(`${JSON.stringify({ suite: SUITE, result: "PASSED", operationalDatabase: operationalExists ? { path: operational, before, after, byteIdentical: true } : { path: operational, present: false, syntheticFreshDatabase: true }, migrations: { applied: true, secondDeployNoPending: true }, simulator: { scenarios: bridgeSimulator.SIMULATOR_SCENARIOS.length, morningBurst: 80 }, bridge: { signedBatches: true, encryptedQueueCoveredByUnitTest: true, vendorProfilesDefaultDisabled: true }, mapping: { explicitApproval: true, conflictRejected: true, inactiveStaffRejected: true }, reconciliation: { prepared: true, approved: true, correctionDualControl: true, payrollImpact: false }, security: { replayRejected: true, revokedDeviceRejected: true, rawEvidenceImmutable: true, protectedMaterialExcluded: true }, backupRestore: { restored: true, idempotent: true, replayNoncesExcluded: true } }, null, 2)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const after = existsSync(operational) ? identity(operational) : null;
  process.stderr.write(`${JSON.stringify({ suite: SUITE, result: "FAILED", stage, error: error instanceof Error ? error.message : String(error), operationalDatabase: { path: operational, after } }, null, 2)}\n`);
  process.exitCode = 1;
}).finally(() => cleanup());
