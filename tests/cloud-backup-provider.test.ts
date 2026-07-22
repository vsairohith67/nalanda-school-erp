import { mkdtemp, readFile, readdir, rm, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { encryptCloudBackup } from "../lib/cloud-backup-container";
import {
  createDisabledGoogleDriveCloudBackupProvider,
  createDisabledObjectStorageCloudBackupProvider
} from "../lib/cloud-backup-provider-disabled";
import { createLocalFolderCloudBackupProvider } from "../lib/cloud-backup-provider-local";
import {
  configureMockCloudBackupOutcome,
  createMockCloudBackupProvider,
  resetMockCloudBackupStorage
} from "../lib/cloud-backup-provider-mock";

const objectKey = "cloud-backup/0123456789abcdef0123456789abcdef/abcdef0123456789abcdef0123456789.npsbackup";

async function container() {
  return (await encryptCloudBackup(Buffer.from('{"metadata":{"backupVersion":36}}'), {
    backupFormatVersion: 36,
    createdAt: new Date("2026-07-19T05:00:00.000Z"),
    encryptionKeyVersion: "V1",
    key: Buffer.alloc(32, 7)
  })).bytes;
}

afterEach(() => {
  resetMockCloudBackupStorage();
  delete process.env.CLOUD_BACKUP_LOCAL_FOLDER;
});

describe("cloud backup providers", () => {
  it("keeps MOCK deterministic, retry-classified, and corruption-configurable", async () => {
    const provider = createMockCloudBackupProvider();
    const bytes = await container();
    await provider.putObject(objectKey, bytes);
    expect((await provider.getObject(objectKey)).equals(bytes)).toBe(true);

    configureMockCloudBackupOutcome("CORRUPT_CIPHERTEXT");
    expect((await provider.getObject(objectKey)).equals(bytes)).toBe(false);
    configureMockCloudBackupOutcome("TRANSIENT_UPLOAD_FAILURE");
    await expect(provider.putObject(objectKey.replace("abcdef", "fedcba"), bytes))
      .rejects.toMatchObject({ code: "UPLOAD_TRANSIENT", retryable: true });
  });

  it("simulates every bounded MOCK failure without creating a live fallback", async () => {
    const provider = createMockCloudBackupProvider();
    const bytes = await container();
    await provider.putObject(objectKey, bytes);

    configureMockCloudBackupOutcome("TIMEOUT");
    await expect(provider.putObject(objectKey.replace("abcdef", "fedcba"), bytes))
      .rejects.toMatchObject({ code: "PROVIDER_TIMEOUT", retryable: true });

    configureMockCloudBackupOutcome("PERMANENT_UPLOAD_FAILURE");
    await expect(provider.putObject(objectKey.replace("abcdef", "fedcba"), bytes))
      .rejects.toMatchObject({ code: "UPLOAD_REJECTED", retryable: false });

    configureMockCloudBackupOutcome("OBJECT_MISSING");
    expect(await provider.headObject(objectKey)).toBeNull();
    await expect(provider.getObject(objectKey)).rejects.toMatchObject({ code: "OBJECT_MISSING" });

    configureMockCloudBackupOutcome("TRUNCATED_READBACK");
    expect((await provider.getObject(objectKey)).length).toBeLessThan(bytes.length);
    configureMockCloudBackupOutcome("CORRUPT_CIPHERTEXT");
    expect((await provider.getObject(objectKey)).equals(bytes)).toBe(false);

    configureMockCloudBackupOutcome("DELETE_FAILURE");
    await expect(provider.deleteObject(objectKey))
      .rejects.toMatchObject({ code: "DELETE_FAILED", retryable: true });
  });

  it("writes only encrypted containers inside the configured LOCAL_FOLDER", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qa20c-provider-"));
    process.env.CLOUD_BACKUP_LOCAL_FOLDER = root;
    try {
      const provider = createLocalFolderCloudBackupProvider();
      const bytes = await container();
      await provider.putObject(objectKey, bytes);
      const stored = await readFile(path.join(root, ...objectKey.split("/")));
      expect(stored.equals(bytes)).toBe(true);
      expect(stored.toString("utf8")).not.toContain("backupVersion");
      await expect(provider.putObject(objectKey.replace("abcdef", "fedcba"), Buffer.from("{}")))
        .rejects.toMatchObject({ code: "PLAINTEXT_UPLOAD_BLOCKED" });
      await expect(provider.getObject("../outside.npsbackup")).rejects.toBeDefined();
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("uses atomic LOCAL_FOLDER writes and deletes only the exact object identity", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "qa20c-provider-"));
    process.env.CLOUD_BACKUP_LOCAL_FOLDER = root;
    try {
      const provider = createLocalFolderCloudBackupProvider();
      const bytes = await container();
      const secondKey = objectKey.replace("abcdef0123456789abcdef0123456789", "fedcba9876543210fedcba9876543210");
      await provider.putObject(objectKey, bytes);
      await provider.putObject(secondKey, bytes);
      const objectDirectory = path.join(root, ...objectKey.split("/").slice(0, -1));
      expect((await readdir(objectDirectory)).some((name) => name.endsWith(".tmp"))).toBe(false);
      expect(await provider.deleteObject(objectKey)).toEqual({ deleted: true, alreadyMissing: false });
      expect(await provider.headObject(objectKey)).toBeNull();
      expect(await provider.headObject(secondKey)).not.toBeNull();
      expect(await provider.deleteObject(objectKey)).toEqual({ deleted: false, alreadyMissing: true });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a LOCAL_FOLDER root reached through a symlink or junction", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "qa20c-provider-link-"));
    const realRoot = path.join(parent, "real");
    const linkedRoot = path.join(parent, "linked");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(realRoot));
    await symlink(realRoot, linkedRoot, process.platform === "win32" ? "junction" : "dir");
    process.env.CLOUD_BACKUP_LOCAL_FOLDER = linkedRoot;
    try {
      await expect(createLocalFolderCloudBackupProvider().healthCheck())
        .rejects.toMatchObject({ code: "LOCAL_FOLDER_UNSAFE" });
    } finally {
      await rm(parent, { recursive: true, force: true });
    }
  });

  it("keeps OBJECT_STORAGE and GOOGLE_DRIVE disabled with no network path", async () => {
    for (const kind of ["OBJECT_STORAGE", "GOOGLE_DRIVE"] as const) {
      const provider = kind === "OBJECT_STORAGE"
        ? createDisabledObjectStorageCloudBackupProvider(false)
        : createDisabledGoogleDriveCloudBackupProvider(false);
      await expect(provider.putObject(objectKey, await container()))
        .rejects.toMatchObject({ code: "LIVE_PROVIDER_DISABLED" });
      expect((await provider.healthCheck()).ready).toBe(false);
    }
  });
});
