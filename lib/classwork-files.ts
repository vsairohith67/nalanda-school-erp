import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRef, PDFStream, type PDFObject } from "pdf-lib";
import sharp from "sharp";
import { validatedPrivateStorageRoot } from "@/lib/private-storage-root";

export const CLASSWORK_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const CLASSWORK_MAX_IMAGE_DIMENSION = 8_000;
export const CLASSWORK_MAX_PDF_PAGES = 100;
export const CLASSWORK_ITEM_ATTACHMENT_LIMIT = 10;
export const CLASSWORK_ITEM_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const CLASSWORK_SUBMISSION_ATTACHMENT_LIMIT = 5;
export const CLASSWORK_SUBMISSION_ATTACHMENT_BYTES = 15 * 1024 * 1024;

const TYPES = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
} as const;
const STORAGE_KEY = /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:pdf|png|jpg|webp)$/;

export type ValidatedClassworkFile = {
  bytes: Buffer;
  extension: ".pdf" | ".png" | ".jpg" | ".jpeg" | ".webp";
  mediaType: (typeof TYPES)[keyof typeof TYPES];
  safeDisplayName: string;
  byteSize: number;
  sha256: string;
  width: number | null;
  height: number | null;
};

export class ClassworkFileError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function validateClassworkUpload(file: Pick<File, "name" | "type" | "size" | "arrayBuffer">): Promise<ValidatedClassworkFile> {
  if (!file || typeof file.name !== "string" || !file.name.trim()) throw new ClassworkFileError("Choose a file to upload.");
  if (/[/\\\u0000]/.test(file.name) || file.name === "." || file.name === "..") throw new ClassworkFileError("The file name is unsafe.");
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > CLASSWORK_MAX_FILE_BYTES) throw new ClassworkFileError("Files must be between 1 byte and 5 MB.", 413);
  const rawExtension = path.extname(file.name).toLowerCase();
  if (!(rawExtension in TYPES)) throw new ClassworkFileError("Only PDF, PNG, JPEG, and still WebP files are allowed.");
  const extension = rawExtension as ValidatedClassworkFile["extension"];
  const expectedMime = TYPES[extension];
  if (file.type.toLowerCase() !== expectedMime) throw new ClassworkFileError("The file extension and browser MIME type do not match.");
  let bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length !== file.size || bytes.length > CLASSWORK_MAX_FILE_BYTES) throw new ClassworkFileError("The uploaded file is truncated or exceeds the size limit.");
  const magicMime = detectMagic(bytes);
  if (magicMime !== expectedMime) throw new ClassworkFileError("The file contents do not match the allowed file type.");

  let width: number | null = null;
  let height: number | null = null;
  if (expectedMime === "application/pdf") {
    rejectActivePdfContent(bytes);
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
      const pages = pdf.getPageCount();
      if (pages < 1 || pages > CLASSWORK_MAX_PDF_PAGES) throw new ClassworkFileError("PDF files must contain 1 to 100 pages.");
      assertPassivePdfGraph(pdf);
      // Persist a fresh, non-object-stream serialization instead of the
      // attacker-supplied container. This normalizes escaped names and removes
      // unparsed trailing/container bytes from the accepted artifact.
      bytes = Buffer.from(await pdf.save({ useObjectStreams: false, addDefaultPage: false, updateFieldAppearances: false }));
      const verification = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
      assertPassivePdfGraph(verification);
      rejectActivePdfContent(bytes);
    } catch (error) {
      if (error instanceof ClassworkFileError) throw error;
      throw new ClassworkFileError("The PDF is encrypted, malformed, or unsupported.");
    }
  } else {
    assertImageContainerComplete(bytes, expectedMime);
    try {
      const metadata = await sharp(bytes, { animated: true, limitInputPixels: CLASSWORK_MAX_IMAGE_DIMENSION ** 2 }).metadata();
      if (metadata.format !== expectedMime.replace("image/", "").replace("jpeg", "jpeg")) throw new ClassworkFileError("The image structure does not match its file type.");
      if ((metadata.pages ?? 1) !== 1 || metadata.pageHeight) throw new ClassworkFileError("Animated or multi-page images are not allowed.");
      width = metadata.width ?? null;
      height = metadata.height ?? null;
      if (!width || !height || width > CLASSWORK_MAX_IMAGE_DIMENSION || height > CLASSWORK_MAX_IMAGE_DIMENSION) {
        throw new ClassworkFileError("Image dimensions must be between 1 and 8000 pixels.");
      }
    } catch (error) {
      if (error instanceof ClassworkFileError) throw error;
      throw new ClassworkFileError("The image is malformed or unsupported.");
    }
  }

  const normalizedExtension = extension === ".jpeg" ? ".jpg" : extension;
  return {
    bytes,
    extension,
    mediaType: expectedMime,
    safeDisplayName: `Private attachment${normalizedExtension}`,
    byteSize: bytes.length,
    sha256: sha256(bytes),
    width,
    height
  };
}

export function classworkStorageRoot() {
  return validatedPrivateStorageRoot(process.env.CLASSWORK_PRIVATE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "classwork"), "Classwork private storage");
}

export async function storeClassworkFile(file: ValidatedClassworkFile) {
  const normalizedExtension = file.extension === ".jpeg" ? ".jpg" : file.extension;
  const token = randomUUID().toLowerCase();
  const storageKey = `${token.slice(0, 2)}/${token.slice(2, 4)}/${token}${normalizedExtension}`;
  const target = resolveStorageKey(storageKey);
  await assertNoSymlinkPath(classworkStorageRoot());
  await mkdir(path.dirname(target), { recursive: true });
  await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600);
  try {
    await handle.writeFile(file.bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.byteSize) throw new ClassworkFileError("Private attachment storage verification failed.", 500);
  return storageKey;
}

