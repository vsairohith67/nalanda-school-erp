import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata } from "sharp";
import { validatePayslipPdf } from "@/lib/payslip-request-pdf";

export const SUPPORT_PUBLIC_FILE_MAX_BYTES = 2 * 1024 * 1024;
export const SUPPORT_AUTH_FILE_MAX_BYTES = 5 * 1024 * 1024;
export const SUPPORT_AUTH_ATTACHMENT_LIMIT = 5;
export const SUPPORT_AUTH_ATTACHMENT_QUOTA = 20 * 1024 * 1024;
const PUBLIC_IMAGE_DIMENSION = 4_096;
const AUTH_IMAGE_DIMENSION = 8_000;
const STORAGE_KEY = /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:pdf|png|jpg|webp)$/;
const IMAGE_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" } as const;

export type ValidatedSupportFile = {
  bytes: Buffer;
  extension: ".pdf" | ".png" | ".jpg" | ".webp";
  mediaType: "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
  safeDisplayName: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
  pageCount: number | null;
};

export class SupportFileError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "SUPPORT_FILE_INVALID") { super(message); }
}

export async function validateSupportUpload(file: Pick<File, "name" | "type" | "size" | "arrayBuffer">, scope: "PUBLIC" | "AUTHENTICATED"): Promise<ValidatedSupportFile> {
  if (!file || typeof file.name !== "string" || !file.name.trim()) throw new SupportFileError("Choose a file to upload.");
  if (/[/\\\u0000]/.test(file.name) || file.name === "." || file.name === "..") throw new SupportFileError("The file name is unsafe.");
  const maximum = scope === "PUBLIC" ? SUPPORT_PUBLIC_FILE_MAX_BYTES : SUPPORT_AUTH_FILE_MAX_BYTES;
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > maximum) throw new SupportFileError(`The attachment must be between 1 byte and ${scope === "PUBLIC" ? "2" : "5"} MB.`, 413);
  const rawExtension = path.extname(file.name).toLowerCase();
  if (rawExtension === ".pdf") {
    if (scope === "PUBLIC") throw new SupportFileError("Public support accepts one PNG, JPEG, or still WebP screenshot only.");
    const validated = await validatePayslipPdf(file);
    if (validated.byteSize > maximum) throw new SupportFileError("Authenticated support PDFs must not exceed 5 MB.", 413);
    return { bytes: validated.bytes, extension: ".pdf", mediaType: "application/pdf", safeDisplayName: "Private support attachment.pdf", byteSize: validated.byteSize, sha256: validated.sha256, width: null, height: null, pageCount: validated.pageCount };
  }
  if (!(rawExtension in IMAGE_TYPES)) throw new SupportFileError(scope === "PUBLIC" ? "Public support accepts one PNG, JPEG, or still WebP screenshot only." : "Only PDF, PNG, JPEG, and still WebP attachments are allowed.");
  const declared = file.type.toLowerCase();
  const expected = IMAGE_TYPES[rawExtension as keyof typeof IMAGE_TYPES];
  if (declared !== expected) throw new SupportFileError("The attachment extension and MIME type do not match.");
  const source = Buffer.from(await file.arrayBuffer());
  if (source.length !== file.size || source.length > maximum || detectMagic(source) !== expected) throw new SupportFileError("The attachment content is truncated, oversized, or does not match its declared type.");
  const dimensionLimit = scope === "PUBLIC" ? PUBLIC_IMAGE_DIMENSION : AUTH_IMAGE_DIMENSION;
  let metadata: Metadata;
  try { metadata = await sharp(source, { animated: true, limitInputPixels: dimensionLimit ** 2 }).metadata(); }
  catch { throw new SupportFileError("The image is malformed or exceeds the processing limit."); }
  if ((metadata.pages ?? 1) !== 1 || metadata.pageHeight || !metadata.width || !metadata.height || metadata.width > dimensionLimit || metadata.height > dimensionLimit) throw new SupportFileError(`Only still images up to ${dimensionLimit} by ${dimensionLimit} pixels are allowed.`);
  let output: Buffer;
  try {
    const pipeline = sharp(source, { animated: false, limitInputPixels: dimensionLimit ** 2 }).rotate();
    output = rawExtension === ".png" ? await pipeline.png({ compressionLevel: 9 }).toBuffer()
      : rawExtension === ".webp" ? await pipeline.webp({ quality: 90, effort: 5 }).toBuffer()
      : await pipeline.jpeg({ quality: 90, mozjpeg: true }).toBuffer();
  } catch { throw new SupportFileError("The image could not be safely normalised."); }
  if (output.length < 1 || output.length > maximum) throw new SupportFileError("The normalised image exceeds the supported size limit.", 413);
  const normalizedExtension = rawExtension === ".jpeg" ? ".jpg" : rawExtension as ".png" | ".jpg" | ".webp";
  const normalizedMetadata = await sharp(output, { animated: true, limitInputPixels: dimensionLimit ** 2 }).metadata();
  if ((normalizedMetadata.pages ?? 1) !== 1 || !normalizedMetadata.width || !normalizedMetadata.height) throw new SupportFileError("The normalised image failed validation.");
  return { bytes: output, extension: normalizedExtension, mediaType: expected, safeDisplayName: `Private support attachment${normalizedExtension}`, byteSize: output.length, sha256: digest(output), width: normalizedMetadata.width, height: normalizedMetadata.height, pageCount: null };
}

