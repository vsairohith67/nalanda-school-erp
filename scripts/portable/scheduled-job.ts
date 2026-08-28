import { spawn } from "node:child_process";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { withPostgresJobLock } from "@/lib/portable-runtime/job-lock";
import { portableLog } from "@/lib/portable-runtime/observability";

const JOBS = {
  "parent-meeting-reminders": { entry: "jobs/parent-meeting-reminders.mjs", args: [], maximumRuntimeMs: 300_000 },
  "support-sla-check": { entry: "jobs/support-sla-check.mjs", args: [], maximumRuntimeMs: 300_000 },
  "cloud-backup-process-due": { entry: "jobs/cloud-backup-process-due.mjs", args: ["process-due"], maximumRuntimeMs: 1_800_000 }
} as const;

const jobId = process.argv[2] as keyof typeof JOBS;
const job = JOBS[jobId];
if (!job) throw new Error("PORTABLE_SCHEDULED_JOB_INVALID");
const TERMINATION_GRACE_MS = 15_000;

function execute() {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve("dist", "portable", job.entry), ...job.args], { stdio: "inherit", env: process.env, windowsHide: true });
    let timedOut = false;
    let killTimeout: NodeJS.Timeout | undefined;
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      killTimeout = setTimeout(() => child.kill("SIGKILL"), TERMINATION_GRACE_MS);
    }, job.maximumRuntimeMs);
    child.once("error", (error) => {
      clearTimeout(timeout);
      if (killTimeout) clearTimeout(killTimeout);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timeout);
      if (killTimeout) clearTimeout(killTimeout);
      if (timedOut) reject(new Error("PORTABLE_SCHEDULED_JOB_TIMEOUT"));
      else if (code === 0) resolve();
      else reject(new Error("PORTABLE_SCHEDULED_JOB_FAILED"));
    });
  });
}

const prisma = new PrismaClient();
withPostgresJobLock(prisma, jobId, async () => {
  portableLog("info", "PORTABLE_SCHEDULED_JOB_START", { jobId });
  await execute();
  portableLog("info", "PORTABLE_SCHEDULED_JOB_COMPLETE", { jobId, result: "success" });
}, { timeoutMs: job.maximumRuntimeMs + TERMINATION_GRACE_MS + 5_000 }).then((result) => {
  if (!result.acquired) throw new Error("PORTABLE_SCHEDULED_JOB_LOCK_CONTENDED");
}).catch((error) => {
  portableLog("error", "PORTABLE_SCHEDULED_JOB_FAILED", { jobId, result: error instanceof Error ? error.message : "unknown" });
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
