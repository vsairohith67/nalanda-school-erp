import { randomBytes, randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createManualCloudBackupRun, executeCloudBackupRun, processDueCloudBackups, recoverStaleCloudBackupRuns, retryEligibleCloudBackups } from "../lib/cloud-backup-worker";
import { createCloudBackupProvider } from "../lib/cloud-backup-provider";
import { configureMockCloudBackupOutcome, resetMockCloudBackupStorage } from "../lib/cloud-backup-provider-mock";
import { decryptCloudBackup, encryptCloudBackup } from "../lib/cloud-backup-container";
import { verifyStoredCloudBackupArtifact } from "../lib/cloud-backup-verification";
import { cloudBackupHealthSummary } from "../lib/cloud-backup-reports";
import { parseAndValidateBackup } from "../lib/restore";
import { restoreValidatedBackup } from "../lib/restore-database";
import { validatePaymentPayload } from "../lib/validation";
import { portableMetricsText } from "../lib/portable-runtime/observability";
import { getTechnicalOperationsDashboard } from "../lib/technical-operations";

// These clients always receive newly allocated explicit URLs. Never import lib/prisma,
// copy a database, run the operational rehearsal helper, or invoke a live adapter.
const postgres = process.env.DATABASE_PROVIDER === "postgresql";
const originalUrl = process.env.DATABASE_URL;
let root: string;
let source: PrismaClient, target: PrismaClient, sibling: PrismaClient;
const key = randomBytes(32);
const clients: PrismaClient[] = [];
const now = new Date("2026-10-04T10:00:00Z");
let bytes: Buffer, artifact: any, backup: ReturnType<typeof parseAndValidateBackup>;
let profile: any;
async function database(label: string) {
  const directory = path.join(root, label); await mkdir(directory);
  let url = "file:" + path.join(directory, "synthetic.db").replaceAll("\\", "/");
  if (postgres) {
    if (process.env.CI !== "true" || process.env.POSTGRES_READINESS_SYNTHETIC_QA !== "1" || !originalUrl) throw Error("EPHEMERAL_CI_POSTGRES_REQUIRED");
    const connection = new URL(originalUrl); connection.searchParams.set("schema", "operations_" + label + "_" + randomUUID().replaceAll("-", "")); url = connection.toString();
    execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "migrate", "deploy", "--schema", "prisma/postgresql/schema.prisma"], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: "pipe", windowsHide: true, timeout: 60000 });
  } else {
    const file = path.join(directory, "synthetic.db");
    await writeFile(file, "", { flag: "wx", mode: 0o600 });
    // Apply the real committed SQLite migrations to each exclusive empty fixture.
    // Repeated CLI launches timed out during combined Windows execution. The
    // release prelude separately exercises actual fresh Prisma migration deploy.
    const sql = new DatabaseSync(file);
    try {
      const migrations = readdirSync("prisma/migrations", { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
      for (const migration of migrations) sql.exec(readFileSync(path.join("prisma/migrations", migration, "migration.sql"), "utf8"));
      expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);
    } finally { sql.close(); }
  }
  const client = new PrismaClient({ datasourceUrl: url }); clients.push(client);
  if (label === "source") vi.stubEnv("DATABASE_URL", url);
  await client.user.create({ data: { id: "synthetic-operations-actor", username: "synthetic-operations-actor", name: "SYNTHETIC Operations Actor", role: "DIRECTOR", passwordHash: "SYNTHETIC-NONLOGIN", isActive: false } });
  return client;
}
const studentFixture = { id: "synthetic-operations-student", admissionNo: "SYNTHETIC-OPERATIONS-001", studentName: "SYNTHETIC Invented Learner", className: "II", phone1: "NO-CONTACT", fatherName: "SYNTHETIC Invented Parent", academicYear: "2026-27" };
async function businessReadback(client: PrismaClient) {
  return {
    students: await client.student.findMany({ select: { admissionNo: true, studentName: true, className: true, phone1: true }, orderBy: { admissionNo: "asc" } }),
    enrollments: (await client.academicYearEnrollment.findMany({ select: { student: { select: { admissionNo: true } }, academicYear: true, className: true, status: true }, orderBy: { academicYear: "asc" } })).map(({student,...row}) => ({...row, studentAdmissionNo: student.admissionNo})),
    payments: (await client.payment.findMany({ select: { student: { select: { admissionNo: true } }, receiptNo: true, amountPaid: true, isCancelled: true }, orderBy: { receiptNo: "asc" } })).map(({student,...row}) => ({...row, studentAdmissionNo: student?.admissionNo ?? null})),
    lifecycle: (await client.studentLifecycleEvent.findMany({ select: { student: { select: { admissionNo: true } }, eventType: true, fromClass: true, toClass: true }, orderBy: { eventType: "asc" } })).map(({student,...row}) => ({...row, studentAdmissionNo: student.admissionNo}))
  };
}
// Independent literal business/reference expectations: restore legitimately maps
// local Student IDs by admission number. Every dependent FK is read through its
// actual local relation rather than demanding copied source identifiers.
const expected = {
  students: [{ admissionNo: "SYNTHETIC-OPERATIONS-001", studentName: "SYNTHETIC Invented Learner", className: "II", phone1: "NO-CONTACT" }],
  enrollments: [{ studentAdmissionNo: "SYNTHETIC-OPERATIONS-001", academicYear: "2025-26", className: "I", status: "PROMOTED" }, { studentAdmissionNo: "SYNTHETIC-OPERATIONS-001", academicYear: "2026-27", className: "II", status: "ACTIVE" }],
  payments: [{ studentAdmissionNo: "SYNTHETIC-OPERATIONS-001", receiptNo: "SYNTHETIC-OPS-R1", amountPaid: 125.5, isCancelled: false }],
  lifecycle: [{ studentAdmissionNo: "SYNTHETIC-OPERATIONS-001", eventType: "PROMOTED", fromClass: "I", toClass: "II" }]
};
const metric = (name: string) => Number(portableMetricsText().match(new RegExp(`^${name} (\\d+)$`, "m"))?.[1] ?? 0);
beforeAll(async () => {
  await mkdir(path.resolve("tmp"), { recursive: true });
  root = await realpath(await mkdtemp(path.resolve("tmp", "preview-operations-backup-")));
  vi.stubEnv("NALANDA_ENVIRONMENT", "test"); vi.stubEnv("CLOUD_BACKUP_LOCAL_FOLDER", path.join(root, "encrypted"));
  vi.stubEnv("CLOUD_BACKUP_ENCRYPTION_KEY_V1", key.toString("base64")); vi.stubEnv("PORTABLE_STRUCTURED_LOGGING", "true");
  vi.stubEnv("BACKUP_DIRECTORY", path.join(root, "empty-logical-backups"));
  for (const variable of ["ADMISSIONS_PRIVATE_STORAGE_ROOT", "ONBOARDING_STORAGE_ROOT", "PAYSLIP_PRIVATE_STORAGE_ROOT", "CLOUD_BACKUP_TEMP_DIR"]) vi.stubEnv(variable, path.join(root, variable.toLowerCase()));
  source = await database("source");
}, 120000);
// Each PostgreSQL migration retains its original 60s child limit; both providers
// retain separate 120s hooks so setup cannot race aggregate-hook cleanup.
beforeAll(async () => { target = await database("target"); }, 120000);
beforeAll(async () => { sibling = await database("sibling"); }, 120000);
beforeAll(async () => {
  await source.student.create({ data: studentFixture });
  for (const {studentAdmissionNo: _reference, ...enrollment} of expected.enrollments) await source.academicYearEnrollment.create({ data: {...enrollment, studentId: studentFixture.id} });
  await source.studentLifecycleEvent.create({ data: { studentId: studentFixture.id, eventType: "PROMOTED", fromClass: "I", toClass: "II", academicYear: "2026-27", effectiveDate: new Date("2026-06-01Z") } });
  await source.payment.create({ data: { ...validatePaymentPayload({receiptNo: "SYNTHETIC-OPS-R1", amountPaid: 125.5, date: "2026-06-02", admissionNo: studentFixture.admissionNo, paymentMode: "Cash", receivedAccount: "Cash", feeType: "Current Year Fee"}), studentId: studentFixture.id, studentName: studentFixture.studentName, className: "II" } });
  profile = await source.cloudBackupProfile.create({ data: { profileCode: "SYNTHETIC-OPS-LOCAL", name: "SYNTHETIC local recovery", providerKind: "LOCAL_FOLDER", status: "ACTIVE", liveUseEnabled: false, destinationLabel: "SYNTHETIC task-owned files", encryptionKeyVersion: "V1" } });
}, 120000);
afterAll(async () => {
  resetMockCloudBackupStorage(); await Promise.all(clients.map(client => client.$disconnect())); vi.unstubAllEnvs();
  if (root) { const stat = await lstat(root); expect(stat.isSymbolicLink()).toBe(false); expect(await realpath(root)).toBe(root); expect(root.startsWith(path.resolve("tmp", "preview-operations-backup-") )).toBe(true); await rm(root, { recursive: true }); }
});
describe("actual isolated encrypted worker backup and reference restore", () => {
  it("keeps missing backup/recovery evidence unverified through the real health summary", async () => {
    const summary = await cloudBackupHealthSummary(source, now);
    expect(summary.state).toBe("UNVERIFIED");
    expect(summary.latestVerifiedAgeHours).toBeNull();
    expect(summary.latestPassedRestoreRehearsalAt).toBeNull();
    expect(summary.encryptedDestinationCoverage).toBe("NO_VERIFIED_ENCRYPTED_BACKUP");
  });
  it("backs up nonempty related history to bounded encrypted files and binds v48 metadata consistently", async () => {
    const logs: string[] = []; const log = vi.spyOn(console, "log").mockImplementation(value => logs.push(String(value)));
    try {
      const successes = metric("nalanda_backup_success_total");
      const run = await createManualCloudBackupRun(source, profile.id, "synthetic-operations-actor");
      const completed = await executeCloudBackupRun(source, run.id);
      expect(completed.status, completed.failureCode ?? "no failure code").toBe("VERIFIED"); artifact = await source.cloudBackupArtifact.findFirstOrThrow({ where: {runId: run.id}, orderBy: {createdAt: "desc"} });
      expect(completed.sourceBackupVersion).toBe(48);
      bytes = await createCloudBackupProvider(profile).getObject(artifact.objectKeySafe);
      expect(bytes.length).toBeGreaterThan(500); expect(bytes.length).toBeLessThan(1024 * 1024);
      expect(bytes.toString("utf8")).not.toContain(expected.students[0].studentName);
      const decrypted = await decryptCloudBackup(bytes, { key });
      expect(decrypted.header.backupFormatVersion).toBe(48);
      expect(decrypted.header.ciphertextSha256).toBe(artifact.ciphertextSha256);
      backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
      expect(backup.metadata.backupVersion).toBe(48); expect(artifact.privateAssetsIncluded).toBe(false);
      expect(JSON.stringify(backup)).not.toContain("SYNTHETIC-NONLOGIN");
      expect(await businessReadback(source)).toEqual(expected);
      expect((await verifyStoredCloudBackupArtifact(source, artifact.id)).verified).toBe(true);
      expect(metric("nalanda_backup_success_total")).toBe(successes + 1);
      await executeCloudBackupRun(source, run.id); expect(metric("nalanda_backup_success_total")).toBe(successes + 1);
      expect(logs.some(line => JSON.parse(line).safeCode === "PORTABLE_BACKUP_VERIFIED")).toBe(true);
      expect(logs.join("\n")).not.toMatch(/SYNTHETIC Invented|NO-CONTACT|cloud-backup\/|125\.5|SYNTHETIC-OPS-R1/);
    } finally { log.mockRestore(); }
  });
  it("restores through the real parser and database service into two fresh targets and repeats without duplicates", async () => {
    expect(backup).toBeDefined(); const before = await businessReadback(source);
    const actor = { id: "synthetic-operations-actor", name: "SYNTHETIC Operations Actor" };
    for (const client of [target, sibling]) {
      expect(await client.student.count()).toBe(0);
      for (let pass = 0; pass < 2; pass++) {
        const result = await restoreValidatedBackup(client, backup, actor);
        const errors = Object.values(result).flatMap(value => value && typeof value === "object" && "errors" in value ? (value as { errors: string[] }).errors : []);
        expect(errors).toEqual([]); expect(await businessReadback(client)).toEqual(expected);
      }
    }
    const localIds = await Promise.all([source, target, sibling].map(client => client.student.findUniqueOrThrow({where: {admissionNo: studentFixture.admissionNo},select: {id: true}})));
    expect(new Set(localIds.map(row => row.id)).size).toBe(3);
    await target.student.create({ data: { admissionNo: "SYNTHETIC-ONLY-TARGET", studentName: "SYNTHETIC Isolated", fatherName: "SYNTHETIC", phone1: "NO-CONTACT", className: "I" } });
    expect(await sibling.student.findUnique({ where: { admissionNo: "SYNTHETIC-ONLY-TARGET" } })).toBeNull();
    expect(await businessReadback(source)).toEqual(before);
  });
  it("consumes verified worker history in Technical Operations while keeping restore proof and stale backup independent", async () => {
    const time = new Date();
    const dashboard = await getTechnicalOperationsDashboard(source, { summaryOnly: true, now: time });
    const card = dashboard.domains.find(row => row.domain === "DATA_PROTECTION_HEALTH")!;
    expect(card.metrics.find(row => row.label === "Latest backup age")).toMatchObject({ status: "HEALTHY", value: "0 hours" });
    expect(card.metrics.find(row => row.label === "Restore rehearsal age")).toMatchObject({ status: "WARNING", value: "Not stored" });
    expect(card.metrics.find(row => row.label === "Backup format")?.value).toBe("Version 48");
    const stale = await getTechnicalOperationsDashboard(source, { summaryOnly: true, now: new Date(time.getTime() + 169 * 3600000) });
    expect(stale.domains.find(row => row.domain === "DATA_PROTECTION_HEALTH")!.metrics.find(row => row.label === "Latest backup age")?.status).toBe("WARNING");
    expect(JSON.stringify(card)).not.toMatch(/SYNTHETIC Invented|NO-CONTACT|cloud-backup\/|125\.5|SYNTHETIC-OPS-R1/);
  });
  it("refuses wrong key, tampered/truncated ciphertext, manifest mismatch and unsupported payload before a target is accepted", async () => {
    expect(bytes).toBeDefined(); const before = await businessReadback(sibling);
    await expect(decryptCloudBackup(bytes, { key: randomBytes(32) })).rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
    const changed = Buffer.from(bytes); changed[changed.length - 1] ^= 1;
    await expect(decryptCloudBackup(changed, { key })).rejects.toThrow();
    await expect(decryptCloudBackup(bytes.subarray(0, bytes.length - 13), { key })).rejects.toThrow();
    await source.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { ciphertextSha256: "0".repeat(64) } });
    expect(await verifyStoredCloudBackupArtifact(source, artifact.id)).toMatchObject({ verified: false, failureCode: "CIPHERTEXT_HASH_MISMATCH" });
    await source.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { ciphertextSha256: artifact.ciphertextSha256 } });
    expect((await verifyStoredCloudBackupArtifact(source, artifact.id)).verified).toBe(true);
    const future = structuredClone(backup); future.metadata.backupVersion = 49 as never;
    const encrypted = await encryptCloudBackup(Buffer.from(JSON.stringify(future)), { backupFormatVersion: 49, createdAt: now, encryptionKeyVersion: "V1", key });
    const decrypted = await decryptCloudBackup(encrypted.bytes, { key });
    expect(() => parseAndValidateBackup(decrypted.plaintext.toString("utf8"))).toThrow("BACKUP_SOURCE_CONTRACT_UNSUPPORTED");
    await expect(createCloudBackupProvider(profile).getObject("cloud-backup/foreign/foreign.npsbackup")).rejects.toMatchObject({ code: "OBJECT_KEY_INVALID" });
    expect(await businessReadback(sibling)).toEqual(before);
  });
  it("records provider-construction failure durably instead of stranding the claim, and emits only finite failure signals", async () => {
    const invalid = await source.cloudBackupProfile.create({ data: { profileCode: "SYNTHETIC-OPS-INVALID", name: "SYNTHETIC invalid", providerKind: "LOCAL_FOLDER", status: "ACTIVE", destinationLabel: "SYNTHETIC", encryptionKeyVersion: "V1" } });
    const run = await createManualCloudBackupRun(source, invalid.id);
    await source.cloudBackupProfile.update({ where: { id: invalid.id }, data: { providerKind: "UNSUPPORTED" } });
    const logs: string[] = []; const log = vi.spyOn(console, "error").mockImplementation(value => logs.push(String(value)));
    try {
      const failures = metric("nalanda_backup_failure_total");
      const result = await executeCloudBackupRun(source, run.id);
      expect(result).toMatchObject({ status: "FAILED", failureCode: "PROVIDER_UNSUPPORTED", nextRetryAt: null });
      expect(metric("nalanda_backup_failure_total")).toBe(failures + 1);
      expect(logs.map(line => JSON.parse(line).safeCode)).toContain("PORTABLE_BACKUP_FAILED");
      expect(logs.join("\n")).not.toContain(run.id); expect(logs.join("\n")).not.toContain(invalid.id);
    } finally { log.mockRestore(); }
    expect((await source.cloudBackupRun.findUniqueOrThrow({ where: { id: run.id } })).status).toBe("FAILED");
    await source.cloudBackupProfile.update({ where: { id: invalid.id }, data: { providerKind: "LOCAL_FOLDER", status: "PAUSED" } });
  });
  it("tests mocked upload refusal/retry without losing the real file-backed recoverable copy", async () => {
    const originalDigest = createHash("sha256").update(await createCloudBackupProvider(profile).getObject(artifact.objectKeySafe)).digest("hex");
    const mock = await source.cloudBackupProfile.create({ data: { profileCode: "SYNTHETIC-OPS-MOCK", name: "SYNTHETIC mock failure injection", providerKind: "MOCK", status: "ACTIVE", destinationLabel: "SYNTHETIC in-memory", encryptionKeyVersion: "V1" } });
    for (const outcome of ["PERMANENT_UPLOAD_FAILURE", "TRUNCATED_READBACK", "CORRUPT_CIPHERTEXT", "TRANSIENT_UPLOAD_FAILURE"] as const) {
      configureMockCloudBackupOutcome(outcome);
      const run = await createManualCloudBackupRun(source, mock.id);
      const result = await executeCloudBackupRun(source, run.id); expect(result.status).toBe("FAILED");
      if (outcome === "TRANSIENT_UPLOAD_FAILURE") {
        expect(result.nextRetryAt).not.toBeNull();
        const time = new Date(result.nextRetryAt!.getTime() + 1); configureMockCloudBackupOutcome("SUCCESS");
        const retry = await retryEligibleCloudBackups(source, time); expect(retry.retried).toBe(1);
        expect((await source.cloudBackupRun.findUniqueOrThrow({ where: { id: retry.runIds[0] } })).status).toBe("VERIFIED");
        expect((await retryEligibleCloudBackups(source, time)).retried).toBe(0);
      } else expect(result.nextRetryAt).toBeNull();
    }
    expect(createHash("sha256").update(await createCloudBackupProvider(profile).getObject(artifact.objectKeySafe)).digest("hex")).toBe(originalDigest);
    resetMockCloudBackupStorage(); await source.cloudBackupProfile.update({ where: { id: mock.id }, data: { status: "PAUSED" } });
  });
  it("claims one scheduled run for its exact fixture due time and retains uncertain upload without automatic retry", async () => {
    const schedule = await source.cloudBackupSchedule.create({ data: { scheduleCode: "SYNTHETIC-OPS-SCHEDULE", profileId: profile.id, frequency: "DAILY", hourOfDay: 15, minuteOfHour: 30, enabled: true, nextRunAt: now } });
    expect((await processDueCloudBackups(source, now)).claimedRuns).toBe(1);
    expect((await processDueCloudBackups(source, now)).claimedRuns).toBe(0);
    const uncertain = await createManualCloudBackupRun(source, profile.id);
    await source.cloudBackupRun.update({ where: { id: uncertain.id }, data: { status: "UPLOADING", startedAt: new Date(now.getTime() - 7200000), encryptedBytes: bytes.length } });
    await source.cloudBackupArtifact.create({ data: { runId: uncertain.id, artifactType: "DATABASE_BACKUP", status: "ENCRYPTED", objectKeySafe: `cloud-backup/${uncertain.id}/${randomBytes(13).toString("hex")}.npsbackup`, encryptionKeyVersion: "V1", plaintextSha256: artifact.plaintextSha256, ciphertextSha256: artifact.ciphertextSha256, plaintextBytes: artifact.plaintextBytes, compressedBytes: artifact.compressedBytes, ciphertextBytes: artifact.ciphertextBytes, sourceCoverageJson: artifact.sourceCoverageJson } });
    const recovered = await recoverStaleCloudBackupRuns(source, now);
    expect(recovered.failedRunIds).toContain(uncertain.id);
    expect(await source.cloudBackupRun.findUniqueOrThrow({ where: { id: uncertain.id } })).toMatchObject({ status: "FAILED", failureCode: "STALE_UPLOAD_STATE_UNCERTAIN", nextRetryAt: null });
    await source.cloudBackupSchedule.update({ where: { id: schedule.id }, data: { nextRunAt: new Date(now.getTime() - 60000) } });
    const summary = await cloudBackupHealthSummary(source, now);
    expect(summary.state).toBe("OVERDUE"); expect(summary.overdueScheduleCount).toBe(1); expect(summary.privateAssetCoverage).toBe("NOT_INCLUDED");
    expect(summary.latestPassedRestoreRehearsalAt).toBeNull();
  });
});
