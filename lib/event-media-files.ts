import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { validatedPrivateStorageRoot } from "@/lib/private-storage-root";

export const EVENT_MEDIA_MAX_FILE_BYTES = 15 * 1024 * 1024;
export const EVENT_MEDIA_MAX_INPUT_PIXELS = 40_000_000;
export const EVENT_MEDIA_MAX_DIMENSION = 12_000;
export const EVENT_MEDIA_THUMBNAIL_BOUND = 720;

const TYPES = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
} as const;
const STORAGE_KEY = /^(?:original|derivative)\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/;

export type ValidatedEventMediaUpload = {
  bytes: Buffer;
  extension: ".png" | ".jpg" | ".webp";
  mediaType: "image/png" | "image/jpeg" | "image/webp";
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
};

export type EventMediaThumbnail = {
  bytes: Buffer;
  extension: ".jpg";
  mediaType: "image/jpeg";
  byteSize: number;
  sha256: string;
  width: number;
  height: number;
  metadataStripped: true;
};

export class EventMediaFileError extends Error {
  constructor(message: string, public status = 400, public code = "EVENT_MEDIA_FILE_INVALID") { super(message); }
}

export async function validateEventMediaUpload(file: Pick<File, "name" | "type" | "size" | "arrayBuffer">): Promise<ValidatedEventMediaUpload> {
  if (!file || typeof file.name !== "string" || !file.name.trim()) throw new EventMediaFileError("Choose a photo to upload.");
  if (/[/\\\u0000]/.test(file.name) || file.name === "." || file.name === "..") throw new EventMediaFileError("The file name is unsafe.", 400, "UNSAFE_FILENAME");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > EVENT_MEDIA_MAX_FILE_BYTES) throw new EventMediaFileError("Photos must be between 1 byte and 15 MB.", 413, "FILE_TOO_LARGE");
  const rawExtension = path.extname(file.name).toLowerCase();
  if (!(rawExtension in TYPES)) throw new EventMediaFileError("Only PNG, JPEG, and still WebP photos are allowed.", 415, "UNSUPPORTED_FORMAT");
  const expectedMime = TYPES[rawExtension as keyof typeof TYPES];
  if (file.type.toLowerCase() !== expectedMime) throw new EventMediaFileError("The file extension and browser MIME type do not match.", 415, "MIME_MISMATCH");
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > EVENT_MEDIA_MAX_FILE_BYTES) throw new EventMediaFileError("The uploaded photo is truncated or exceeds the size limit.", 413, "FILE_SIZE_MISMATCH");
  if (detectMagic(bytes) !== expectedMime) throw new EventMediaFileError("The file contents do not match the approved image type.", 415, "MAGIC_MISMATCH");
  assertImageContainerComplete(bytes, expectedMime);
  try {
    const metadata = await sharp(bytes, { animated: true, failOn: "error", limitInputPixels: EVENT_MEDIA_MAX_INPUT_PIXELS, sequentialRead: true }).metadata();
    const expectedFormat = expectedMime === "image/jpeg" ? "jpeg" : expectedMime.replace("image/", "");
    if (metadata.format !== expectedFormat) throw new EventMediaFileError("The image structure does not match its file type.", 415, "FORMAT_MISMATCH");
    if ((metadata.pages ?? 1) !== 1 || metadata.pageHeight) throw new EventMediaFileError("Animated or multi-page images are not allowed.", 415, "ANIMATED_IMAGE");
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;
    if (width < 1 || height < 1 || width > EVENT_MEDIA_MAX_DIMENSION || height > EVENT_MEDIA_MAX_DIMENSION || width * height > EVENT_MEDIA_MAX_INPUT_PIXELS) {
      throw new EventMediaFileError("Image dimensions exceed the safe processing limit.", 413, "IMAGE_DIMENSIONS_UNSAFE");
    }
    return {
      bytes,
      extension: rawExtension === ".jpeg" ? ".jpg" : rawExtension as ValidatedEventMediaUpload["extension"],
      mediaType: expectedMime,
      byteSize: bytes.length,
      sha256: digest(bytes),
      width,
      height
    };
  } catch (error) {
    if (error instanceof EventMediaFileError) throw error;
    throw new EventMediaFileError("The image is malformed, unsupported, or unsafe to decode.", 415, "IMAGE_DECODE_FAILED");
  }
}

