import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { link, lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetBucketLocationCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { readPortableSecret } from "@/lib/portable-runtime/secrets";

const MAX_OBJECT_BYTES = 512 * 1024 * 1024;
const MULTIPART_PART_BYTES = 8 * 1024 * 1024;
const MAX_LIST_RESULTS = 500;
const OBJECT_KEY = /^private\/(?:admissions|classwork|support|event-media|payslip|reports|exports|identity-cards|backups|onboarding|fee-register-ocr)\/[a-z0-9][a-z0-9._/-]{0,300}$/;
const PREFIX = /^private\/(?:admissions|classwork|support|event-media|payslip|reports|exports|identity-cards|backups|onboarding|fee-register-ocr)\/(?:[a-z0-9][a-z0-9._/-]{0,300})?$/;

export type PrivateObjectMetadata = {
  key: string;
  byteSize: number;
  sha256: string;
  contentType: string;
  version: string | null;
  lastModified: Date | null;
};

export type PrivateObjectPutInput = {
  key: string;
  bytes: Buffer;
  sha256: string;
  contentType: string;
  contentDisposition?: string;
};

export interface PrivateObjectStore {
  readonly kind: "FILESYSTEM" | "S3_COMPATIBLE";
  putPrivateObject(input: PrivateObjectPutInput): Promise<PrivateObjectMetadata>;
  getPrivateObject(key: string, maximumBytes?: number): Promise<{ bytes: Buffer; metadata: PrivateObjectMetadata }>;
  streamPrivateObject(key: string, maximumBytes?: number): Promise<{ stream: NodeJS.ReadableStream; metadata: PrivateObjectMetadata }>;
  statPrivateObject(key: string): Promise<PrivateObjectMetadata | null>;
  deleteGovernedObject(key: string, expectedVersion?: string | null): Promise<{ deleted: boolean }>;
  copyPrivateObject(sourceKey: string, destinationKey: string): Promise<PrivateObjectMetadata>;
  listBoundedPrefix(prefix: string, limit: number): Promise<PrivateObjectMetadata[]>;
  authorizedDownloadUrl(input: { key: string; expiresSeconds: number; contentType: string; safeFilename: string }): Promise<string | null>;
  verifyChecksum(key: string, expectedSha256: string): Promise<boolean>;
  healthCheck(): Promise<{ ready: boolean; safeCode: "OBJECT_STORE_READY" | "OBJECT_STORE_UNAVAILABLE" }>;
  close(): void;
}

export class PrivateObjectStoreError extends Error {
  constructor(public readonly code: string, public readonly status = 500) {
    super(code);
    this.name = "PrivateObjectStoreError";
  }
}

export function validatePrivateObjectKey(key: string) {
  if (!OBJECT_KEY.test(key) || key.includes("..") || key.includes("//") || /[\\{}\s\u0000-\u001f]/.test(key)) {
    throw new PrivateObjectStoreError("PRIVATE_OBJECT_KEY_INVALID", 404);
  }
  const segments = key.split("/");
  const leaf = segments.at(-1) ?? "";
  const directorySegments = segments.slice(2, -1);
  const opaqueLeaf = /^(?:[a-f0-9]{32}|[a-f0-9-]{36}|[a-z0-9]{20,64})(?:\.(?:pdf|png|jpg|webp|enc|xlsx|json|csv|npsbackup))?$/;
  const controlledDirectory = /^(?:[a-f0-9]{2}|[a-z0-9]{20,64}|[a-f0-9-]{36}|original|derivative|source|delivery|error|cloud-backup|daily|weekly|monthly)$/;
  if (!opaqueLeaf.test(leaf) || directorySegments.some((segment) => !controlledDirectory.test(segment))) {
    throw new PrivateObjectStoreError("PRIVATE_OBJECT_KEY_NOT_OPAQUE", 404);
  }
  return key;
}

function validatePrefix(prefix: string) {
  if (!PREFIX.test(prefix) || prefix.includes("..") || prefix.includes("//") || /[\\{}\s\u0000-\u001f]/.test(prefix)) {
    throw new PrivateObjectStoreError("PRIVATE_OBJECT_PREFIX_INVALID", 400);
  }
  return prefix;
}

function validateSha256(value: string) {
  if (!/^[a-f0-9]{64}$/.test(value)) throw new PrivateObjectStoreError("PRIVATE_OBJECT_CHECKSUM_INVALID", 400);
  return value;
}

function validateContentType(value: string) {
  if (!/^(?:application\/(?:pdf|octet-stream|json|vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet)|image\/(?:png|jpeg|webp)|text\/csv)$/.test(value)) {
    throw new PrivateObjectStoreError("PRIVATE_OBJECT_CONTENT_TYPE_INVALID", 400);
  }
  return value;
}

function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

function boundedBytes(value: number, maximum = MAX_OBJECT_BYTES) {
  if (!Number.isSafeInteger(value) || value < 0 || value > maximum) throw new PrivateObjectStoreError("PRIVATE_OBJECT_SIZE_INVALID", 413);
  return value;
}

function safeFilename(value: string) {
  const normalized = value.normalize("NFKC").replace(/[^A-Za-z0-9._ -]/g, "_").replace(/\s+/g, " ").trim().slice(0, 120);
  if (!normalized || normalized === "." || normalized === "..") throw new PrivateObjectStoreError("PRIVATE_OBJECT_FILENAME_INVALID", 400);
  return normalized;
}

function assertWithin(root: string, target: string) {
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new PrivateObjectStoreError("PRIVATE_OBJECT_PATH_ESCAPE", 400);
}

export function createFileSystemPrivateObjectStore(rootValue: string): PrivateObjectStore {
  const configuredRoot = path.resolve(rootValue);
  async function root() {
    await mkdir(configuredRoot, { recursive: true });
    const stat = await lstat(configuredRoot);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new PrivateObjectStoreError("PRIVATE_OBJECT_ROOT_UNSAFE");
    return realpath(configuredRoot);
  }
  async function target(key: string) {
    const safeRoot = await root();
    const resolved = path.resolve(safeRoot, ...validatePrivateObjectKey(key).split("/"));
    assertWithin(safeRoot, resolved);
    return { safeRoot, resolved };
  }
  async function safeExisting(key: string) {
    const { safeRoot, resolved } = await target(key);
    const stat = await lstat(resolved).catch(() => null);
    if (!stat) return null;
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_OBJECT_BYTES) throw new PrivateObjectStoreError("PRIVATE_OBJECT_ENTRY_UNSAFE");
    const real = await realpath(resolved);
    assertWithin(safeRoot, real);
    return { path: real, stat };
  }
  async function metadata(key: string): Promise<PrivateObjectMetadata | null> {
    const existing = await safeExisting(key);
    if (!existing) return null;
    const bytes = await readFile(existing.path);
    return { key, byteSize: bytes.length, sha256: sha256(bytes), contentType: "application/octet-stream", version: null, lastModified: existing.stat.mtime };
  }
  return {
    kind: "FILESYSTEM",
    async putPrivateObject(input) {
      validatePrivateObjectKey(input.key);
      validateSha256(input.sha256);
      validateContentType(input.contentType);
      boundedBytes(input.bytes.length);
      if (sha256(input.bytes) !== input.sha256) throw new PrivateObjectStoreError("PRIVATE_OBJECT_CHECKSUM_MISMATCH", 409);
      const { safeRoot, resolved } = await target(input.key);
      await mkdir(path.dirname(resolved), { recursive: true });
      const directory = await realpath(path.dirname(resolved));
      assertWithin(safeRoot, directory);
      const temporary = `${resolved}.${process.pid}.tmp`;
      const handle = await open(temporary, "wx", 0o600);
      try { await handle.writeFile(input.bytes); await handle.sync(); }
      finally { await handle.close(); }
      try {
        await link(temporary, resolved);
      } catch (error) {
        const existing = await metadata(input.key).catch(() => null);
        if (!existing || existing.byteSize !== input.bytes.length || existing.sha256 !== input.sha256) {
          throw new PrivateObjectStoreError("PRIVATE_OBJECT_ALREADY_EXISTS", 409);
        }
      } finally {
        await rm(temporary, { force: true });
      }
      const stat = await lstat(resolved);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== input.bytes.length) throw new PrivateObjectStoreError("PRIVATE_OBJECT_WRITE_VERIFY_FAILED");
      return { key: input.key, byteSize: stat.size, sha256: input.sha256, contentType: input.contentType, version: null, lastModified: stat.mtime };
    },
    async getPrivateObject(key, maximumBytes = MAX_OBJECT_BYTES) {
      const existing = await safeExisting(validatePrivateObjectKey(key));
      if (!existing) throw new PrivateObjectStoreError("PRIVATE_OBJECT_NOT_FOUND", 404);
      boundedBytes(existing.stat.size, maximumBytes);
      const bytes = await readFile(existing.path);
      return { bytes, metadata: { key, byteSize: bytes.length, sha256: sha256(bytes), contentType: "application/octet-stream", version: null, lastModified: existing.stat.mtime } };
    },
    async streamPrivateObject(key, maximumBytes = MAX_OBJECT_BYTES) {
      const existing = await safeExisting(validatePrivateObjectKey(key));
      if (!existing) throw new PrivateObjectStoreError("PRIVATE_OBJECT_NOT_FOUND", 404);
      boundedBytes(existing.stat.size, maximumBytes);
      return { stream: createReadStream(existing.path), metadata: { key, byteSize: existing.stat.size, sha256: "", contentType: "application/octet-stream", version: null, lastModified: existing.stat.mtime } };
    },
    statPrivateObject: metadata,
    async deleteGovernedObject(key, expectedVersion) {
      if (expectedVersion) throw new PrivateObjectStoreError("FILESYSTEM_OBJECT_VERSION_UNSUPPORTED", 409);
      const existing = await safeExisting(validatePrivateObjectKey(key));
      if (!existing) return { deleted: false };
      await rm(existing.path, { force: false });
      return { deleted: true };
    },
    async copyPrivateObject(sourceKey, destinationKey) {
      const source = await this.getPrivateObject(sourceKey);
      return this.putPrivateObject({ key: destinationKey, bytes: source.bytes, sha256: source.metadata.sha256, contentType: source.metadata.contentType });
    },
    async listBoundedPrefix(prefix, limit) {
      validatePrefix(prefix);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_RESULTS) throw new PrivateObjectStoreError("PRIVATE_OBJECT_LIST_LIMIT_INVALID", 400);
      // Filesystem-wide traversal is deliberately omitted. Application callers
      // list governed database records and resolve exact opaque object keys.
      return [];
    },
    async authorizedDownloadUrl() { return null; },
    async verifyChecksum(key, expectedSha256) {
      validateSha256(expectedSha256);
      const object = await this.getPrivateObject(key);
      return object.metadata.sha256 === expectedSha256;
    },
    async healthCheck() {
      try { await root(); return { ready: true, safeCode: "OBJECT_STORE_READY" }; }
      catch { return { ready: false, safeCode: "OBJECT_STORE_UNAVAILABLE" }; }
    },
    close() { /* no open handle */ }
  };
}

