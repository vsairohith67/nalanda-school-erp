import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes
} from "node:crypto";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

export const CLOUD_BACKUP_MAGIC = "NPSBACK1";
export const CLOUD_BACKUP_CONTAINER_VERSION = 1;
export const CLOUD_BACKUP_EXTENSION = ".npsbackup";
export const CLOUD_BACKUP_ALGORITHM = "AES-256-GCM";
export const CLOUD_BACKUP_COMPRESSION = "GZIP";
export const CLOUD_BACKUP_NONCE_BYTES = 12;
export const CLOUD_BACKUP_TAG_BYTES = 16;
export const CLOUD_BACKUP_MAX_HEADER_BYTES = 8 * 1024;
export const CLOUD_BACKUP_MAX_PLAINTEXT_BYTES = 256 * 1024 * 1024;

const MAGIC_BYTES = Buffer.from(CLOUD_BACKUP_MAGIC, "ascii");
const HEX_64 = /^[a-f0-9]{64}$/;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;
const KEY_VERSION = /^V[1-9][0-9]{0,2}$/;

type AuthenticatedHeader = {
  magic: typeof CLOUD_BACKUP_MAGIC;
  containerFormatVersion: typeof CLOUD_BACKUP_CONTAINER_VERSION;
  backupFormatVersion: number;
  createdAt: string;
  encryptionAlgorithm: typeof CLOUD_BACKUP_ALGORITHM;
  compressionAlgorithm: typeof CLOUD_BACKUP_COMPRESSION;
  encryptionKeyVersion: string;
  nonce: string;
  plaintextSha256: string;
  plaintextBytes: number;
  compressedBytes: number;
  ciphertextBytes: number;
};

export type CloudBackupContainerHeader = AuthenticatedHeader & {
  authenticationTag: string;
  ciphertextSha256: string;
};

export type EncryptedCloudBackup = {
  bytes: Buffer;
  header: CloudBackupContainerHeader;
};

export type DecryptedCloudBackup = {
  plaintext: Buffer;
  header: CloudBackupContainerHeader;
};

export class CloudBackupContainerError extends Error {
  constructor(
    public readonly code:
      | "CONTAINER_INVALID"
      | "CONTAINER_UNSUPPORTED"
      | "KEY_UNAVAILABLE"
      | "KEY_INVALID"
      | "CIPHERTEXT_HASH_MISMATCH"
      | "AUTHENTICATION_FAILED"
      | "DECOMPRESSION_FAILED"
      | "PLAINTEXT_HASH_MISMATCH",
    message: string
  ) {
    super(message);
    this.name = "CloudBackupContainerError";
  }
}

export function sha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function encryptionKeyEnvironmentName(version: string) {
  const normalized = requireKeyVersion(version);
  return `CLOUD_BACKUP_ENCRYPTION_KEY_${normalized}`;
}

export function loadCloudBackupKey(version: string, environment = process.env) {
  const name = encryptionKeyEnvironmentName(version);
  const encoded = environment[name]?.trim();
  if (!encoded) {
    throw new CloudBackupContainerError("KEY_UNAVAILABLE", `Encryption key ${version} is unavailable in the server environment.`);
  }
  if (!BASE64.test(encoded)) {
    throw new CloudBackupContainerError("KEY_INVALID", `Encryption key ${version} is not valid base64.`);
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new CloudBackupContainerError("KEY_INVALID", `Encryption key ${version} must decode to exactly 32 bytes.`);
  }
  return key;
}

export async function encryptCloudBackup(
  plaintext: Buffer,
  input: {
    backupFormatVersion: number;
    createdAt: Date;
    encryptionKeyVersion: string;
    key?: Buffer;
    nonce?: Buffer;
  }
): Promise<EncryptedCloudBackup> {
  if (!Buffer.isBuffer(plaintext) || !plaintext.length || plaintext.length > CLOUD_BACKUP_MAX_PLAINTEXT_BYTES) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Validated backup bytes are empty or exceed the container limit.");
  }
  if (!Number.isInteger(input.backupFormatVersion) || input.backupFormatVersion < 1 || input.backupFormatVersion > 999) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Backup format version is invalid.");
  }
  if (!(input.createdAt instanceof Date) || Number.isNaN(input.createdAt.getTime())) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Backup creation timestamp is invalid.");
  }

  const encryptionKeyVersion = requireKeyVersion(input.encryptionKeyVersion);
  const key = input.key ?? loadCloudBackupKey(encryptionKeyVersion);
  requireKey(key);
  const nonce = input.nonce ?? randomBytes(CLOUD_BACKUP_NONCE_BYTES);
  if (!Buffer.isBuffer(nonce) || nonce.length !== CLOUD_BACKUP_NONCE_BYTES) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "AES-GCM nonce must be exactly 12 bytes.");
  }

  const compressed = await gzipAsync(plaintext, { level: 9 });
  const authenticated: AuthenticatedHeader = {
    magic: CLOUD_BACKUP_MAGIC,
    containerFormatVersion: CLOUD_BACKUP_CONTAINER_VERSION,
    backupFormatVersion: input.backupFormatVersion,
    createdAt: input.createdAt.toISOString(),
    encryptionAlgorithm: CLOUD_BACKUP_ALGORITHM,
    compressionAlgorithm: CLOUD_BACKUP_COMPRESSION,
    encryptionKeyVersion,
    nonce: nonce.toString("base64"),
    plaintextSha256: sha256(plaintext),
    plaintextBytes: plaintext.length,
    compressedBytes: compressed.length,
    ciphertextBytes: compressed.length
  };
  const aad = canonicalAuthenticatedHeader(authenticated);
  const cipher = createCipheriv("aes-256-gcm", key, nonce, { authTagLength: CLOUD_BACKUP_TAG_BYTES });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(compressed), cipher.final()]);
  const header: CloudBackupContainerHeader = {
    ...authenticated,
    authenticationTag: cipher.getAuthTag().toString("base64"),
    ciphertextSha256: sha256(ciphertext)
  };
  return { bytes: serializeContainer(header, ciphertext), header };
}

