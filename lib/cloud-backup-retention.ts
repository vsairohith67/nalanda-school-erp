import type { PrismaClient } from "@prisma/client";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";

type RetentionRun = { id: string; completedAt: Date | null; createdAt: Date };
type RetentionPolicyShape = {
  keepLatestVerifiedCount: number;
  keepDailyDays: number;
  keepWeeklyWeeks: number;
  keepMonthlyMonths: number;
};

export function protectedCloudBackupRunReasons(
  verifiedRunsNewestFirst: RetentionRun[],
  policy: RetentionPolicyShape,
  now = new Date()
) {
  const reasons = new Map<string, Set<string>>();
  const protect = (runId: string, reason: string) => {
    const current = reasons.get(runId) ?? new Set<string>();
    current.add(reason);
    reasons.set(runId, current);
  };
  for (const run of verifiedRunsNewestFirst.slice(0, Math.max(2, policy.keepLatestVerifiedCount))) protect(run.id, "LATEST_VERIFIED");

  const dailyBuckets = new Set<number>(), weeklyBuckets = new Set<number>(), monthlyBuckets = new Set<number>();
  const nowLocal = indiaCalendarParts(now);
  const nowDay = daySerial(nowLocal);
  const nowWeek = nowDay - ((nowLocal.weekday + 6) % 7);
  const nowMonth = nowLocal.year * 12 + nowLocal.month - 1;
  for (const run of verifiedRunsNewestFirst) {
    const local = indiaCalendarParts(run.completedAt ?? run.createdAt);
    const runDay = daySerial(local);
    const daysAgo = nowDay - runDay;
    if (policy.keepDailyDays > 0 && daysAgo >= 0 && daysAgo < policy.keepDailyDays && !dailyBuckets.has(runDay)) {
      dailyBuckets.add(runDay); protect(run.id, "DAILY_RECOVERY_POINT");
    }
    const runWeek = runDay - ((local.weekday + 6) % 7);
    const weeksAgo = Math.floor((nowWeek - runWeek) / 7);
    if (policy.keepWeeklyWeeks > 0 && weeksAgo >= 0 && weeksAgo < policy.keepWeeklyWeeks && !weeklyBuckets.has(runWeek)) {
      weeklyBuckets.add(runWeek); protect(run.id, "WEEKLY_RECOVERY_POINT");
    }
    const runMonth = local.year * 12 + local.month - 1;
    const monthsAgo = nowMonth - runMonth;
    if (policy.keepMonthlyMonths > 0 && monthsAgo >= 0 && monthsAgo < policy.keepMonthlyMonths && !monthlyBuckets.has(runMonth)) {
      monthlyBuckets.add(runMonth); protect(run.id, "MONTHLY_RECOVERY_POINT");
    }
  }
  return reasons;
}

