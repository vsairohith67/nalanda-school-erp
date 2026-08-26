import { createHash, randomUUID } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { mkdir, lstat, readFile, realpath, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

export const FEE_REGISTER_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FeeRegisterImageType = (typeof FEE_REGISTER_IMAGE_TYPES)[number];

const EXTENSIONS: Record<FeeRegisterImageType, readonly string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"]
};

export type ValidatedRegisterImage = {
  bytes: Buffer;
  mimeType: FeeRegisterImageType;
  extension: string;
  displayName: string;
  byteSize: number;
  width: number;
  height: number;
  sha256: string;
};

export function feeRegisterStorageRoot() {
  const configured = process.env.FEE_REGISTER_OCR_STORAGE_DIR?.trim();
  const root = resolvePortablePath(configured || path.join(process.cwd(), "data", "fee-register-ocr"));
  const publicRoot = path.resolve(process.cwd(), "public");
  if (root === publicRoot || root.startsWith(`${publicRoot}${path.sep}`)) {
    throw new Error("Fee-register OCR storage must not be inside the public directory");
  }
  return root;
}

export function sanitizeRegisterDisplayName(value: string) {
  const base = path.basename(value || "register-image")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return (base || "register-image").slice(0, 180);
}

export function validateRegisterImage(
  input: { bytes: Buffer; filename: string; declaredMime?: string | null },
  limits: { maximumFileBytes: number; maximumImagePixels: number }
): ValidatedRegisterImage {
  const { bytes } = input;
  if (!bytes.length) throw new Error("The uploaded register image is empty");
  if (bytes.length > limits.maximumFileBytes) throw new Error("The register image exceeds the configured file-size limit");
  const detected = detectImage(bytes);
  if (!detected) throw new Error("Only valid JPEG, PNG, or WebP register images are supported");
  const extension = path.extname(input.filename).toLowerCase();
  if (!EXTENSIONS[detected.mimeType].includes(extension)) {
    throw new Error("The filename extension does not match the image content");
  }
  if (input.declaredMime && input.declaredMime !== detected.mimeType) {
    throw new Error("The declared file type does not match the image content");
  }
  const pixels = detected.width * detected.height;
  if (!Number.isSafeInteger(pixels) || pixels <= 0 || pixels > limits.maximumImagePixels) {
    throw new Error("The register image dimensions exceed the configured safety limit");
  }
  return {
    bytes,
    mimeType: detected.mimeType,
    extension: EXTENSIONS[detected.mimeType][0],
    displayName: sanitizeRegisterDisplayName(input.filename),
    byteSize: bytes.length,
    width: detected.width,
    height: detected.height,
    sha256: createHash("sha256").update(bytes).digest("hex")
  };
}

export async function storeRegisterImage(image: ValidatedRegisterImage) {
  const root = await ensureStorageRoot();
  const storageKey = `${randomUUID().replaceAll("-", "")}${image.extension}`;
  const target = safeChild(root, storageKey);
  await writeFile(target, image.bytes, { flag: "wx", mode: 0o600 });
  return storageKey;
}

export async function readRegisterImage(storageKey: string, expectedSha256?: string, expectedByteSize?: number) {
  const root = await ensureStorageRoot();
  validateStorageKey(storageKey);
  const target = safeChild(root, storageKey);
  const stat = await lstat(target).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink()) throw new Error("OCR source image is unavailable");
  const resolved = await realpath(target);
  assertWithin(root, resolved);
  const bytes = await readFile(resolved);
  if (expectedByteSize !== undefined && bytes.length !== expectedByteSize) throw new Error("OCR source image failed size verification");
  if (expectedSha256 !== undefined && createHash("sha256").update(bytes).digest("hex") !== expectedSha256.toLowerCase()) throw new Error("OCR source image failed SHA-256 verification");
  return bytes;
}

export async function registerImageExists(storageKey: string) {
  try {
    await readRegisterImage(storageKey);
    return true;
  } catch {
    return false;
  }
}

export async function purgeRegisterImage(storageKey: string) {
  const root = await ensureStorageRoot();
  validateStorageKey(storageKey);
  const target = safeChild(root, storageKey);
  const stat = await lstat(target).catch(() => null);
  if (!stat) return false;
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error("OCR source storage entry is unsafe");
  const resolved = await realpath(target);
  assertWithin(root, resolved);
  await unlink(resolved);
  return true;
}

function validateStorageKey(storageKey: string) {
  if (!/^[a-f0-9]{32}\.(jpg|png|webp)$/.test(storageKey)) throw new Error("Invalid OCR source storage key");
}

async function ensureStorageRoot() {
  const configured = feeRegisterStorageRoot();
  await mkdir(configured, { recursive: true });
  const configuredStat = await lstat(configured);
  if (!configuredStat.isDirectory() || configuredStat.isSymbolicLink()) throw new Error("OCR source storage root is unsafe");
  const root = await realpath(configured);
  const publicRoot = await realpath(path.resolve(process.cwd(), "public"));
  assertPrivateFeeRegisterStorageRoot(configured, root, publicRoot, configuredStat.isSymbolicLink());
  return root;
}

