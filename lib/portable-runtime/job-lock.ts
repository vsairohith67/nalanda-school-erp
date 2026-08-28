import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";

const JOB_ID = /^[a-z][a-z0-9.-]{2,80}$/;

export type PortableJobLockResult<T> =
  | { acquired: true; ownerToken: string; result: T }
  | { acquired: false; ownerToken: null; reason: "LOCK_CONTENDED" };

export async function withPostgresJobLock<T>(
  client: PrismaClient,
  jobId: string,
  operation: (transaction: Prisma.TransactionClient, ownerToken: string) => Promise<T>,
  options: { timeoutMs?: number; maxWaitMs?: number } = {}
): Promise<PortableJobLockResult<T>> {
  if (!JOB_ID.test(jobId)) throw new Error("PORTABLE_JOB_ID_INVALID");
  if ((process.env.DATABASE_PROVIDER || "sqlite").toLowerCase() !== "postgresql") throw new Error("PORTABLE_JOB_LOCK_REQUIRES_POSTGRESQL");
  const timeout = options.timeoutMs ?? 5 * 60_000;
  const maxWait = options.maxWaitMs ?? 5_000;
  if (!Number.isSafeInteger(timeout) || timeout < 1_000 || timeout > 31 * 60_000) throw new Error("PORTABLE_JOB_TIMEOUT_INVALID");
  if (!Number.isSafeInteger(maxWait) || maxWait < 100 || maxWait > 30_000) throw new Error("PORTABLE_JOB_MAX_WAIT_INVALID");
  const ownerToken = randomUUID();
  return client.$transaction(async (transaction) => {
    const rows = await transaction.$queryRawUnsafe<Array<{ acquired: boolean }>>(
      "SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired",
      `nalanda-portable-job:${jobId}`
    );
    if (!rows[0]?.acquired) return { acquired: false, ownerToken: null, reason: "LOCK_CONTENDED" } as const;
    return { acquired: true, ownerToken, result: await operation(transaction, ownerToken) } as const;
  }, { timeout, maxWait });
}