export function createS3CompatiblePrivateObjectStore(environment: NodeJS.ProcessEnv = process.env): PrivateObjectStore {
  const endpoint = environment.S3_ENDPOINT?.trim() ?? "";
  const region = environment.S3_REGION?.trim() ?? "";
  const bucket = environment.S3_PRIVATE_BUCKET?.trim() ?? "";
  if (!/^https?:\/\//.test(endpoint) || !/^[a-z0-9][a-z0-9-]{0,31}$/.test(region) || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)) {
    throw new PrivateObjectStoreError("S3_CONFIGURATION_INVALID");
  }
  const deployment = (environment.NALANDA_ENVIRONMENT ?? environment.DEPLOYMENT_ENVIRONMENT ?? "").toLowerCase();
  if (new Set(["staging", "production"]).has(deployment) && !endpoint.startsWith("https://")) {
    throw new PrivateObjectStoreError("S3_TLS_REQUIRED");
  }
  const accessKeyId = readPortableSecret("S3_ACCESS_KEY_ID", environment, { required: true });
  const secretAccessKey = readPortableSecret("S3_SECRET_ACCESS_KEY", environment, { required: true });
  const requestTimeoutMs = Number(environment.S3_REQUEST_TIMEOUT_MS || 15_000);
  if (!Number.isSafeInteger(requestTimeoutMs) || requestTimeoutMs < 500 || requestTimeoutMs > 120_000) {
    throw new PrivateObjectStoreError("S3_TIMEOUT_INVALID");
  }
  const encryption = (environment.S3_SERVER_SIDE_ENCRYPTION || "AES256").trim();
  if (!new Set(["AES256", "aws:kms"]).has(encryption)) throw new PrivateObjectStoreError("S3_ENCRYPTION_INVALID");
  const kmsKeyId = environment.S3_KMS_KEY_ID?.trim();
  if (encryption === "aws:kms" && !kmsKeyId) throw new PrivateObjectStoreError("S3_KMS_KEY_REQUIRED");
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: environment.S3_FORCE_PATH_STYLE === "true",
    credentials: { accessKeyId, secretAccessKey },
    maxAttempts: 2
  });

  async function send<T = any>(command: any): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    try { return await (client as any).send(command, { abortSignal: controller.signal }) as T; }
    catch (error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404 || (error as { name?: string }).name === "NotFound") throw error;
      throw new PrivateObjectStoreError("S3_OPERATION_FAILED", 503);
    }
    finally { clearTimeout(timeout); }
  }

  function commonPut(input: PrivateObjectPutInput) {
    return {
      Bucket: bucket,
      Key: validatePrivateObjectKey(input.key),
      Body: input.bytes,
      ContentLength: boundedBytes(input.bytes.length),
      ContentType: validateContentType(input.contentType),
      ContentDisposition: input.contentDisposition ? `attachment; filename="${safeFilename(input.contentDisposition)}"` : undefined,
      ChecksumSHA256: Buffer.from(validateSha256(input.sha256), "hex").toString("base64"),
      Metadata: { sha256: input.sha256 },
      ServerSideEncryption: encryption as "AES256" | "aws:kms",
      SSEKMSKeyId: encryption === "aws:kms" ? kmsKeyId : undefined
    };
  }

  async function stat(key: string, versionId?: string): Promise<PrivateObjectMetadata | null> {
    try {
      const response = await send<any>(new HeadObjectCommand({ Bucket: bucket, Key: validatePrivateObjectKey(key), VersionId: versionId }));
      const byteSize = boundedBytes(Number(response.ContentLength ?? -1));
      const checksum = String(response.Metadata?.sha256 ?? "").toLowerCase();
      validateSha256(checksum);
      return { key, byteSize, sha256: checksum, contentType: String(response.ContentType || "application/octet-stream"), version: response.VersionId ?? null, lastModified: response.LastModified ?? null };
    } catch (error) {
      if ((error as { name?: string }).name === "NotFound" || (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404) return null;
      if (error instanceof PrivateObjectStoreError) throw error;
      throw new PrivateObjectStoreError("S3_OPERATION_FAILED", 503);
    }
  }

  return {
    kind: "S3_COMPATIBLE",
    async putPrivateObject(input) {
      validatePrivateObjectKey(input.key);
      validateSha256(input.sha256);
      boundedBytes(input.bytes.length);
      if (sha256(input.bytes) !== input.sha256) throw new PrivateObjectStoreError("PRIVATE_OBJECT_CHECKSUM_MISMATCH", 409);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const upload = new Upload({ client, params: commonPut(input), queueSize: 2, partSize: MULTIPART_PART_BYTES, leavePartsOnError: false, abortController: controller });
        await upload.done();
      } catch {
        throw new PrivateObjectStoreError("S3_UPLOAD_FAILED", 503);
      } finally { clearTimeout(timeout); }
      const written = await stat(input.key);
      if (!written || written.byteSize !== input.bytes.length || written.sha256 !== input.sha256) throw new PrivateObjectStoreError("S3_UPLOAD_VERIFY_FAILED", 503);
      return written;
    },
    async getPrivateObject(key, maximumBytes = MAX_OBJECT_BYTES) {
      const expected = await stat(validatePrivateObjectKey(key));
      if (!expected) throw new PrivateObjectStoreError("PRIVATE_OBJECT_NOT_FOUND", 404);
      boundedBytes(expected.byteSize, maximumBytes);
      const response = await send<any>(new GetObjectCommand({ Bucket: bucket, Key: key, ChecksumMode: "ENABLED" }));
      const bytes = Buffer.from(await response.Body.transformToByteArray());
      boundedBytes(bytes.length, maximumBytes);
      if (bytes.length !== expected.byteSize || sha256(bytes) !== expected.sha256) throw new PrivateObjectStoreError("PRIVATE_OBJECT_CHECKSUM_MISMATCH", 409);
      return { bytes, metadata: expected };
    },
    async streamPrivateObject(key, maximumBytes = MAX_OBJECT_BYTES) {
      const object = await this.getPrivateObject(key, maximumBytes);
      const { Readable } = await import("node:stream");
      return { stream: Readable.from(object.bytes), metadata: object.metadata };
    },
    statPrivateObject: stat,
    async deleteGovernedObject(key, expectedVersion) {
      const validatedKey = validatePrivateObjectKey(key);
      const existing = await stat(validatedKey, expectedVersion ?? undefined);
      if (!existing) return { deleted: false };
      if (expectedVersion && existing.version !== expectedVersion) throw new PrivateObjectStoreError("PRIVATE_OBJECT_VERSION_MISMATCH", 409);
      const exactVersion = expectedVersion ?? existing.version ?? undefined;
      await send(new DeleteObjectCommand({ Bucket: bucket, Key: validatedKey, VersionId: exactVersion }));
      if (exactVersion && await stat(validatedKey, exactVersion)) throw new PrivateObjectStoreError("PRIVATE_OBJECT_VERSION_DELETE_VERIFY_FAILED", 503);
      return { deleted: true };
    },
    async copyPrivateObject(sourceKey, destinationKey) {
      validatePrivateObjectKey(sourceKey);
      validatePrivateObjectKey(destinationKey);
      const source = await stat(sourceKey);
      if (!source) throw new PrivateObjectStoreError("PRIVATE_OBJECT_NOT_FOUND", 404);
      await send(new CopyObjectCommand({
        Bucket: bucket,
        Key: destinationKey,
        CopySource: `${encodeURIComponent(bucket)}/${sourceKey.split("/").map(encodeURIComponent).join("/")}`,
        MetadataDirective: "COPY",
        ServerSideEncryption: encryption as "AES256" | "aws:kms",
        SSEKMSKeyId: encryption === "aws:kms" ? kmsKeyId : undefined
      }));
      const copied = await stat(destinationKey);
      if (!copied || copied.sha256 !== source.sha256 || copied.byteSize !== source.byteSize) throw new PrivateObjectStoreError("PRIVATE_OBJECT_COPY_VERIFY_FAILED", 503);
      return copied;
    },
    async listBoundedPrefix(prefix, limit) {
      validatePrefix(prefix);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIST_RESULTS) throw new PrivateObjectStoreError("PRIVATE_OBJECT_LIST_LIMIT_INVALID", 400);
      const response = await send<any>(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, MaxKeys: limit }));
      return (response.Contents ?? []).flatMap((entry: any) => {
        const key = String(entry.Key ?? "");
        try { validatePrivateObjectKey(key); }
        catch { return []; }
        return [{ key, byteSize: boundedBytes(Number(entry.Size ?? 0)), sha256: "", contentType: "application/octet-stream", version: null, lastModified: entry.LastModified ?? null }];
      });
    },
    async authorizedDownloadUrl(input) {
      validatePrivateObjectKey(input.key);
      if (!Number.isInteger(input.expiresSeconds) || input.expiresSeconds < 30 || input.expiresSeconds > 300) throw new PrivateObjectStoreError("SIGNED_URL_TTL_INVALID", 400);
      validateContentType(input.contentType);
      return getSignedUrl(client, new GetObjectCommand({
        Bucket: bucket,
        Key: input.key,
        ResponseContentType: input.contentType,
        ResponseContentDisposition: `attachment; filename="${safeFilename(input.safeFilename)}"`
      }), { expiresIn: input.expiresSeconds });
    },
    async verifyChecksum(key, expectedSha256) {
      validateSha256(expectedSha256);
      const object = await this.getPrivateObject(key);
      return object.metadata.sha256 === expectedSha256;
    },
    async healthCheck() {
      try { await send(new GetBucketLocationCommand({ Bucket: bucket })); return { ready: true, safeCode: "OBJECT_STORE_READY" }; }
      catch { return { ready: false, safeCode: "OBJECT_STORE_UNAVAILABLE" }; }
    },
    close() { client.destroy(); }
  };
}

