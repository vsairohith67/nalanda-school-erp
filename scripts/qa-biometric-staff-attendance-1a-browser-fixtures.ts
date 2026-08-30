import { createHash, generateKeyPairSync, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

import { hashPassword } from "../lib/password";

const workspace = path.resolve(".");
const operational = path.resolve(process.env.BIOMETRIC_OPERATIONAL_DB?.trim() || path.join(process.env.USERPROFILE ?? "C:\\Users\\rohit", "Documents", "school software", "prisma", "dev.db"));
const root = path.join(workspace, "tmp", "biometric-staff-attendance-1a-browser");
const database = path.join(root, "browser.db");
const credentialsPath = path.join(root, "credentials.json");
const runtimePath = path.join(root, "runtime-env.json");
const port = 3268;
const databaseUrl = `file:${database.replaceAll("\\", "/")}`;

function identity(file: string) { const stat = statSync(file); return { sha256: createHash("sha256").update(readFileSync(file)).digest("hex"), size: stat.size, mtime: stat.mtime.toISOString() }; }
function cleanup() {
  const target = path.resolve(root), parent = path.resolve(workspace, "tmp");
  if (!target.startsWith(`${parent}${path.sep}`) || !target.endsWith("biometric-staff-attendance-1a-browser")) throw new Error("BIOMETRIC_BROWSER_CLEANUP_SCOPE_REFUSED");
  if (existsSync(target)) rmSync(target, { recursive: true, force: true });
}
function migrate() {
  const entry = path.join(workspace, "node_modules", "prisma", "build", "index.js");
  const result = spawnSync(process.execPath, [entry, "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_PROVIDER: "sqlite" }, encoding: "utf8", windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  if (result.status !== 0 || result.error) throw new Error(`BIOMETRIC_BROWSER_MIGRATION_FAILED:${result.error?.message ?? result.stderr}`);
}
async function createUser(client: PrismaClient, role: "SUPER_ADMIN" | "PRINCIPAL" | "TEACHER" | "ACCOUNTANT", password: string) {
  const username = `biometric-browser-${role.toLowerCase().replaceAll("_", "-")}`;
  const user = await client.user.create({ data: { id: randomUUID(), iamPublicKey: randomUUID(), name: `Biometric Browser ${role}`, designation: `${role} synthetic fixture`, username, passwordHash: await hashPassword(password), role, isActive: true, lifecycleStatus: "ACTIVE" } });
  await client.authLoginAlias.create({ data: { userId: user.id, type: "USERNAME", normalizedValue: username, displayMasked: username, status: "VERIFIED", isSchoolGoverned: true, verifiedAt: new Date() } });
  await client.userRoleAssignment.create({ data: { id: randomUUID(), publicKey: randomUUID(), userId: user.id, role, status: "ACTIVE", reason: "Biometric 1A isolated Browser QA", activeKey: `${user.id}:${role}` } });
  return { id: user.id, username, role };
}

async function setup() {
  cleanup();
  if (!existsSync(operational)) throw new Error("BIOMETRIC_BROWSER_OPERATIONAL_DATABASE_MISSING");
  const before = identity(operational);
  mkdirSync(root, { recursive: true });
  copyFileSync(operational, database);
  migrate(); migrate();
  const client = new PrismaClient({ datasourceUrl: databaseUrl });
  const syntheticCredential = `BiometricBrowser-${randomBytes(18).toString("base64url")}!9a`;
  try {
    const users = await Promise.all(["SUPER_ADMIN", "PRINCIPAL", "TEACHER", "ACCOUNTANT"].map((role) => createUser(client, role as "SUPER_ADMIN" | "PRINCIPAL" | "TEACHER" | "ACCOUNTANT", syntheticCredential)));
    const superAdmin = users.find((row) => row.role === "SUPER_ADMIN")!, principal = users.find((row) => row.role === "PRINCIPAL")!, teacher = users.find((row) => row.role === "TEACHER")!;
    const staff = await client.staffMember.create({ data: { iamPublicKey: randomUUID(), staffCode: "BIO-BROWSER-001", fullName: "Synthetic Browser Teacher", designation: "Teacher", department: "Synthetic QA", status: "ACTIVE", userId: teacher.id } });
    const keys = generateKeyPairSync("ed25519"), publicJwk = keys.publicKey.export({ format: "jwk" });
    const serialized = JSON.stringify({ kty: publicJwk.kty, crv: publicJwk.crv, x: publicJwk.x, ext: true, key_ops: ["verify"] });
    const bridge = await client.biometricBridge.create({ data: { publicBridgeId: randomUUID(), label: "Browser QA private-LAN bridge", publicSigningKey: serialized, publicKeyHash: createHash("sha256").update(serialized).digest("hex"), keyAlgorithm: "ED25519", status: "ACTIVE", approvedByUserId: superAdmin.id, approvedAt: new Date() } });
    const device = await client.biometricDevice.create({ data: { publicDeviceId: randomUUID(), bridgeId: bridge.id, vendor: "SIMULATOR", model: "Deterministic 1A", firmware: "sim-1", serialReferenceMasked: "***1234", campus: "Synthetic Campus", location: "Browser QA Lab", protocolProfile: "SIMULATOR", protocolProofStatus: "NOT_REQUIRED", status: "ACTIVE", healthStatus: "HEALTHY", clockDriftSeconds: 12, lastEventAt: new Date("2026-08-28T10:30:00Z"), lastSyncAt: new Date(), lastHealthAt: new Date(), approvedByUserId: superAdmin.id, approvedAt: new Date() } });
    const mapping = await client.biometricStaffMapping.create({ data: { deviceId: device.id, opaqueDeviceUserId: "STAFF-BROWSER-001", staffMemberId: staff.id, status: "ACTIVE", effectiveFrom: new Date("2026-01-01T00:00:00Z"), preparedByUserId: superAdmin.id, preparationReason: "Synthetic explicit Browser QA mapping", approvedByUserId: principal.id, approvedAt: new Date() } });
    const batch = await client.biometricIngestBatch.create({ data: { batchReference: "browser-batch-001", bridgeId: bridge.id, requestHash: "a".repeat(64), nonceHash: "b".repeat(64), keyVersion: 1, eventCount: 2, sequenceStart: 1, sequenceEnd: 2, status: "COMPLETED", completedAt: new Date() } });
    const first = await client.biometricRawPunch.create({ data: { eventIdentityHash: "c".repeat(64), eventPayloadHash: "e".repeat(64), batchId: batch.id, bridgeId: bridge.id, deviceId: device.id, mappingId: mapping.id, staffMemberId: staff.id, opaqueDeviceUserId: "STAFF-BROWSER-001", punchTimestamp: new Date("2026-08-28T02:30:00Z"), bridgeReceivedTimestamp: new Date("2026-08-28T02:30:01Z"), verificationMethod: "FINGERPRINT", punchCode: "IN", sequenceNumber: 1, eventReference: "BROWSER-IN", protocolProfile: "SIMULATOR", clockDriftSeconds: 12, clockDriftStatus: "HEALTHY", reconciliationStatus: "RECONCILED" } });
    const last = await client.biometricRawPunch.create({ data: { eventIdentityHash: "d".repeat(64), eventPayloadHash: "f".repeat(64), batchId: batch.id, bridgeId: bridge.id, deviceId: device.id, mappingId: mapping.id, staffMemberId: staff.id, opaqueDeviceUserId: "STAFF-BROWSER-001", punchTimestamp: new Date("2026-08-28T10:30:00Z"), bridgeReceivedTimestamp: new Date("2026-08-28T10:30:01Z"), verificationMethod: "FINGERPRINT", punchCode: "OUT", sequenceNumber: 2, eventReference: "BROWSER-OUT", protocolProfile: "SIMULATOR", clockDriftSeconds: 12, clockDriftStatus: "HEALTHY", reconciliationStatus: "RECONCILED" } });
    const policy = await client.biometricAttendancePolicy.create({ data: { name: "Browser QA day shift", campus: "Synthetic Campus", effectiveFrom: new Date("2026-01-01T00:00:00Z"), shiftStartTime: "08:00", shiftEndTime: "16:00", graceMinutes: 5, earlyDepartureGraceMinutes: 5, halfDayThresholdMinutes: 240, status: "ACTIVE", preparedByUserId: superAdmin.id, approvedByUserId: principal.id, approvedAt: new Date() } });
    const attendanceSession = await client.staffAttendanceSession.upsert({ where: { attendanceDate: new Date("2026-08-28T00:00:00Z") }, update: {}, create: { attendanceDate: new Date("2026-08-28T00:00:00Z"), status: "DRAFT", notes: "Synthetic biometric Browser QA" } });
    const attendance = await client.staffAttendanceRecord.create({ data: { sessionId: attendanceSession.id, staffMemberId: staff.id, staffCode: staff.staffCode, status: "PRESENT", checkInTime: "08:00", checkOutTime: "16:00", source: "BIOMETRIC", remarks: "Synthetic approved reconciliation" } });
    const reconciliation = await client.biometricReconciliation.create({ data: { staffMemberId: staff.id, attendanceDate: new Date("2026-08-28T00:00:00Z"), policyId: policy.id, status: "APPROVED", outcome: "PRESENT", firstPunchId: first.id, lastPunchId: last.id, punchCount: 2, checkInTime: "08:00", checkOutTime: "16:00", attendanceRecordId: attendance.id, preparedByUserId: superAdmin.id, preparedAt: new Date(), approvedByUserId: principal.id, approvedAt: new Date() } });
    await client.biometricCorrection.create({ data: { reconciliationId: reconciliation.id, requestedByUserId: teacher.id, reason: "Synthetic correction history", originalEvidenceJson: JSON.stringify({ rawPunches: [{ id: first.id }, { id: last.id }] }), beforeJson: JSON.stringify({ outcome: "PRESENT", checkInTime: "08:00", checkOutTime: "16:00" }), afterJson: JSON.stringify({ outcome: "LATE", checkInTime: "08:10", checkOutTime: "16:00", lateMinutes: 5, earlyDepartureMinutes: 0 }), status: "REJECTED", approvedByUserId: principal.id, rejectedAt: new Date(), rejectionReason: "Synthetic evidence shows the original time" } });
    await client.biometricSequenceGap.create({ data: { deviceId: device.id, batchId: batch.id, sequenceEpoch: 1, expectedSequence: 3, receivedSequence: 5, status: "OPEN" } });
    await client.biometricAuditEvent.create({ data: { entityType: "DEVICE", entityId: device.id, eventType: "BROWSER_QA_DEVICE_HEALTH", actorUserId: superAdmin.id, safeMetadataJson: JSON.stringify({ synthetic: true }) } });

    writeFileSync(credentialsPath, JSON.stringify({ password: syntheticCredential, users }, null, 2), { flag: "wx" });
    writeFileSync(runtimePath, JSON.stringify({ DATABASE_URL: databaseUrl, DATABASE_PROVIDER: "sqlite", SESSION_SECRET: randomBytes(48).toString("base64url"), AUTH_SECRET: randomBytes(48).toString("base64url"), APP_ORIGIN: `http://127.0.0.1:${port}`, RELEASE_FEATURE_FLAGS_QA_MODE: "SYNTHETIC_COPY_ONLY", RELEASE_FEATURE_FLAGS_QA_ENABLED: "biometric-staff-attendance-1a", NODE_ENV: "development", PORT: String(port) }, null, 2), { flag: "wx" });
    if (JSON.stringify(before) !== JSON.stringify(identity(operational))) throw new Error("BIOMETRIC_BROWSER_OPERATIONAL_DATABASE_CHANGED");
    process.stdout.write(`${JSON.stringify({ result: "BIOMETRIC_STAFF_ATTENDANCE_1A_BROWSER_READY", copiedDatabase: true, operationalMutation: false, port, users: users.map((row) => row.role), credentialsPath, runtimePath })}\n`);
  } finally { await client.$disconnect(); }
}

if (process.argv[2] === "cleanup") { cleanup(); process.stdout.write('{"result":"BIOMETRIC_STAFF_ATTENDANCE_1A_BROWSER_REMOVED"}\n'); }
else setup().catch((error) => { process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`); process.exitCode = 1; });
