import type { PrismaClient } from "@prisma/client";
import { createCloudBackupProvider } from "@/lib/cloud-backup-provider";
import { decryptCloudBackup } from "@/lib/cloud-backup-container";
import { parseAndValidateBackup } from "@/lib/restore";

export async function verifyStoredCloudBackupArtifact(
  prisma: PrismaClient,
  artifactId: string,
  actorUserId?: string
) {
  const artifact = await prisma.cloudBackupArtifact.findUnique({
    where: { id: artifactId },
    include: { run: { include: { profile: true } } }
  });
  if (!artifact || artifact.status === "PRUNED") throw new Error("Encrypted backup artifact is unavailable.");
  if (!["UPLOADED", "VERIFIED", "CORRUPT", "MISSING"].includes(artifact.status)) throw new Error("Encrypted backup artifact is not ready for verification.");
  const provider = createCloudBackupProvider(artifact.run.profile);
  const started = Date.now();
  try {
    const head = await provider.headObject(artifact.objectKeySafe);
    if (!head) throw new Error("OBJECT_MISSING");
    await record(prisma, artifact, "REMOTE_HEAD", "PASSED", "Provider metadata found the exact encrypted object.", Date.now() - started);
    const bytes = await provider.getObject(artifact.objectKeySafe);
    await record(prisma, artifact, "REMOTE_READBACK", "PASSED", "Exact encrypted object was read back.", Date.now() - started);
    const decrypted = await decryptCloudBackup(bytes);
    if (decrypted.header.ciphertextSha256 !== artifact.ciphertextSha256) throw new Error("CIPHERTEXT_HASH_MISMATCH");
    await record(prisma, artifact, "DECRYPTION", "PASSED", "AES-GCM authentication and decryption passed.", Date.now() - started);
    if (decrypted.header.plaintextSha256 !== artifact.plaintextSha256) throw new Error("PLAINTEXT_HASH_MISMATCH");
    await record(prisma, artifact, "PLAINTEXT_HASH", "PASSED", "Decrypted exact-byte SHA-256 matches stored metadata.", Date.now() - started);
    const backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
    if (backup.metadata.backupVersion !== 43) throw new Error("BACKUP_SCHEMA_INVALID");
    await record(prisma, artifact, "BACKUP_SCHEMA", "PASSED", "Nalanda backup schema and version 43 passed.", Date.now() - started);
    const verifiedAt = new Date();
    await prisma.$transaction([
      prisma.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { status: "VERIFIED", verifiedAt } }),
      prisma.cloudBackupRun.update({ where: { id: artifact.runId }, data: { status: "VERIFIED", completedAt: artifact.run.completedAt ?? verifiedAt, failureCode: null, failureMessageSafe: null } }),
      prisma.cloudBackupEvent.create({ data: {
        profileId: artifact.run.profileId, runId: artifact.runId, artifactId: artifact.id,
        eventType: "BACKUP_VERIFIED", reason: "MANUAL_REVERIFICATION", recordedByUserId: actorUserId
      } })
    ]);
    return { verified: true, backupVersion: 43, artifactId: artifact.id };
  } catch (error) {
    const failureCode = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message) ? error.message : "VERIFICATION_FAILED";
    await prisma.$transaction([
      prisma.cloudBackupArtifact.update({ where: { id: artifact.id }, data: { status: failureCode === "OBJECT_MISSING" ? "MISSING" : "CORRUPT" } }),
      prisma.cloudBackupVerification.create({ data: {
        runId: artifact.runId, artifactId: artifact.id, verificationType: "REMOTE_READBACK",
        status: "FAILED", safeSummary: "Encrypted backup verification failed safely.", failureCode,
        durationMs: Date.now() - started
      } }),
      prisma.cloudBackupEvent.create({ data: {
        profileId: artifact.run.profileId, runId: artifact.runId, artifactId: artifact.id,
        eventType: "VERIFICATION_FAILED", reason: failureCode, recordedByUserId: actorUserId
      } })
    ]);
    return { verified: false, failureCode, artifactId: artifact.id };
  }
}

function record(prisma: PrismaClient, artifact: any, verificationType: string, status: string, safeSummary: string, durationMs: number) {
  return prisma.cloudBackupVerification.create({ data: {
    runId: artifact.runId, artifactId: artifact.id, verificationType, status, safeSummary, durationMs
  } });
}