export async function decryptCloudBackup(
  container: Buffer,
  options: { key?: Buffer; environment?: NodeJS.ProcessEnv; maximumPlaintextBytes?: number } = {}
): Promise<DecryptedCloudBackup> {
  const { header, ciphertext } = parseCloudBackupContainer(container);
  if (sha256(ciphertext) !== header.ciphertextSha256) {
    throw new CloudBackupContainerError("CIPHERTEXT_HASH_MISMATCH", "Encrypted backup ciphertext hash verification failed.");
  }
  const key = options.key ?? loadCloudBackupKey(header.encryptionKeyVersion, options.environment);
  requireKey(key);
  const nonce = decodeExactBase64(header.nonce, CLOUD_BACKUP_NONCE_BYTES, "nonce");
  const tag = decodeExactBase64(header.authenticationTag, CLOUD_BACKUP_TAG_BYTES, "authentication tag");
  const authenticated = authenticatedHeaderFrom(header);
  let compressed: Buffer;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, nonce, { authTagLength: CLOUD_BACKUP_TAG_BYTES });
    decipher.setAAD(canonicalAuthenticatedHeader(authenticated));
    decipher.setAuthTag(tag);
    compressed = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new CloudBackupContainerError("AUTHENTICATION_FAILED", "Encrypted backup authentication failed.");
  }
  if (compressed.length !== header.compressedBytes) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Authenticated compressed size does not match the container header.");
  }
  const maximumPlaintextBytes = options.maximumPlaintextBytes ?? CLOUD_BACKUP_MAX_PLAINTEXT_BYTES;
  let plaintext: Buffer;
  try {
    plaintext = await gunzipAsync(compressed, { maxOutputLength: maximumPlaintextBytes });
  } catch {
    throw new CloudBackupContainerError("DECOMPRESSION_FAILED", "Authenticated backup decompression failed.");
  }
  if (plaintext.length !== header.plaintextBytes || sha256(plaintext) !== header.plaintextSha256) {
    throw new CloudBackupContainerError("PLAINTEXT_HASH_MISMATCH", "Decrypted backup plaintext hash verification failed.");
  }
  return { plaintext, header };
}

export function parseCloudBackupContainer(container: Buffer) {
  if (!Buffer.isBuffer(container) || container.length < MAGIC_BYTES.length + 4 + 2) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup container is truncated.");
  }
  if (!container.subarray(0, MAGIC_BYTES.length).equals(MAGIC_BYTES)) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup magic identifier is invalid.");
  }
  const headerLength = container.readUInt32BE(MAGIC_BYTES.length);
  if (headerLength < 2 || headerLength > CLOUD_BACKUP_MAX_HEADER_BYTES) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header length is invalid.");
  }
  const headerStart = MAGIC_BYTES.length + 4;
  const ciphertextStart = headerStart + headerLength;
  if (ciphertextStart >= container.length) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup ciphertext is missing.");
  }
  let raw: unknown;
  try {
    raw = JSON.parse(container.subarray(headerStart, ciphertextStart).toString("utf8"));
  } catch {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header JSON is invalid.");
  }
  const header = validateHeader(raw);
  const ciphertext = container.subarray(ciphertextStart);
  if (ciphertext.length !== header.ciphertextBytes) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup ciphertext size does not match the header.");
  }
  return { header, ciphertext };
}

function serializeContainer(header: CloudBackupContainerHeader, ciphertext: Buffer) {
  const headerBytes = Buffer.from(JSON.stringify(header), "utf8");
  if (headerBytes.length > CLOUD_BACKUP_MAX_HEADER_BYTES) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header exceeds the size limit.");
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(headerBytes.length);
  return Buffer.concat([MAGIC_BYTES, length, headerBytes, ciphertext]);
}

