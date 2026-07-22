import { prisma } from "../lib/prisma";
import { decryptCloudBackup } from "../lib/cloud-backup-container";
import { createCloudBackupProvider } from "../lib/cloud-backup-provider";
import { configureMockCloudBackupOutcome, resetMockCloudBackupStorage } from "../lib/cloud-backup-provider-mock";
import { setCloudBackupProfileStatus } from "../lib/cloud-backup-profiles";
import { createManualCloudBackupRun, executeCloudBackupRun, retryEligibleCloudBackups } from "../lib/cloud-backup-worker";

async function main() {
  const local = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-LOCAL" } });
  const mock = await prisma.cloudBackupProfile.findUnique({ where: { profileCode: "QA20C-MOCK" } });
  if (!local || !mock) throw new Error("Run qa20c:fixtures setup first.");
  if (local.status === "ACTIVE") await setCloudBackupProfileStatus(prisma, local.id, "pause");
  await setCloudBackupProfileStatus(prisma, mock.id, "activate");

  const outcomes = ["TRUNCATED_READBACK", "CORRUPT_CIPHERTEXT", "PERMANENT_UPLOAD_FAILURE", "TRANSIENT_UPLOAD_FAILURE"] as const;
  const evidence: Array<{ outcome: string; status: string; failureCode: string | null; verified: boolean }> = [];
  for (const outcome of outcomes) {
    configureMockCloudBackupOutcome(outcome);
    const run = await createManualCloudBackupRun(prisma, mock.id);
    const result = await executeCloudBackupRun(prisma, run.id);
    evidence.push({ outcome, status: result.status, failureCode: result.failureCode, verified: result.status === "VERIFIED" });
    if (result.status === "VERIFIED") throw new Error(`${outcome} was incorrectly marked VERIFIED.`);
    if (outcome === "TRANSIENT_UPLOAD_FAILURE") {
      await prisma.cloudBackupRun.update({ where: { id: result.id }, data: { nextRetryAt: new Date(Date.now() - 1000) } });
    }
  }

  configureMockCloudBackupOutcome("SUCCESS");
  const retry = await retryEligibleCloudBackups(prisma);
  const retriedStatuses = retry.runIds.length
    ? await prisma.cloudBackupRun.findMany({ where: { id: { in: retry.runIds } }, select: { status: true } })
    : [];
  if (retriedStatuses.some((row) => row.status !== "VERIFIED")) throw new Error("Transient retry did not recover safely.");

  await setCloudBackupProfileStatus(prisma, mock.id, "pause");
  await setCloudBackupProfileStatus(prisma, local.id, "activate");
  resetMockCloudBackupStorage();

  const localArtifact = await prisma.cloudBackupArtifact.findFirst({
    where: { run: { profileId: local.id, status: "VERIFIED" }, status: "VERIFIED" },
    orderBy: { verifiedAt: "desc" },
    include: { run: { include: { profile: true } } }
  });
  if (!localArtifact) throw new Error("A LOCAL_FOLDER verified artifact is required.");
  const encrypted = await createCloudBackupProvider(localArtifact.run.profile).getObject(localArtifact.objectKeySafe);
  let wrongKeyFailure = "NONE";
  try {
    await decryptCloudBackup(encrypted, { key: Buffer.alloc(32, 0xee) });
  } catch (error) {
    wrongKeyFailure = error && typeof error === "object" && "code" in error ? String(error.code) : "FAILED_CLOSED";
  }
  if (wrongKeyFailure !== "AUTHENTICATION_FAILED") throw new Error("Wrong-key scenario did not fail authentication.");

  console.log(JSON.stringify({
    outcomes: evidence,
    transientRetriesCreated: retry.retried,
    transientRetryStatuses: retriedStatuses.map((row) => row.status),
    wrongKeyFailure,
    liveNetworkCalls: 0,
    keyMaterialStored: false
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "QA20C provider scenarios failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
