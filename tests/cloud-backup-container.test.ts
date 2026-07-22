import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  CLOUD_BACKUP_MAX_HEADER_BYTES,
  CLOUD_BACKUP_MAGIC,
  CloudBackupContainerError,
  decryptCloudBackup,
  encryptCloudBackup,
  loadCloudBackupKey,
  parseCloudBackupContainer,
  sha256
} from "../lib/cloud-backup-container";

const key = Buffer.alloc(32, 0x4a);
const wrongKey = Buffer.alloc(32, 0x4b);
const plaintext = Buffer.from(JSON.stringify({
  metadata: { appName: "Nalanda Fee Control", backupVersion: 36 },
  marker: "QA20C-private-plaintext"
}), "utf8");

async function encrypted() {
  return encryptCloudBackup(plaintext, {
    backupFormatVersion: 36,
    createdAt: new Date("2026-07-19T05:00:00.000Z"),
    encryptionKeyVersion: "V1",
    key
  });
}

function mutateHeader(bytes: Buffer, update: (header: Record<string, unknown>) => void) {
  const magicBytes = Buffer.byteLength(CLOUD_BACKUP_MAGIC);
  const headerLength = bytes.readUInt32BE(magicBytes);
  const headerStart = magicBytes + 4;
  const ciphertextStart = headerStart + headerLength;
  const header = JSON.parse(bytes.subarray(headerStart, ciphertextStart).toString("utf8")) as Record<string, unknown>;
  update(header);
  const nextHeader = Buffer.from(JSON.stringify(header), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(nextHeader.length);
  return Buffer.concat([Buffer.from(CLOUD_BACKUP_MAGIC), length, nextHeader, bytes.subarray(ciphertextStart)]);
}

function reencryptCompressed(
  bytes: Buffer,
  updateCompressed: (compressed: Buffer) => Buffer,
  updateAuthenticatedHeader?: (header: Record<string, unknown>) => void
) {
  const { header, ciphertext } = parseCloudBackupContainer(bytes);
  const { authenticationTag: _tag, ciphertextSha256: _ciphertextHash, ...authenticated } = header;
  const nonce = Buffer.from(header.nonce, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, nonce);
  decipher.setAAD(Buffer.from(JSON.stringify(authenticated), "utf8"));
  decipher.setAuthTag(Buffer.from(header.authenticationTag, "base64"));
  const compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const nextCompressed = updateCompressed(compressed);
  const nextAuthenticated: Record<string, unknown> = {
    ...authenticated,
    compressedBytes: nextCompressed.length,
    ciphertextBytes: nextCompressed.length
  };
  updateAuthenticatedHeader?.(nextAuthenticated);
  const cipher = createCipheriv("aes-256-gcm", key, nonce);
  cipher.setAAD(Buffer.from(JSON.stringify(nextAuthenticated), "utf8"));
  const nextCiphertext = Buffer.concat([cipher.update(nextCompressed), cipher.final()]);
  const nextHeader = {
    ...nextAuthenticated,
    authenticationTag: cipher.getAuthTag().toString("base64"),
    ciphertextSha256: sha256(nextCiphertext)
  };
  const nextHeaderBytes = Buffer.from(JSON.stringify(nextHeader), "utf8");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(nextHeaderBytes.length);
  return Buffer.concat([Buffer.from(CLOUD_BACKUP_MAGIC), length, nextHeaderBytes, nextCiphertext]);
}

describe("encrypted cloud backup container", () => {
  it("compresses, encrypts, authenticates, hashes, and decrypts exact validated bytes", async () => {
    const result = await encrypted();
    const restored = await decryptCloudBackup(result.bytes, { key });
    expect(restored.plaintext.equals(plaintext)).toBe(true);
    expect(restored.header).toMatchObject({
      backupFormatVersion: 36,
      containerFormatVersion: 1,
      encryptionAlgorithm: "AES-256-GCM",
      compressionAlgorithm: "GZIP",
      encryptionKeyVersion: "V1",
      plaintextSha256: sha256(plaintext)
    });
    expect(result.bytes.toString("utf8")).not.toContain("QA20C-private-plaintext");
  });

  it("uses a fresh random nonce for every artifact", async () => {
    const [first, second] = await Promise.all([encrypted(), encrypted()]);
    expect(first.header.nonce).not.toBe(second.header.nonce);
    expect(first.bytes.equals(second.bytes)).toBe(false);
  });

  it("fails closed for a wrong key", async () => {
    await expect(decryptCloudBackup((await encrypted()).bytes, { key: wrongKey }))
      .rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });
  });

  it("rejects corrupted and truncated ciphertext", async () => {
    const result = await encrypted();
    const corrupt = Buffer.from(result.bytes);
    corrupt[corrupt.length - 1] ^= 0xff;
    await expect(decryptCloudBackup(corrupt, { key }))
      .rejects.toMatchObject({ code: "CIPHERTEXT_HASH_MISMATCH" });
    expect(() => parseCloudBackupContainer(result.bytes.subarray(0, result.bytes.length - 7)))
      .toThrow(CloudBackupContainerError);
  });

  it("authenticates header fields and rejects modified tags or unsupported versions", async () => {
    const result = await encrypted();
    const modifiedCreatedAt = mutateHeader(result.bytes, (header) => {
      header.createdAt = "2026-07-19T05:00:01.000Z";
    });
    await expect(decryptCloudBackup(modifiedCreatedAt, { key }))
      .rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });

    const modifiedTag = mutateHeader(result.bytes, (header) => {
      header.authenticationTag = randomBytes(16).toString("base64");
    });
    await expect(decryptCloudBackup(modifiedTag, { key }))
      .rejects.toMatchObject({ code: "AUTHENTICATION_FAILED" });

    const unsupported = mutateHeader(result.bytes, (header) => {
      header.containerFormatVersion = 2;
    });
    expect(() => parseCloudBackupContainer(unsupported))
      .toThrowError(expect.objectContaining({ code: "CONTAINER_UNSUPPORTED" }));
  });

  it("requires exact 32-byte environment keys and preserves only the key version", async () => {
    await expect(encryptCloudBackup(plaintext, {
      backupFormatVersion: 36,
      createdAt: new Date(),
      encryptionKeyVersion: "V2",
      key: Buffer.alloc(31)
    })).rejects.toMatchObject({ code: "KEY_INVALID" });
    const result = await encrypted();
    expect(JSON.stringify(result.header)).not.toContain(key.toString("base64"));
  });

  it("fails safely when an environment key version is missing or malformed", () => {
    expect(() => loadCloudBackupKey("V2", { NODE_ENV: "test" }))
      .toThrowError(expect.objectContaining({ code: "KEY_UNAVAILABLE" }));
    expect(() => loadCloudBackupKey("V2", { NODE_ENV: "test", CLOUD_BACKUP_ENCRYPTION_KEY_V2: "not-base64!" }))
      .toThrowError(expect.objectContaining({ code: "KEY_INVALID" }));
  });

  it("rejects oversized headers and unsupported algorithms before decryption", async () => {
    const result = await encrypted();
    const oversized = Buffer.from(result.bytes);
    oversized.writeUInt32BE(CLOUD_BACKUP_MAX_HEADER_BYTES + 1, Buffer.byteLength(CLOUD_BACKUP_MAGIC));
    expect(() => parseCloudBackupContainer(oversized))
      .toThrowError(expect.objectContaining({ code: "CONTAINER_INVALID" }));

    const unsupported = mutateHeader(result.bytes, (header) => {
      header.encryptionAlgorithm = "AES-256-CBC";
    });
    expect(() => parseCloudBackupContainer(unsupported))
      .toThrowError(expect.objectContaining({ code: "CONTAINER_UNSUPPORTED" }));
  });

  it("distinguishes authenticated gzip corruption from plaintext hash mismatch", async () => {
    const result = await encrypted();
    const corruptCompressed = reencryptCompressed(result.bytes, (compressed) => {
      const next = Buffer.from(compressed);
      next[Math.floor(next.length / 2)] ^= 0xff;
      return next;
    });
    await expect(decryptCloudBackup(corruptCompressed, { key }))
      .rejects.toMatchObject({ code: "DECOMPRESSION_FAILED" });

    const wrongPlaintext = reencryptCompressed(result.bytes, (compressed) => {
      const decoded = gunzipSync(compressed);
      const marker = decoded.indexOf(Buffer.from("QA20C-private-plaintext"));
      expect(marker).toBeGreaterThanOrEqual(0);
      decoded[marker] = decoded[marker] === 0x51 ? 0x52 : 0x51;
      return gzipSync(decoded, { level: 9 });
    });
    await expect(decryptCloudBackup(wrongPlaintext, { key }))
      .rejects.toMatchObject({ code: "PLAINTEXT_HASH_MISMATCH" });
  });
});
