import { prisma } from "../lib/prisma";
import { cloudBackupHealthSummary, cloudBackupAggregateReport } from "../lib/cloud-backup-reports";
import {
  createManualCloudBackupRun,
  executeCloudBackupRun,
  processDueCloudBackups,
  recoverStaleCloudBackupRuns,
  retryEligibleCloudBackups
} from "../lib/cloud-backup-worker";
import { verifyStoredCloudBackupArtifact } from "../lib/cloud-backup-verification";
import { runCloudBackupRestoreRehearsal } from "../lib/cloud-backup-rehearsal";
import { previewCloudBackupRetention, pruneCloudBackupRetention } from "../lib/cloud-backup-retention";
import { cleanupStaleCloudBackupTempFiles } from "../lib/cloud-backup-temp";

async function main() {
  const command = process.argv[2];
  if (command === "health") {
    console.log(JSON.stringify(await cloudBackupHealthSummary(prisma), null, 2));
    return;
  }
  if (command === "inspect") {
    const [profiles, schedules, runs, artifacts, rehearsals, events, report] = await Promise.all([
      prisma.cloudBackupProfile.count(), prisma.cloudBackupSchedule.count(), prisma.cloudBackupRun.count(),
      prisma.cloudBackupArtifact.count(), prisma.cloudBackupRestoreRehearsal.count(), prisma.cloudBackupEvent.count(),
      cloudBackupAggregateReport(prisma)
    ]);
    console.log(JSON.stringify({ profiles, schedules, runs, artifacts, rehearsals, events, report, secretsStored: false, liveNetworkEnabled: false }, null, 2));
    return;
  }
  if (command === "process-due") {
    const stale = await recoverStaleCloudBackupRuns(prisma);
    const retries = await retryEligibleCloudBackups(prisma);
    const due = await processDueCloudBackups(prisma);
    console.log(JSON.stringify({ stale, retries, due }, null, 2));
    return;
  }
  if (command === "cleanup-temp") {
    console.log(JSON.stringify(await cleanupStaleCloudBackupTempFiles(), null, 2));
    return;
  }
  const profile = await activeProfile();
  if (command === "run-now") {
    const run = await createManualCloudBackupRun(prisma, profile.id);
    console.log(JSON.stringify(await executeCloudBackupRun(prisma, run.id), null, 2));
    return;
  }
  if (command === "verify") {
    const artifact = await latestArtifact(profile.id);
    console.log(JSON.stringify(await verifyStoredCloudBackupArtifact(prisma, artifact.id), null, 2));
    return;
  }
  if (command === "rehearse") {
    const artifact = await prisma.cloudBackupArtifact.findFirst({ where: { run: { profileId: profile.id, status: "VERIFIED" }, status: "VERIFIED" }, orderBy: { verifiedAt: "desc" } });
    if (!artifact) throw new Error("No VERIFIED artifact is available for rehearsal.");
    console.log(JSON.stringify(await runCloudBackupRestoreRehearsal(prisma, artifact.id), null, 2));
    return;
  }
  if (command === "retention-preview") {
    console.log(JSON.stringify(await previewCloudBackupRetention(prisma, profile.id), null, 2));
    return;
  }
  if (command === "prune") {
    if (new Set(["synthetic-staging", "staging", "production"]).has((process.env.NALANDA_ENVIRONMENT || "").toLowerCase())) {
      throw new Error("PORTABLE_RETENTION_PLAN_REQUIRED");
    }
    console.log(JSON.stringify(await pruneCloudBackupRetention(prisma, profile.id), null, 2));
    return;
  }
  throw new Error("Unsupported cloud backup command.");
}

async function activeProfile() {
  const profile = await prisma.cloudBackupProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { profileCode: "asc" } });
  if (!profile) throw new Error("No active permitted backup profile is configured.");
  return profile;
}

async function latestArtifact(profileId: string) {
  const artifact = await prisma.cloudBackupArtifact.findFirst({ where: { run: { profileId }, status: { not: "PRUNED" } }, orderBy: { createdAt: "desc" } });
  if (!artifact) throw new Error("No encrypted artifact is available.");
  return artifact;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Cloud backup command failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