export async function previewCloudBackupRetention(prisma: PrismaClient, profileId: string) {
  const profile = await prisma.cloudBackupProfile.findUnique({
    where: { id: profileId },
    include: {
      retentionPolicy: true,
      runs: {
        include: {
          artifacts: true,
          restoreRehearsals: { where: { status: { in: ["PENDING", "DOWNLOADING", "DECRYPTING", "VALIDATING", "RESTORING_FIRST_PASS", "RESTORING_SECOND_PASS", "VERIFYING", "PASSED"] } } }
        },
        orderBy: { completedAt: "desc" }
      }
    }
  });
  if (!profile?.retentionPolicy) throw new Error("Cloud backup retention policy was not found.");
  const policy = profile.retentionPolicy;
  const verified = profile.runs.filter((run) => run.status === "VERIFIED" && run.artifacts.some((artifact) => artifact.status === "VERIFIED"));
  const protectionReasons = protectedCloudBackupRunReasons(verified, policy);
  for (const run of verified) {
    if (policy.preserveRestoreRehearsalSources && run.restoreRehearsals.length) {
      const reasons = protectionReasons.get(run.id) ?? new Set<string>();
      reasons.add("RESTORE_REHEARSAL_SOURCE");
      protectionReasons.set(run.id, reasons);
    }
  }
  const rows = profile.runs.flatMap((run) => run.artifacts.map((artifact) => {
    const protectedBackup = protectionReasons.has(run.id);
    const eligible = run.status === "VERIFIED" && artifact.status === "VERIFIED" && !protectedBackup;
    return {
      runId: run.id,
      runNumber: run.runNumber,
      artifactId: artifact.id,
      objectKeySafe: artifact.objectKeySafe,
      providerKind: profile.providerKind,
      createdAt: artifact.createdAt,
      verified: run.status === "VERIFIED" && artifact.status === "VERIFIED",
      rehearsalSource: run.restoreRehearsals.length > 0,
      retainedReason: protectedBackup ? [...protectionReasons.get(run.id)!].join(", ") : eligible ? null : "NOT_VERIFIED_OR_ALREADY_PRUNED",
      eligibleReason: eligible ? "OUTSIDE_RETENTION_PROTECTION" : null,
      eligible
    };
  }));
  const postPruneVerifiedCopyCount = verified.filter((run) => protectionReasons.has(run.id)).length;
  return {
    profileId,
    policy: {
      autoPruneEnabled: policy.autoPruneEnabled,
      keepLatestVerifiedCount: policy.keepLatestVerifiedCount,
      keepDailyDays: policy.keepDailyDays,
      keepWeeklyWeeks: policy.keepWeeklyWeeks,
      keepMonthlyMonths: policy.keepMonthlyMonths,
      minimumVerifiedCopies: policy.minimumVerifiedCopies
    },
    rows,
    postPruneVerifiedCopyCount,
    canPrune: postPruneVerifiedCopyCount >= policy.minimumVerifiedCopies
  };
}

export async function pruneCloudBackupRetention(prisma: PrismaClient, profileId: string, actorUserId?: string) {
  const preview = await previewCloudBackupRetention(prisma, profileId);
  const profile = await prisma.cloudBackupProfile.findUniqueOrThrow({ where: { id: profileId }, include: { retentionPolicy: true } });
  if (!profile.retentionPolicy?.autoPruneEnabled) throw new Error("Automatic pruning is disabled.");
  const latestRun = await prisma.cloudBackupRun.findFirst({ where: { profileId }, orderBy: { createdAt: "desc" } });
  if (!latestRun || latestRun.status !== "VERIFIED") throw new Error("The latest backup run is not VERIFIED; pruning is blocked.");
  if (!preview.canPrune) throw new Error("Minimum verified-copy protection blocks pruning.");
  const provider = createCloudBackupProvider(profile);
  const health = await provider.healthCheck();
  if (!health.ready) throw new Error("Provider health check blocks pruning.");
  const pruned: string[] = [];
  for (const candidate of preview.rows.filter((row) => row.eligible)) {
    const current = await prisma.cloudBackupArtifact.findUnique({ where: { id: candidate.artifactId } });
    if (!current || current.status === "PRUNED") continue;
    if (current.objectKeySafe !== candidate.objectKeySafe) throw new Error("Exact object identity changed; pruning is blocked.");
    await provider.deleteObject(current.objectKeySafe);
    await prisma.$transaction([
      prisma.cloudBackupArtifact.update({ where: { id: current.id }, data: { status: "PRUNED", prunedAt: new Date() } }),
      prisma.cloudBackupEvent.create({ data: {
        profileId, runId: current.runId, artifactId: current.id,
        eventType: "RETENTION_PRUNED",
        safeMetadataJson: JSON.stringify({ exactObjectIdentity: current.objectKeySafe }),
        recordedByUserId: actorUserId
      } })
    ]);
    pruned.push(current.id);
  }
  return { prunedCount: pruned.length, artifactIds: pruned };
}

function indiaCalendarParts(date: Date) {
  const shifted = new Date(date.getTime() + 330 * 60_000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay()
  };
}

function daySerial(value: { year: number; month: number; day: number }) {
  return Math.floor(Date.UTC(value.year, value.month - 1, value.day) / 86_400_000);
}
