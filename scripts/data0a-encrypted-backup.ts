import { createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { generateFullBackup, serializeBackup } from "../lib/backup";
import {
  decryptCloudBackup,
  encryptCloudBackup,
  parseCloudBackupContainer
} from "../lib/cloud-backup-container";
import { prisma } from "../lib/prisma";
import { OPERATIONAL_DATABASE, WORKSPACE_ROOT } from "./migration-isolation";

function fileHash(filePath: string) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex").toUpperCase();
}

function databaseIdentity() {
  const stat = statSync(OPERATIONAL_DATABASE);
  return {
    sha256: fileHash(OPERATIONAL_DATABASE),
    size: stat.size,
    lastWriteMs: stat.mtimeMs,
    lastWriteUtc: stat.mtime.toISOString()
  };
}

function timestamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

async function main() {
  const before = databaseIdentity();
  const generatedAt = new Date();
  const backup = await generateFullBackup(prisma, {
    generatedAt,
    generatedBy: "DATA-0A read-only provenance preflight"
  });
  const plaintext = Buffer.from(serializeBackup(backup), "utf8");
  const key = randomBytes(32);
  const encrypted = await encryptCloudBackup(plaintext, {
    backupFormatVersion: backup.metadata.backupVersion,
    createdAt: generatedAt,
    encryptionKeyVersion: "V1",
    key
  });
  const databaseBytes = readFileSync(OPERATIONAL_DATABASE);
  const encryptedDatabase = await encryptCloudBackup(databaseBytes, {
    backupFormatVersion: backup.metadata.backupVersion,
    createdAt: generatedAt,
    encryptionKeyVersion: "V1",
    key
  });
  const root = path.join(WORKSPACE_ROOT, ".data0a");
  const backupDirectory = path.join(root, "backups");
  const keyDirectory = path.join(root, "keys");
  mkdirSync(backupDirectory, { recursive: true });
  mkdirSync(keyDirectory, { recursive: true });
  const stem = `DATA0A-preflight-${timestamp(generatedAt)}`;
  const artifactPath = path.join(backupDirectory, `${stem}.npsbackup`);
  const databaseArtifactPath = path.join(backupDirectory, `${stem}-database.npsbackup`);
  const keyPath = path.join(keyDirectory, `${stem}.key`);
  if (existsSync(artifactPath) || existsSync(databaseArtifactPath) || existsSync(keyPath)) {
    throw new Error("DATA0A_BACKUP_COLLISION");
  }
  writeFileSync(keyPath, key.toString("base64"), { encoding: "utf8", flag: "wx", mode: 0o600 });
  writeFileSync(artifactPath, encrypted.bytes, { flag: "wx", mode: 0o600 });
  writeFileSync(databaseArtifactPath, encryptedDatabase.bytes, { flag: "wx", mode: 0o600 });

  const parsed = parseCloudBackupContainer(readFileSync(artifactPath));
  const restoredKey = Buffer.from(readFileSync(keyPath, "utf8").trim(), "base64");
  const decrypted = await decryptCloudBackup(readFileSync(artifactPath), { key: restoredKey });
  if (!decrypted.plaintext.equals(plaintext)) throw new Error("DATA0A_ENCRYPTED_BACKUP_ROUND_TRIP_FAILED");
  if (parsed.header.plaintextSha256 !== encrypted.header.plaintextSha256) {
    throw new Error("DATA0A_ENCRYPTED_BACKUP_HEADER_MISMATCH");
  }
  const databaseRoundTrip = await decryptCloudBackup(readFileSync(databaseArtifactPath), { key: restoredKey });
  if (!databaseRoundTrip.plaintext.equals(databaseBytes)) {
    throw new Error("DATA0A_ENCRYPTED_DATABASE_BACKUP_ROUND_TRIP_FAILED");
  }
  const after = databaseIdentity();
  if (
    after.sha256 !== before.sha256
    || after.size !== before.size
    || after.lastWriteMs !== before.lastWriteMs
  ) {
    throw new Error("DATA0A_OPERATIONAL_DATABASE_CHANGED_DURING_BACKUP");
  }
  console.log(JSON.stringify({
    status: "DATA0A_ENCRYPTED_BACKUP_CREATED_AND_VERIFIED",
    logicalArtifactPath: artifactPath,
    databaseArtifactPath,
    keyPath,
    logicalEncryptedSha256: fileHash(artifactPath),
    databaseEncryptedSha256: fileHash(databaseArtifactPath),
    databasePlaintextSha256: createHash("sha256").update(databaseRoundTrip.plaintext).digest("hex").toUpperCase(),
    algorithm: parsed.header.encryptionAlgorithm,
    compression: parsed.header.compressionAlgorithm,
    backupVersion: parsed.header.backupFormatVersion,
    plaintextBytes: parsed.header.plaintextBytes,
    logicalEncryptedBytes: statSync(artifactPath).size,
    databaseEncryptedBytes: statSync(databaseArtifactPath).size,
    operationalDatabase: {
      sha256: before.sha256,
      size: before.size,
      lastWriteUtc: before.lastWriteUtc,
      unchanged: true
    },
    plaintextFileWritten: false
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "DATA0A_ENCRYPTED_BACKUP_FAILED");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