function validateHeader(value: unknown): CloudBackupContainerHeader {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header must be an object.");
  }
  const raw = value as Record<string, unknown>;
  const allowed = new Set([
    "magic", "containerFormatVersion", "backupFormatVersion", "createdAt",
    "encryptionAlgorithm", "compressionAlgorithm", "encryptionKeyVersion", "nonce",
    "authenticationTag", "plaintextSha256", "ciphertextSha256", "plaintextBytes",
    "compressedBytes", "ciphertextBytes"
  ]);
  if (Object.keys(raw).some((key) => !allowed.has(key)) || Object.keys(raw).length !== allowed.size) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header fields are invalid.");
  }
  if (raw.magic !== CLOUD_BACKUP_MAGIC) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup header magic is invalid.");
  }
  if (raw.containerFormatVersion !== CLOUD_BACKUP_CONTAINER_VERSION) {
    throw new CloudBackupContainerError("CONTAINER_UNSUPPORTED", "Encrypted backup container version is unsupported.");
  }
  if (raw.encryptionAlgorithm !== CLOUD_BACKUP_ALGORITHM || raw.compressionAlgorithm !== CLOUD_BACKUP_COMPRESSION) {
    throw new CloudBackupContainerError("CONTAINER_UNSUPPORTED", "Encrypted backup algorithms are unsupported.");
  }
  const createdAt = requireString(raw.createdAt, "createdAt");
  if (new Date(createdAt).toISOString() !== createdAt) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup timestamp is invalid.");
  }
  const backupFormatVersion = requireInteger(raw.backupFormatVersion, "backupFormatVersion", 1, 999);
  const plaintextBytes = requireInteger(raw.plaintextBytes, "plaintextBytes", 1, CLOUD_BACKUP_MAX_PLAINTEXT_BYTES);
  const compressedBytes = requireInteger(raw.compressedBytes, "compressedBytes", 1, CLOUD_BACKUP_MAX_PLAINTEXT_BYTES);
  const ciphertextBytes = requireInteger(raw.ciphertextBytes, "ciphertextBytes", 1, CLOUD_BACKUP_MAX_PLAINTEXT_BYTES);
  if (compressedBytes !== ciphertextBytes) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encrypted backup compressed and ciphertext sizes are inconsistent.");
  }
  const plaintextSha256 = requireHash(raw.plaintextSha256, "plaintextSha256");
  const ciphertextSha256 = requireHash(raw.ciphertextSha256, "ciphertextSha256");
  const encryptionKeyVersion = requireKeyVersion(raw.encryptionKeyVersion);
  const nonce = requireString(raw.nonce, "nonce");
  const authenticationTag = requireString(raw.authenticationTag, "authenticationTag");
  decodeExactBase64(nonce, CLOUD_BACKUP_NONCE_BYTES, "nonce");
  decodeExactBase64(authenticationTag, CLOUD_BACKUP_TAG_BYTES, "authentication tag");
  return {
    magic: CLOUD_BACKUP_MAGIC,
    containerFormatVersion: CLOUD_BACKUP_CONTAINER_VERSION,
    backupFormatVersion,
    createdAt,
    encryptionAlgorithm: CLOUD_BACKUP_ALGORITHM,
    compressionAlgorithm: CLOUD_BACKUP_COMPRESSION,
    encryptionKeyVersion,
    nonce,
    authenticationTag,
    plaintextSha256,
    ciphertextSha256,
    plaintextBytes,
    compressedBytes,
    ciphertextBytes
  };
}

function authenticatedHeaderFrom(header: CloudBackupContainerHeader): AuthenticatedHeader {
  const {
    authenticationTag: _authenticationTag,
    ciphertextSha256: _ciphertextSha256,
    ...authenticated
  } = header;
  return authenticated;
}

function canonicalAuthenticatedHeader(header: AuthenticatedHeader) {
  return Buffer.from(JSON.stringify(header), "utf8");
}

function requireKey(key: Buffer) {
  if (!Buffer.isBuffer(key) || key.length !== 32) {
    throw new CloudBackupContainerError("KEY_INVALID", "AES-256-GCM key must be exactly 32 bytes.");
  }
}

function requireKeyVersion(value: unknown) {
  const version = requireString(value, "encryptionKeyVersion").toUpperCase();
  if (!KEY_VERSION.test(version)) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", "Encryption key version must use V1 through V999.");
  }
  return version;
}

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.length || value.length > 200) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", `Encrypted backup ${field} is invalid.`);
  }
  return value;
}

function requireHash(value: unknown, field: string) {
  const hash = requireString(value, field);
  if (!HEX_64.test(hash)) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", `Encrypted backup ${field} is invalid.`);
  }
  return hash;
}

function requireInteger(value: unknown, field: string, minimum: number, maximum: number) {
  if (!Number.isInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", `Encrypted backup ${field} is invalid.`);
  }
  return Number(value);
}

function decodeExactBase64(value: string, length: number, label: string) {
  if (!BASE64.test(value)) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", `Encrypted backup ${label} is invalid.`);
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== length || decoded.toString("base64").replace(/=+$/, "") !== value.replace(/=+$/, "")) {
    throw new CloudBackupContainerError("CONTAINER_INVALID", `Encrypted backup ${label} has an invalid length.`);
  }
  return decoded;
}
