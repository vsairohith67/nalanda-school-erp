import type { PrismaClient } from "@prisma/client";
import { loadCloudBackupKey } from "@/lib/cloud-backup-container";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";

export async function cloudBackupHealthSummary(prisma: PrismaClient, now = new Date()) {
  const [profiles, latestAttempt, latestUploaded, latestVerified, latestRehearsal, schedules] = await Promise.all([
    prisma.cloudBackupProfile.findMany({ orderBy: { profileCode: "asc" } }),
    prisma.cloudBackupRun.findFirst({ orderBy: { createdAt: "desc" }, include: { profile: true } }),
    prisma.cloudBackupRun.findFirst({ where: { artifacts: { some: { uploadedAt: { not: null } } } }, orderBy: { createdAt: "desc" }, include: { profile: true } }),
    prisma.cloudBackupRun.findFirst({ where: { status: "VERIFIED" }, orderBy: { completedAt: "desc" }, include: { profile: true, artifacts: true } }),
    prisma.cloudBackupRestoreRehearsal.findFirst({ where: { status: "PASSED" }, orderBy: { completedAt: "desc" } }),
    prisma.cloudBackupSchedule.findMany({ include: { profile: true }, orderBy: { scheduleCode: "asc" } })
  ]);
  const active = profiles.find((row) => row.status === "ACTIVE");
  let encryptionReady = false;
  let providerReady = false;
  if (active) {
    try {
      loadCloudBackupKey(active.encryptionKeyVersion);
      encryptionReady = true;
    } catch {
      encryptionReady = false;
    }
    try {
      providerReady = (await createCloudBackupProvider(active).healthCheck()).ready;
    } catch {
      providerReady = false;
    }
  }
  const latestVerifiedAt = latestVerified?.completedAt ?? null;
  const ageHours = latestVerifiedAt ? Math.max(0, (now.getTime() - latestVerifiedAt.getTime()) / 3_600_000) : null;
  const overdueSchedules = schedules.filter((row) => row.enabled && row.nextRunAt && row.nextRunAt < now);
  let state = "HEALTHY";
  if (!active) state = "PROVIDER_DISABLED";
  else if (!encryptionReady) state = "ENCRYPTION_NOT_READY";
  else if (!providerReady) state = "PROVIDER_DISABLED";
  else if (!latestVerified) state = latestAttempt?.status === "FAILED" ? "FAILED" : "UNVERIFIED";
  else if (overdueSchedules.length) state = "OVERDUE";
  else if (!latestRehearsal) state = "NO_RESTORE_REHEARSAL";
  else if ((latestAttempt?.status === "FAILED") || schedules.some((row) => row.consecutiveFailureCount > 0)) state = "DEGRADED";
  const enabledSchedules = schedules.filter((row) => row.enabled);
  const nearestDue = enabledSchedules.map((row) => row.nextRunAt).filter(Boolean).sort((a, b) => a!.getTime() - b!.getTime())[0] ?? null;
  return {
    state,
    providerMode: active?.providerKind ?? "NONE",
    encryptionReady,
    providerReady,
    liveUseEnabled: false,
    liveProvidersDisabled: true,
    latestAttempt: publicRun(latestAttempt),
    latestUploaded: publicRun(latestUploaded),
    latestVerified: publicRun(latestVerified),
    latestPassedRestoreRehearsalAt: latestRehearsal?.completedAt ?? null,
    latestVerifiedAgeHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
    nearestDueAt: nearestDue,
    overdueScheduleCount: overdueSchedules.length,
    consecutiveFailures: schedules.reduce((maximum, row) => Math.max(maximum, row.consecutiveFailureCount), 0),
    recoveryPointGapHours: ageHours == null ? null : Number(ageHours.toFixed(2)),
    encryptedDestinationCoverage: latestVerified ? "VERIFIED_ENCRYPTED_DATABASE_BACKUP" : "NO_VERIFIED_ENCRYPTED_BACKUP",
    privateAssetCoverage: "NOT_INCLUDED",
    privateAssetMessage: "Database backup verified. Private uploaded assets are not included in this backup.",
    schedulerDeploymentRequired: true,
    schedulerMessage: "A database schedule does not run by itself; configure Windows Task Scheduler or a future protected hosting cron."
  };
}