export async function createEventMediaThumbnail(original: ValidatedEventMediaUpload): Promise<EventMediaThumbnail> {
  try {
    const bytes = await sharp(original.bytes, { animated: false, failOn: "error", limitInputPixels: EVENT_MEDIA_MAX_INPUT_PIXELS, sequentialRead: true })
      .rotate()
      .resize({ width: EVENT_MEDIA_THUMBNAIL_BOUND, height: EVENT_MEDIA_THUMBNAIL_BOUND, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82, chromaSubsampling: "4:2:0", mozjpeg: true })
      .toBuffer();
    const metadata = await sharp(bytes, { failOn: "error", limitInputPixels: EVENT_MEDIA_MAX_INPUT_PIXELS }).metadata();
    if (metadata.format !== "jpeg" || !metadata.width || !metadata.height || metadata.width > EVENT_MEDIA_THUMBNAIL_BOUND || metadata.height > EVENT_MEDIA_THUMBNAIL_BOUND || metadata.exif || metadata.icc || metadata.xmp) {
      throw new EventMediaFileError("The safe derivative failed metadata or dimension verification.", 500, "DERIVATIVE_VERIFICATION_FAILED");
    }
    return { bytes, extension: ".jpg", mediaType: "image/jpeg", byteSize: bytes.length, sha256: digest(bytes), width: metadata.width, height: metadata.height, metadataStripped: true };
  } catch (error) {
    if (error instanceof EventMediaFileError) throw error;
    throw new EventMediaFileError("A safe local thumbnail could not be generated.", 500, "DERIVATIVE_GENERATION_FAILED");
  }
}

export function eventMediaStorageRoot() {
  return validatedPrivateStorageRoot(process.env.EVENT_MEDIA_PRIVATE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "event-media"), "Event Media private storage");
}

export async function storeEventMediaBytes(kind: "original" | "derivative", extension: ".png" | ".jpg" | ".webp", bytes: Buffer) {
  const token = randomUUID().toLowerCase();
  const storageKey = `${kind}/${token.slice(0, 2)}/${token.slice(2, 4)}/${token}${extension}`;
  const target = resolveEventMediaStorageKey(storageKey);
  await assertNoSymlinkPath(eventMediaStorageRoot());
  await mkdir(path.dirname(target), { recursive: true });
  await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.length) throw new EventMediaFileError("Private media storage verification failed.", 500, "STORAGE_VERIFICATION_FAILED");
  return storageKey;
}

export async function readEventMediaBytes(storageKey: string, expectedSha256: string, maximumBytes = EVENT_MEDIA_MAX_FILE_BYTES) {
  const target = resolveEventMediaStorageKey(storageKey);
  await assertNoSymlinkPath(path.dirname(target));
  const stat = await lstat(target).catch(() => null);
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maximumBytes) throw new EventMediaFileError("The private media asset is unavailable.", 404, "ASSET_UNAVAILABLE");
  const bytes = await readFile(target);
  if (digest(bytes) !== expectedSha256.toLowerCase()) throw new EventMediaFileError("The private media asset failed integrity verification.", 409, "ASSET_INTEGRITY_FAILED");
  return bytes;
}

export async function rollbackEventMediaBytes(storageKey: string) {
  const target = resolveEventMediaStorageKey(storageKey);
  const stat = await lstat(target).catch(() => null);
  if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true });
}

export function resolveEventMediaStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new EventMediaFileError("The private media key is invalid.", 404, "INVALID_STORAGE_KEY");
  const root = eventMediaStorageRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new EventMediaFileError("The private media key is invalid.", 404, "INVALID_STORAGE_KEY");
  return target;
}

function detectMagic(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

function assertImageContainerComplete(bytes: Buffer, mime: string) {
  if (mime === "image/png") {
    if (bytes.length < 33 || bytes.subarray(bytes.length - 8, bytes.length - 4).toString("ascii") !== "IEND") throw new EventMediaFileError("The PNG is truncated or malformed.", 415, "PNG_MALFORMED");
  } else if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new EventMediaFileError("The JPEG is truncated or malformed.", 415, "JPEG_MALFORMED");
  } else {
    if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.includes(Buffer.from("ANIM")) || bytes.includes(Buffer.from("ANMF"))) throw new EventMediaFileError("Animated, truncated, or malformed WebP images are not allowed.", 415, "WEBP_MALFORMED");
    if (bytes.subarray(12, 16).toString("ascii") === "VP8X" && (bytes[20] & 0x02) !== 0) throw new EventMediaFileError("Animated WebP images are not allowed.", 415, "ANIMATED_IMAGE");
  }
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  const relative = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of relative) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(() => null);
    if (stat?.isSymbolicLink()) throw new EventMediaFileError("Private media storage symlinks are not allowed.", 500, "STORAGE_SYMLINK_REFUSED");
  }
  const storageStat = await lstat(eventMediaStorageRoot()).catch(() => null);
  if (storageStat?.isSymbolicLink()) throw new EventMediaFileError("Private media storage symlinks are not allowed.", 500, "STORAGE_SYMLINK_REFUSED");
  if (storageStat) await realpath(eventMediaStorageRoot());
}

function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
