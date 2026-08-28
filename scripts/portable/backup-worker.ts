import { PrismaClient } from "@prisma/client";
import {
  processDueCloudBackups,
  processPendingCloudBackupRuns,
  recoverStaleCloudBackupRuns,
  retryEligibleCloudBackups
} from "@/lib/cloud-backup-worker";
import { withPostgresJobLock } from "@/lib/portable-runtime/job-lock";
import { portableLog } from "@/lib/portable-runtime/observability";

const prisma = new PrismaClient();
const rawPollMs = Number(process.env.PORTABLE_BACKUP_WORKER_POLL_MS || 60_000);
if (!Number.isInteger(rawPollMs) || rawPollMs < 5_000 || rawPollMs > 5 * 60_000) {
  throw new Error("PORTABLE_BACKUP_WORKER_POLL_INVALID");
}

let stopping = false;
process.once("SIGTERM", () => { stopping = true; });
process.once("SIGINT", () => { stopping = true; });

async function pause() {
  const started = Date.now();
  while (!stopping && Date.now() - started < rawPollMs) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(1_000, rawPollMs)));
  }
}

async function cycle() {
  return withPostgresJobLock(prisma, "cloud-backup-worker", async () => {
    const stale = await recoverStaleCloudBackupRuns(prisma);
    const retries = await retryEligibleCloudBackups(prisma);
    const due = await processDueCloudBackups(prisma);
    const pending = await processPendingCloudBackupRuns(prisma, 1);
    return { stale, retries, due, pending };
  }, { timeoutMs: 31 * 60_000, maxWaitMs: 5_000 });
}

async function main() {
  portableLog("info", "PORTABLE_BACKUP_WORKER_START", { result: "ready" });
  while (!stopping) {
    try {
      const result = await cycle();
      if (result.acquired) {
        const work = result.result;
        const workCount = work.stale.recovered + work.stale.failedClosed + work.retries.retried +
          work.due.claimedRuns + work.pending.processed;
        if (workCount > 0) portableLog("info", "PORTABLE_BACKUP_WORKER_CYCLE", { result: "processed", workCount });
      }
    } catch (error) {
      portableLog("error", "PORTABLE_BACKUP_WORKER_CYCLE_FAILED", {
        result: error instanceof Error && /^[A-Z0-9_:]+$/.test(error.message) ? error.message.split(":", 1)[0] : "FAILED_SAFE"
      });
    }
    await pause();
  }
  portableLog("info", "PORTABLE_BACKUP_WORKER_STOP", { result: "graceful" });
}

main().catch((error) => {
  portableLog("error", "PORTABLE_BACKUP_WORKER_FAILED", { result: error instanceof Error ? error.message : "FAILED_SAFE" });
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
