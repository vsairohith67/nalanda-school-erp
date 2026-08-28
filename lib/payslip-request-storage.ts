import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { decryptPayslipSecret, encryptPayslipSecret, type AuthenticatedEnvelope } from "@/lib/payslip-request-crypto";
import { PAYSLIP_PDF_MAX_BYTES, PayslipPdfError } from "@/lib/payslip-request-pdf";
import { validatedPrivateStorageRoot } from "@/lib/private-storage-root";
import { configuredPrivateObjectStore, modulePrivateObjectKey } from "@/lib/portable-runtime/private-object-store";

const STORAGE_KEY = /^(?:source\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.enc|delivery\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.pdf)$/;

export function payslipRequestStorageRoot() {
  return validatedPrivateStorageRoot(process.env.PAYSLIP_REQUEST_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "payslip-requests"), "Payslip-request private storage");
}

export async function storeEncryptedPayslipSource(bytes: Buffer, documentBinding: string) {
  const envelope = encryptPayslipSecret(bytes, documentBinding, "SOURCE_PDF");
  const storageKey = newStorageKey("source", ".enc");
  await storeFile(storageKey, Buffer.from(envelope.ciphertext, "base64url"));
  return { storageKey, envelope };
}

export async function storeProtectedPayslipDerivative(bytes: Buffer) {
  const storageKey = newStorageKey("delivery", ".pdf");
  await storeFile(storageKey, bytes);
  return storageKey;
}

export async function readEncryptedPayslipSource(storageKey: string, expectedPlainSha256: string, binding: string, envelope: Omit<AuthenticatedEnvelope, "ciphertext">) {
  const ciphertext = await readStoredFile(storageKey, PAYSLIP_PDF_MAX_BYTES + 1024);
  const plaintext = decryptPayslipSecret({ ...envelope, ciphertext: ciphertext.toString("base64url") }, binding, "SOURCE_PDF");
  if (sha256(plaintext) !== expectedPlainSha256.toLowerCase()) throw new PayslipPdfError("The management source failed SHA-256 verification.", 409);
  return plaintext;
}

export async function readProtectedPayslipDerivative(storageKey: string, expectedSha256: string) {
  const bytes = await readStoredFile(storageKey, PAYSLIP_PDF_MAX_BYTES + 2 * 1024 * 1024);
  if (sha256(bytes) !== expectedSha256.toLowerCase()) throw new PayslipPdfError("The protected payslip failed SHA-256 verification.", 409);
  return bytes;
}

export async function readPayslipStoredBackupBytes(storageKey: string, maximumBytes: number) {
  return readStoredFile(storageKey, maximumBytes);
}

export async function rollbackPayslipStoredFiles(storageKeys: string[]) {
  for (const storageKey of storageKeys) {
    if (portableObjectStorageEnabled()) { await configuredPrivateObjectStore().deleteGovernedObject(modulePrivateObjectKey("payslip", storageKey)); continue; }
    const target = resolvePayslipStorageKey(storageKey);
    const stat = await lstat(target).catch(() => null);
    if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true });
  }
}

export function resolvePayslipStorageKey(storageKey: string, overrideRoot?: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new PayslipPdfError("The private payslip storage key is invalid.", 404);
  const root = path.resolve(overrideRoot || payslipRequestStorageRoot());
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new PayslipPdfError("The private payslip storage key is invalid.", 404);
  return target;
}

async function storeFile(storageKey: string, bytes: Buffer) {
  if (portableObjectStorageEnabled()) {
    await configuredPrivateObjectStore().putPrivateObject({ key: modulePrivateObjectKey("payslip", storageKey), bytes, sha256: sha256(bytes), contentType: storageKey.endsWith(".pdf") ? "application/pdf" : "application/octet-stream" });
    return;
  }
  const root = payslipRequestStorageRoot();
  await mkdir(root, { recursive: true, mode: 0o700 });
  await assertNoSymlinkPath(root);
  const target = resolvePayslipStorageKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.length) throw new PayslipPdfError("Private payslip storage verification failed.", 500);
}

async function readStoredFile(storageKey: string, maximumBytes: number) {
  if (portableObjectStorageEnabled()) return (await configuredPrivateObjectStore().getPrivateObject(modulePrivateObjectKey("payslip", storageKey), maximumBytes)).bytes;
  const target = resolvePayslipStorageKey(storageKey);
  await assertNoSymlinkPath(path.dirname(target));
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > maximumBytes) throw new PayslipPdfError("The private payslip document is unavailable.", 404);
  return readFile(target);
}

function newStorageKey(kind: "source" | "delivery", extension: ".enc" | ".pdf") {
  const token = randomUUID().toLowerCase();
  return `${kind}/${token.slice(0, 2)}/${token.slice(2, 4)}/${token}${extension}`;
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(() => null);
    if (stat?.isSymbolicLink()) throw new PayslipPdfError("Private payslip storage symlinks are not allowed.", 500);
  }
  await realpath(target).catch(() => null);
}

function sha256(value: Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}
function portableObjectStorageEnabled() { return process.env.PRIVATE_OBJECT_STORAGE_PROVIDER?.trim().toUpperCase() === "S3_COMPATIBLE"; }