const globalState = globalThis as typeof globalThis & { __nalandaPrivateObjectStore?: PrivateObjectStore };

export function configuredPrivateObjectStore(environment: NodeJS.ProcessEnv = process.env) {
  if (globalState.__nalandaPrivateObjectStore) return globalState.__nalandaPrivateObjectStore;
  const provider = (environment.PRIVATE_OBJECT_STORAGE_PROVIDER || "FILESYSTEM").toUpperCase();
  const store = provider === "S3_COMPATIBLE"
    ? createS3CompatiblePrivateObjectStore(environment)
    : createFileSystemPrivateObjectStore(environment.PRIVATE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "private"));
  return globalState.__nalandaPrivateObjectStore = store;
}

export function modulePrivateObjectKey(module: "admissions" | "classwork" | "support" | "event-media" | "payslip" | "reports" | "exports" | "identity-cards" | "backups" | "onboarding" | "fee-register-ocr", storageKey: string) {
  if (!/^[a-z0-9][a-z0-9._/-]{0,220}$/i.test(storageKey) || storageKey.includes("..") || storageKey.includes("//") || /[\\{}\s\u0000-\u001f]/.test(storageKey)) {
    throw new PrivateObjectStoreError("MODULE_STORAGE_KEY_INVALID", 404);
  }
  return validatePrivateObjectKey(`private/${module}/${storageKey.toLowerCase()}`);
}

export function modulePrivateObjectPrefix(
  module: "admissions" | "classwork" | "support" | "event-media" | "payslip" | "reports" | "exports" | "identity-cards" | "backups" | "onboarding" | "fee-register-ocr",
  storagePrefix: string
) {
  const normalized = storagePrefix.toLowerCase().replace(/\/$/, "");
  if (!/^[a-z0-9][a-z0-9._/-]{0,220}$/.test(normalized) || normalized.includes("..") || normalized.includes("//") || /[\\{}\s\u0000-\u001f]/.test(normalized)) {
    throw new PrivateObjectStoreError("MODULE_STORAGE_PREFIX_INVALID", 400);
  }
  const prefix = `private/${module}/${normalized}`;
  validatePrefix(prefix);
  return prefix;
}