export async function readClassworkFile(storageKey: string, expectedSha256: string) {
  const target = resolveStorageKey(storageKey);
  await assertNoSymlinkPath(path.dirname(target));
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > CLASSWORK_MAX_FILE_BYTES) throw new ClassworkFileError("The private attachment is unavailable.", 404);
  const bytes = await readFile(target);
  if (sha256(bytes) !== expectedSha256.toLowerCase()) throw new ClassworkFileError("The private attachment failed integrity verification.", 409);
  return bytes;
}

export async function rollbackStoredClassworkFile(storageKey: string) {
  const target = resolveStorageKey(storageKey);
  const stat = await lstat(target).catch(() => null);
  if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true });
}

export function resolveStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new ClassworkFileError("The private attachment key is invalid.", 404);
  const root = classworkStorageRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new ClassworkFileError("The private attachment key is invalid.", 404);
  return target;
}

export async function assertAttachmentQuota(existing: Array<{ byteSize: number }>, nextBytes: number, kind: "ITEM" | "SUBMISSION") {
  const countLimit = kind === "ITEM" ? CLASSWORK_ITEM_ATTACHMENT_LIMIT : CLASSWORK_SUBMISSION_ATTACHMENT_LIMIT;
  const byteLimit = kind === "ITEM" ? CLASSWORK_ITEM_ATTACHMENT_BYTES : CLASSWORK_SUBMISSION_ATTACHMENT_BYTES;
  const currentBytes = existing.reduce((sum, row) => sum + row.byteSize, 0);
  if (existing.length >= countLimit || currentBytes + nextBytes > byteLimit) throw new ClassworkFileError("The private attachment quota has been reached.", 413);
}

function detectMagic(bytes: Buffer) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]))) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (bytes.length >= 8 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  return null;
}

function rejectActivePdfContent(bytes: Buffer) {
  const text = bytes.toString("latin1");
  if (!/%%EOF[\s\u0000]*$/.test(text)) throw new ClassworkFileError("The PDF is truncated or malformed.");
  if (/\/(?:JavaScript|JS|OpenAction|AA|Launch|EmbeddedFile|EmbeddedFiles|Filespec|RichMedia|XFA|AcroForm|SubmitForm|ImportData|GoToR|URI|Annots|Names)\b/i.test(text)) throw new ClassworkFileError("PDF files with active or embedded content are not allowed.");
}

const UNSAFE_PDF_NAMES = new Set(["JavaScript","JS","OpenAction","AA","Launch","EmbeddedFile","EmbeddedFiles","Filespec","RichMedia","XFA","AcroForm","SubmitForm","ImportData","GoToR","URI","Annots","Names"]);

function assertPassivePdfGraph(pdf: PDFDocument) {
  const seen = new Set<PDFObject>();
  const inspect = (object: PDFObject | undefined) => {
    if (!object || seen.has(object)) return;
    seen.add(object);
    if (object instanceof PDFRef) { inspect(pdf.context.lookup(object)); return; }
    if (object instanceof PDFName) {
      if (UNSAFE_PDF_NAMES.has(object.decodeText())) throw new ClassworkFileError("PDF files with active or embedded content are not allowed.");
      return;
    }
    if (object instanceof PDFStream) { inspect(object.dict); return; }
    if (object instanceof PDFDict) {
      for (const [key, value] of object.entries()) {
        if (UNSAFE_PDF_NAMES.has(key.decodeText())) throw new ClassworkFileError("PDF files with active or embedded content are not allowed.");
        inspect(value);
      }
      return;
    }
    if (object instanceof PDFArray) for (const value of object.asArray()) inspect(value);
  };
  for (const [, object] of pdf.context.enumerateIndirectObjects()) inspect(object);
}

function assertImageContainerComplete(bytes: Buffer, mime: string) {
  if (mime === "image/png") {
    if (bytes.length < 33 || bytes.subarray(bytes.length - 8, bytes.length - 4).toString("ascii") !== "IEND") throw new ClassworkFileError("The PNG is truncated or malformed.");
  } else if (mime === "image/jpeg") {
    if (bytes.length < 4 || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) throw new ClassworkFileError("The JPEG is truncated or malformed.");
  } else {
    if (bytes.length < 20 || bytes.readUInt32LE(4) + 8 !== bytes.length || bytes.includes(Buffer.from("ANIM")) || bytes.includes(Buffer.from("ANMF"))) throw new ClassworkFileError("Animated, truncated, or malformed WebP files are not allowed.");
    if (bytes.subarray(12, 16).toString("ascii") === "VP8X" && (bytes[20] & 0x02) !== 0) throw new ClassworkFileError("Animated WebP files are not allowed.");
  }
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  const relative = path.relative(root, target).split(path.sep).filter(Boolean);
  let current = root;
  for (const part of relative) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(() => null);
    if (stat?.isSymbolicLink()) throw new ClassworkFileError("Private storage symlinks are not allowed.", 500);
  }
  const rootStat = await lstat(classworkStorageRoot()).catch(() => null);
  if (rootStat && rootStat.isSymbolicLink()) throw new ClassworkFileError("Private storage symlinks are not allowed.", 500);
  if (rootStat) await realpath(classworkStorageRoot());
}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
