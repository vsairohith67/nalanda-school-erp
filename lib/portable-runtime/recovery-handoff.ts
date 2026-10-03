import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { decryptCloudBackup, parseCloudBackupContainer } from "../cloud-backup-container";
import { parseAndValidateBackup } from "../restore";

export const RECOVERY_CONTRACT = "NALANDA_RECOVERY_INTEGRATED:v48:certificates-concessions-items";
export type RecoveryHandoff = {
  contract: "NALANDA_ENCRYPTED_HANDOFF_V1"; backupContract: typeof RECOVERY_CONTRACT;
  sourceProject: string; sourceCommit: string; runId: string; attempt: string;
  artifactId: string; objectKey: string; objectSha256: string; ciphertextSha256: string;
  plaintextSha256: string; bytes: number;
};
export type RecoveryExpectation = {
  sourceProject: string; destinationProject: string; sourceCommit: string; runId: string;
  attempt: string; artifactId: string; objectSha256: string; manifestSha256: string;
};
export const recoveryHash = (bytes: Uint8Array | string) => createHash("sha256").update(bytes).digest("hex");
const hex = /^[a-f0-9]{64}$/;
const project = /^nalanda-ci-[a-z0-9-]{3,64}$/;
export function makeRecoveryHandoff(bytes: Buffer, identity: Pick<RecoveryHandoff, "sourceProject" | "sourceCommit" | "runId" | "attempt" | "artifactId" | "objectKey">): RecoveryHandoff {
  const { header } = parseCloudBackupContainer(bytes);
  return { ...identity, contract: "NALANDA_ENCRYPTED_HANDOFF_V1", backupContract: RECOVERY_CONTRACT,
    objectSha256: recoveryHash(bytes), ciphertextSha256: header.ciphertextSha256,
    plaintextSha256: header.plaintextSha256, bytes: bytes.length };
}
/** Exact bytes and expected identity are supplied by the operator's immutable plan.
 * The manifest is not a trust root, and the recovery key is never part of it. */
export async function validateRecoveryHandoff(bytes: Buffer, manifestBytes: Buffer, key: Buffer, expected: RecoveryExpectation) {
  if (manifestBytes.length > 8192 || !hex.test(expected.manifestSha256) || recoveryHash(manifestBytes) !== expected.manifestSha256
    || !hex.test(expected.objectSha256) || recoveryHash(bytes) !== expected.objectSha256) throw Error("RECOVERY_TRANSFER_IDENTITY_MISMATCH");
  const m = JSON.parse(manifestBytes.toString("utf8")) as RecoveryHandoff;
  const fields = ["contract","backupContract","sourceProject","sourceCommit","runId","attempt","artifactId","objectKey","objectSha256","ciphertextSha256","plaintextSha256","bytes"].sort().join();
  if (!m || Object.keys(m).sort().join() !== fields || m.contract !== "NALANDA_ENCRYPTED_HANDOFF_V1" || m.backupContract !== RECOVERY_CONTRACT
    || !project.test(expected.sourceProject) || !project.test(expected.destinationProject) || expected.sourceProject === expected.destinationProject
    || !/^[a-f0-9]{40}$/.test(expected.sourceCommit) || !/^\d+$/.test(expected.runId) || !/^\d+$/.test(expected.attempt)
    || !/^[a-z0-9-]{8,64}$/.test(expected.artifactId) || !/^cloud-backup\/[a-z0-9]{20,32}\/[a-z0-9]{20,32}\.npsbackup$/.test(m.objectKey)
    || !hex.test(m.ciphertextSha256) || !hex.test(m.plaintextSha256) || m.bytes !== bytes.length
    || ["sourceProject","sourceCommit","runId","attempt","artifactId","objectSha256"].some(k => m[k as keyof RecoveryHandoff] !== expected[k as keyof RecoveryExpectation])) throw Error("RECOVERY_MANIFEST_MISMATCH");
  const decrypted = await decryptCloudBackup(bytes, { key, maximumPlaintextBytes: 256 * 1024 * 1024 });
  if (decrypted.header.ciphertextSha256 !== m.ciphertextSha256 || decrypted.header.plaintextSha256 !== m.plaintextSha256 || decrypted.header.backupFormatVersion !== 48) throw Error("RECOVERY_CONTENT_MISMATCH");
  const backup = parseAndValidateBackup(decrypted.plaintext.toString("utf8"));
  if (backup.metadata.backupVersion !== 48) throw Error("RECOVERY_CONTRACT_MISMATCH");
  return { manifest: m, backup };
}
/** Paths are fixed by the image; neither requests nor the manifest select files. */
export async function readPrivateRecoveryFile(root: string, name: "backup.npsbackup" | "manifest.json" | "recovery-key" | "source-v48.json" | "operator-fixture.json", maximum: number) {
  const directory = await lstat(root);
  if (!directory.isDirectory() || directory.isSymbolicLink() || await realpath(root) !== root) throw Error("RECOVERY_ROOT_UNSAFE");
  const file = path.join(root, name), info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maximum || await realpath(file) !== file
    || process.platform !== "win32" && (info.mode & 0o022)) throw Error("RECOVERY_FILE_UNSAFE");
  return readFile(file);
}
