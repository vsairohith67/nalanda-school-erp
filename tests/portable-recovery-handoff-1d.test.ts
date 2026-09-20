import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it, vi } from "vitest";
import { createBackupDocument } from "../lib/backup";
import { encryptCloudBackup } from "../lib/cloud-backup-container";
import { makeRecoveryHandoff, readPrivateRecoveryFile, recoveryHash, validateRecoveryHandoff } from "../lib/portable-runtime/recovery-handoff";
import {assertRecoveryPrivacyKeys} from "../lib/portable-runtime/recovery-readback";
import {encryptMfaSecret,serializeMfaSecretEnvelope} from "../lib/real-user-access/crypto";

it("requires the genuine private-data key before accepting preserved income ciphertext",()=>{
 const original={active:"SOURCE",keys:{SOURCE:randomBytes(32).toString("base64")}};
 const envelope=serializeMfaSecretEnvelope(encryptMfaSecret("0.00","prior-year-income:synthetic-case",{AUTH_MFA_KEYRING_JSON:JSON.stringify(original)}));
 const backup={priorYearIncomeSupports:[{caseId:"synthetic-case",exactAmountEnvelope:envelope}]} as Parameters<typeof assertRecoveryPrivacyKeys>[0];
 try{
  vi.stubEnv("AUTH_MFA_KEYRING_JSON",JSON.stringify(original));expect(()=>assertRecoveryPrivacyKeys(backup)).not.toThrow();
  vi.stubEnv("AUTH_MFA_KEYRING_JSON",JSON.stringify({active:"SOURCE",keys:{SOURCE:randomBytes(32).toString("base64")}}));expect(()=>assertRecoveryPrivacyKeys(backup)).toThrow("RECOVERY_PRIVATE_DATA_KEY_CUSTODY_REQUIRED");
  vi.stubEnv("AUTH_MFA_KEYRING_JSON","");expect(()=>assertRecoveryPrivacyKeys(backup)).toThrow("RECOVERY_PRIVATE_DATA_KEY_CUSTODY_REQUIRED");
 }finally{vi.unstubAllEnvs();}
});

async function transfer() {
  const key = randomBytes(32);
  const data = createBackupDocument({ generatedAt: new Date(), generatedBy: "SYNTHETIC", students: [], feeStructures: [], payments: [], paymentAudits: [], users: [] });
  const encrypted = await encryptCloudBackup(Buffer.from(JSON.stringify(data)), { backupFormatVersion: 48, createdAt: new Date(), encryptionKeyVersion: "V1", key });
  const bytes = encrypted.bytes;
  const identity = { sourceProject: "nalanda-ci-123-source", sourceCommit: "a".repeat(40), runId: "123", attempt: "1", artifactId: "synthetic-artifact", objectKey: `cloud-backup/${"a".repeat(24)}/${"b".repeat(24)}.npsbackup` };
  const manifest = Buffer.from(JSON.stringify(makeRecoveryHandoff(bytes, identity)));
  const expected = { ...identity, destinationProject: "nalanda-ci-123-destination", objectSha256: recoveryHash(bytes), manifestSha256: recoveryHash(manifest) };
  return { key, bytes, manifest, expected };
}
it("authenticates the exact encrypted container, separate key and source/run/project provenance", async () => {
  const f = await transfer();
  const result = await validateRecoveryHandoff(f.bytes, f.manifest, f.key, f.expected);
  expect(result.backup.metadata.backupVersion).toBe(48);
  expect(result.manifest.objectSha256).not.toBe(result.manifest.ciphertextSha256);
  expect(f.manifest.toString()).not.toContain(f.key.toString("base64"));
  await expect(validateRecoveryHandoff(f.bytes, f.manifest, randomBytes(32), f.expected)).rejects.toThrow();
  const corrupt = Buffer.from(f.bytes);corrupt[corrupt.length - 1] ^= 1;
  await expect(validateRecoveryHandoff(corrupt, f.manifest, f.key, f.expected)).rejects.toThrow("RECOVERY_TRANSFER_IDENTITY_MISMATCH");
  await expect(validateRecoveryHandoff(f.bytes, Buffer.from("{}"), f.key, f.expected)).rejects.toThrow("RECOVERY_TRANSFER_IDENTITY_MISMATCH");
  for (const delta of [{ runId: "124" }, { attempt: "2" }, { sourceCommit: "b".repeat(40) }, { destinationProject: f.expected.sourceProject }, { artifactId: "different-artifact" }]) {
    await expect(validateRecoveryHandoff(f.bytes, f.manifest, f.key, { ...f.expected, ...delta })).rejects.toThrow("RECOVERY_MANIFEST_MISMATCH");
  }
});
it("rejects forged manifest hashes even when an attacker recalculates the transport checksum", async () => {
  const f = await transfer(), parsed = JSON.parse(f.manifest.toString());
  parsed.plaintextSha256 = "0".repeat(64);const manifest = Buffer.from(JSON.stringify(parsed));
  await expect(validateRecoveryHandoff(f.bytes, manifest, f.key, { ...f.expected, manifestSha256: recoveryHash(manifest) })).rejects.toThrow("RECOVERY_CONTENT_MISMATCH");
});
it("requires a present bounded regular private object and leaves existing bytes untouched on failure", async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), "nalanda-handoff-1d-")));
  try {
    await expect(readPrivateRecoveryFile(root, "backup.npsbackup", 1024)).rejects.toThrow();
    await writeFile(path.join(root,"backup.npsbackup"), "encrypted-fixture", {mode:0o400});
    await expect(readPrivateRecoveryFile(root,"backup.npsbackup",2)).rejects.toThrow("RECOVERY_FILE_UNSAFE");
    expect((await readPrivateRecoveryFile(root,"backup.npsbackup",1024)).toString()).toBe("encrypted-fixture");
  } finally {
    if (!root.startsWith(path.join(await realpath(tmpdir()),"nalanda-handoff-1d-"))) throw Error("CLEANUP_BOUNDARY");
    await rm(root,{recursive:true});
  }
});
