import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { prisma } from "../lib/prisma";
import { restoreFeeRegisterOcrData } from "../lib/fee-register-ocr-restore";
import { emptyEntityResult, parseAndValidateBackup } from "../lib/restore";

const OCR_KEYS = [
  "feeRegisterOcrProfiles",
  "feeRegisterOcrBatches",
  "feeRegisterOcrPages",
  "feeRegisterOcrRows",
  "feeRegisterOcrRowRevisions",
  "feeRegisterOcrPostingRuns",
  "feeRegisterOcrEvents"
] as const;

function makeResult() {
  return {
    feeRegisterOcrProfiles: emptyEntityResult(),
    feeRegisterOcrBatches: emptyEntityResult(),
    feeRegisterOcrPages: emptyEntityResult(),
    feeRegisterOcrRows: emptyEntityResult(),
    feeRegisterOcrRowRevisions: emptyEntityResult(),
    feeRegisterOcrPostingRuns: emptyEntityResult(),
    feeRegisterOcrEvents: emptyEntityResult(),
    warnings: [] as string[]
  };
}

function summarize(result: ReturnType<typeof makeResult>) {
  return {
    byEntity: Object.fromEntries(
      OCR_KEYS.map((key) => [key, {
        created: result[key].created,
        updated: result[key].updated,
        skipped: result[key].skipped,
        errors: result[key].errors
      }])
    ),
    warnings: result.warnings
  };
}

async function copiedDatabaseState() {
  const [profiles, batches, pages, rows, revisions, runs, events] = await Promise.all([
    prisma.feeRegisterOcrProfile.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrBatch.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrPage.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrRow.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrRowRevision.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrPostingRun.findMany({ orderBy: { id: "asc" } }),
    prisma.feeRegisterOcrEvent.findMany({ orderBy: { id: "asc" } })
  ]);
  const json = JSON.stringify({ profiles, batches, pages, rows, revisions, runs, events });
  return {
    counts: [profiles.length, batches.length, pages.length, rows.length, revisions.length, runs.length, events.length],
    digest: createHash("sha256").update(json).digest("hex"),
    missingSources: pages.filter((page) => page.status === "MISSING_SOURCE").length,
    postedRows: rows.filter((row) => row.status === "POSTED").length,
    linkedPayments: rows.filter((row) => row.postedPaymentId).length
  };
}

function inspectOcrPayload(raw: Record<string, unknown>) {
  const ocrPayload = Object.fromEntries(OCR_KEYS.map((key) => [key, raw[key] ?? []]));
  const json = JSON.stringify(ocrPayload);
  const prohibitedKey = /"(?:password|passwordHash|credential|secret|apiKey|endpoint)"\s*:/i.test(json);
  const absolutePath = /[A-Za-z]:\\|\/(?:Users|home|var|tmp)\//.test(json);
  const embeddedImage = /data:image\/|"(?:imageBytes|sourceBytes|base64)"\s*:/i.test(json);
  return { prohibitedKey, absolutePath, embeddedImage };
}

async function main() {
  const backupPath = process.argv[2];
  if (!backupPath) throw new Error("Pass a version-35 JSON backup path.");
  const source = await readFile(backupPath, "utf8");
  const raw = JSON.parse(source) as Record<string, unknown> & {
    metadata: { backupVersion?: number; counts?: Record<string, number> };
  };
  const backup = parseAndValidateBackup(raw);
  if (backup.metadata.backupVersion !== 35) throw new Error("Expected backup version 35.");

  const version34Raw = structuredClone(raw);
  version34Raw.metadata.backupVersion = 34;
  for (const key of OCR_KEYS) {
    delete version34Raw[key];
    if (version34Raw.metadata.counts) delete version34Raw.metadata.counts[key];
  }
  const version34 = parseAndValidateBackup(version34Raw);
  const version34Compatible = OCR_KEYS.every((key) => version34[key].length === 0);

  const studentMap = new Map(backup.students.map((row) => [String(row.id), String(row.id)]));
  const paymentMap = new Map(backup.payments.map((row) => [String(row.id), String(row.id)]));
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = makeResult();
    await restoreFeeRegisterOcrData(prisma, backup, studentMap, paymentMap, result);
    attempts.push({ attempt, result: summarize(result), state: await copiedDatabaseState() });
  }

  const collisionBackup = {
    ...backup,
    feeRegisterOcrBatches: backup.feeRegisterOcrBatches.map((row, index) =>
      index === 0 ? { ...row, batchNumber: `${String(row.batchNumber)}-COLLISION` } : row
    )
  };
  const collisionResult = makeResult();
  await restoreFeeRegisterOcrData(prisma, collisionBackup, studentMap, paymentMap, collisionResult);
  const collisionIsolated = collisionResult.warnings.some((warning) => warning.includes("collided"));

  const result = {
    databaseUrl: process.env.DATABASE_URL,
    backupVersion: backup.metadata.backupVersion,
    backupCounts: Object.fromEntries(OCR_KEYS.map((key) => [key, backup[key].length])),
    version34Compatible,
    payloadSafety: inspectOcrPayload(raw),
    attempts,
    stateIdempotent: attempts[0]?.state.digest === attempts[1]?.state.digest,
    countIdempotent: JSON.stringify(attempts[0]?.state.counts) === JSON.stringify(attempts[1]?.state.counts),
    collisionIsolated,
    collisionWarnings: collisionResult.warnings
  };
  console.log(JSON.stringify(result, null, 2));

  const errors = attempts.flatMap((attempt) =>
    Object.values(attempt.result.byEntity).flatMap((entity) => entity.errors)
  );
  if (
    !version34Compatible ||
    !result.stateIdempotent ||
    !result.countIdempotent ||
    !collisionIsolated ||
    Object.values(result.payloadSafety).some(Boolean) ||
    errors.length > 0
  ) {
    throw new Error("QA20B copied-database restore verification failed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