export function assertPrivateFeeRegisterStorageRoot(configured: string, resolvedRoot: string, resolvedPublicRoot: string, configuredIsSymbolicLink: boolean) {
  if (configuredIsSymbolicLink) throw new Error("OCR source storage root must not be a symbolic link or junction");
  const portableConfigured = resolvePortablePath(configured);
  const portableResolvedRoot = resolvePortablePath(resolvedRoot);
  const portablePublicRoot = resolvePortablePath(resolvedPublicRoot);
  const relativeToPublic = path.relative(portablePublicRoot, portableResolvedRoot);
  if (relativeToPublic === "" || (!relativeToPublic.startsWith(`..${path.sep}`) && relativeToPublic !== ".." && !path.isAbsolute(relativeToPublic))) {
    throw new Error("Fee-register OCR storage must not resolve inside the public directory");
  }
  const canonicalConfigured = existsSync(portableConfigured)
    ? realpathSync.native(portableConfigured)
    : portableConfigured;
  const relativeToConfigured = path.relative(canonicalConfigured, portableResolvedRoot);
  if (relativeToConfigured !== "") throw new Error("OCR source storage root resolved to an unexpected location");
}

function resolvePortablePath(candidate: string) {
  const normalized = process.platform === "win32"
    ? candidate.replaceAll("/", "\\")
    : candidate.replaceAll("\\", "/");
  return path.resolve(normalized);
}

function safeChild(root: string, storageKey: string) {
  const target = path.resolve(root, storageKey);
  assertWithin(root, target);
  return target;
}

function assertWithin(root: string, target: string) {
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new Error("OCR source path escaped private storage");
}

function detectImage(bytes: Buffer): { mimeType: FeeRegisterImageType; width: number; height: number } | null {
  if (bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return detectPng(bytes);
  }
  if (bytes.length >= 20 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    return detectWebp(bytes);
  }
  if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) return null;
    let offset = 2;
    let dimensions: { width: number; height: number } | null = null;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) { offset++; continue; }
      const marker = bytes[offset + 1];
      if (marker === 0xd9) break;
      if (marker === 0xda) return dimensions ? { mimeType: "image/jpeg", ...dimensions } : null;
      if (marker >= 0xd0 && marker <= 0xd7) { offset += 2; continue; }
      const length = bytes.readUInt16BE(offset + 2);
      if (length < 2 || offset + 2 + length > bytes.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        const height = bytes.readUInt16BE(offset + 5), width = bytes.readUInt16BE(offset + 7);
        if (!width || !height) return null;
        dimensions = { width, height };
      }
      offset += 2 + length;
    }
    return dimensions ? { mimeType: "image/jpeg", ...dimensions } : null;
  }
  return null;
}

function detectPng(bytes: Buffer) {
  let offset = 8, width = 0, height = 0, sawHeader = false, sawImageData = false, sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const typeStart = offset + 4, dataStart = offset + 8, dataEnd = dataStart + length, chunkEnd = dataEnd + 4;
    if (length > bytes.length || chunkEnd > bytes.length) return null;
    const typeBytes = bytes.subarray(typeStart, dataStart), type = typeBytes.toString("ascii");
    const expectedCrc = bytes.readUInt32BE(dataEnd);
    if (crc32(Buffer.concat([typeBytes, bytes.subarray(dataStart, dataEnd)])) !== expectedCrc) return null;
    if (!sawHeader && (type !== "IHDR" || length !== 13)) return null;
    if (type === "IHDR") {
      if (sawHeader || length !== 13) return null;
      width = bytes.readUInt32BE(dataStart);
      height = bytes.readUInt32BE(dataStart + 4);
      sawHeader = true;
    } else if (type === "acTL" || type === "fcTL" || type === "fdAT") {
      throw new Error("Animated PNG register images are not supported");
    } else if (type === "IDAT") {
      sawImageData = true;
    } else if (type === "IEND") {
      if (length !== 0) return null;
      sawEnd = true;
      offset = chunkEnd;
      break;
    }
    offset = chunkEnd;
  }
  if (!sawHeader || !sawImageData || !sawEnd || offset !== bytes.length || !width || !height) return null;
  return { mimeType: "image/png" as const, width, height };
}

function detectWebp(bytes: Buffer) {
  if (bytes.readUInt32LE(4) + 8 !== bytes.length) return null;
  let offset = 12, dimensions: { width: number; height: number } | null = null, sawImage = false;
  while (offset + 8 <= bytes.length) {
    const kind = bytes.toString("ascii", offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
    const dataStart = offset + 8, dataEnd = dataStart + length, chunkEnd = dataEnd + (length % 2);
    if (dataEnd > bytes.length || chunkEnd > bytes.length) return null;
    if (kind === "ANIM" || kind === "ANMF") throw new Error("Animated WebP register images are not supported");
    if (kind === "VP8X") {
      if (length < 10) return null;
      if ((bytes[dataStart] & 0x02) !== 0) throw new Error("Animated WebP register images are not supported");
      dimensions = { width: 1 + bytes.readUIntLE(dataStart + 4, 3), height: 1 + bytes.readUIntLE(dataStart + 7, 3) };
    } else if (kind === "VP8 ") {
      if (length < 10 || bytes[dataStart + 3] !== 0x9d || bytes[dataStart + 4] !== 0x01 || bytes[dataStart + 5] !== 0x2a) return null;
      dimensions = { width: bytes.readUInt16LE(dataStart + 6) & 0x3fff, height: bytes.readUInt16LE(dataStart + 8) & 0x3fff };
      sawImage = true;
    } else if (kind === "VP8L") {
      if (length < 5 || bytes[dataStart] !== 0x2f) return null;
      const bits = bytes.readUInt32LE(dataStart + 1);
      dimensions = { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
      sawImage = true;
    }
    offset = chunkEnd;
  }
  if (offset !== bytes.length || !dimensions || !sawImage || !dimensions.width || !dimensions.height) return null;
  return { mimeType: "image/webp" as const, ...dimensions };
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