export function supportStorageRoot() { return path.resolve(process.env.SUPPORT_PRIVATE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "support")); }

export async function storeSupportFile(file: ValidatedSupportFile) {
  const token = randomUUID().toLowerCase();
  const storageKey = `${token.slice(0, 2)}/${token.slice(2, 4)}/${token}${file.extension}`;
  const target = resolveSupportStorageKey(storageKey);
  await assertNoSymlinkPath(supportStorageRoot());
  await mkdir(path.dirname(target), { recursive: true });
  await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(file.bytes); await handle.sync(); } finally { await handle.close(); }
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.byteSize) throw new SupportFileError("Private attachment storage verification failed.", 500);
  return storageKey;
}

export async function readSupportFile(storageKey: string, expectedSha256: string) {
  const target = resolveSupportStorageKey(storageKey);
  await assertNoSymlinkPath(path.dirname(target));
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > SUPPORT_AUTH_FILE_MAX_BYTES) throw new SupportFileError("The private attachment is unavailable.", 404);
  const bytes = await readFile(target);
  if (digest(bytes) !== expectedSha256.toLowerCase()) throw new SupportFileError("The private attachment failed integrity verification.", 409);
  return bytes;
}

export async function rollbackStoredSupportFile(storageKey: string) {
  const target = resolveSupportStorageKey(storageKey);
  const stat = await lstat(target).catch(() => null);
  if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true });
}

export function resolveSupportStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new SupportFileError("The private attachment key is invalid.", 404);
  const root = supportStorageRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new SupportFileError("The private attachment key is invalid.", 404);
  return target;
}

export function assertSupportAttachmentQuota(existing: Array<{ byteSize: number }>, nextBytes: number, scope: "PUBLIC" | "AUTHENTICATED") {
  const countLimit = scope === "PUBLIC" ? 1 : SUPPORT_AUTH_ATTACHMENT_LIMIT;
  const byteLimit = scope === "PUBLIC" ? SUPPORT_PUBLIC_FILE_MAX_BYTES : SUPPORT_AUTH_ATTACHMENT_QUOTA;
  if (existing.length >= countLimit || existing.reduce((sum, row) => sum + row.byteSize, 0) + nextBytes > byteLimit) throw new SupportFileError("The private support attachment quota has been reached.", 413);
}

function detectMagic(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return "image/jpeg";
  if (bytes.length >= 20 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP" && bytes.readUInt32LE(4) + 8 === bytes.length && !bytes.includes(Buffer.from("ANIM")) && !bytes.includes(Buffer.from("ANMF"))) return "image/webp";
  return null;
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  const relative = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of relative) { current = path.join(current, part); const stat = await lstat(current).catch(() => null); if (stat?.isSymbolicLink()) throw new SupportFileError("Private storage paths may not contain symlinks.", 500); }
  const rootStat = await lstat(supportStorageRoot()).catch(() => null);
  if (rootStat && (!rootStat.isDirectory() || rootStat.isSymbolicLink())) throw new SupportFileError("The private support storage root is unsafe.", 500);
  if (rootStat) await realpath(supportStorageRoot());
}

function digest(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