export async function cloudBackupAggregateReport(prisma: PrismaClient, now = new Date()) {
  const [profiles, schedules, runs, artifacts, rehearsals] = await Promise.all([
    prisma.cloudBackupProfile.findMany(),
    prisma.cloudBackupSchedule.findMany(),
    prisma.cloudBackupRun.findMany(),
    prisma.cloudBackupArtifact.findMany(),
    prisma.cloudBackupRestoreRehearsal.findMany()
  ]);
  const completed = runs.filter((row) => row.completedAt && row.startedAt);
  const encrypted = artifacts.filter((row) => row.ciphertextBytes > 0);
  const verified = runs.filter((row) => row.status === "VERIFIED");
  const latest = verified.sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0))[0];
  return {
    generatedAt: now.toISOString(),
    profilesByModeStatus: group(profiles, (row) => `${row.providerKind}:${row.status}`),
    schedules: { enabled: schedules.filter((row) => row.enabled).length, disabled: schedules.filter((row) => !row.enabled).length, overdue: schedules.filter((row) => row.enabled && row.nextRunAt && row.nextRunAt < now).length },
    runsByStatus: group(runs, (row) => row.status),
    runsByTrigger: group(runs, (row) => row.triggerType),
    successfulUploads: artifacts.filter((row) => row.uploadedAt).length,
    verifiedBackups: verified.length,
    restoreRehearsals: group(rehearsals, (row) => row.status),
    latestVerifiedAgeHours: latest?.completedAt ? Number(((now.getTime() - latest.completedAt.getTime()) / 3_600_000).toFixed(2)) : null,
    averageDurationMs: completed.length ? Math.round(completed.reduce((sum, row) => sum + row.completedAt!.getTime() - row.startedAt!.getTime(), 0) / completed.length) : null,
    averageEncryptedBytes: encrypted.length ? Math.round(encrypted.reduce((sum, row) => sum + row.ciphertextBytes, 0) / encrypted.length) : null,
    averageCompressionRatio: encrypted.length ? Number((encrypted.reduce((sum, row) => sum + row.compressedBytes / row.plaintextBytes, 0) / encrypted.length).toFixed(4)) : null,
    retryCount: runs.reduce((sum, row) => sum + row.retryCount, 0),
    consecutiveFailures: schedules.reduce((maximum, row) => Math.max(maximum, row.consecutiveFailureCount), 0),
    keyVersions: group(artifacts, (row) => row.encryptionKeyVersion),
    prunedArtifacts: artifacts.filter((row) => row.status === "PRUNED").length,
    privateAssetCoverage: "NOT_INCLUDED",
    providerDistinction: { MOCK: profiles.filter((row) => row.providerKind === "MOCK").length, LOCAL_FOLDER: profiles.filter((row) => row.providerKind === "LOCAL_FOLDER").length, LIVE_DISABLED: profiles.filter((row) => ["OBJECT_STORAGE", "GOOGLE_DRIVE"].includes(row.providerKind)).length }
  };
}

export function cloudBackupReportCsv(report: Awaited<ReturnType<typeof cloudBackupAggregateReport>>) {
  const rows = [
    ["metric", "value"],
    ["generated_at_india_source", report.generatedAt],
    ["verified_backups", report.verifiedBackups],
    ["successful_uploads", report.successfulUploads],
    ["latest_verified_age_hours", report.latestVerifiedAgeHours ?? ""],
    ["average_duration_ms", report.averageDurationMs ?? ""],
    ["average_encrypted_bytes", report.averageEncryptedBytes ?? ""],
    ["average_compression_ratio", report.averageCompressionRatio ?? ""],
    ["retry_count", report.retryCount],
    ["consecutive_failures", report.consecutiveFailures],
    ["pruned_artifacts", report.prunedArtifacts],
    ["private_asset_coverage", report.privateAssetCoverage],
    ["mock_profiles", report.providerDistinction.MOCK],
    ["local_folder_profiles", report.providerDistinction.LOCAL_FOLDER],
    ["live_disabled_profiles", report.providerDistinction.LIVE_DISABLED]
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function publicRun(run: any) {
  return run ? {
    runNumber: run.runNumber,
    status: run.status,
    providerKind: run.profile?.providerKind,
    triggerType: run.triggerType,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    failureCode: run.failureCode
  } : null;
}

function group<T>(values: T[], key: (value: T) => string) {
  return values.reduce<Record<string, number>>((result, value) => {
    const name = key(value);
    result[name] = (result[name] ?? 0) + 1;
    return result;
  }, {});
}

function csvCell(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll("\"", "\"\"")}"`;
}
