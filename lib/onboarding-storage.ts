import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { validatedPrivateStorageRoot } from "@/lib/private-storage-root";
import { configuredPrivateObjectStore, modulePrivateObjectKey } from "@/lib/portable-runtime/private-object-store";

const STORAGE_KEY = /^(?:source|error)\/[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.xlsx$/;
export const MAX_ONBOARDING_WORKBOOK_BYTES = 10 * 1024 * 1024;

export function onboardingStorageRoot() {
  return validatedPrivateStorageRoot(process.env.ONBOARDING_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "onboarding"), "Onboarding private storage");
}

export async function storeOnboardingWorkbook(bytes: Buffer, kind: "source" | "error" = "source") {
  if (bytes.length < 1 || bytes.length > MAX_ONBOARDING_WORKBOOK_BYTES) throw new Error("WORKBOOK_SIZE_REFUSED");
  const token = randomUUID().toLowerCase();
  const storageKey = `${kind}/${token.slice(0, 2)}/${token.slice(2, 4)}/${token}.xlsx`;
  if (portableObjectStorageEnabled()) {
    const checksum = sha256(bytes);
    await configuredPrivateObjectStore().putPrivateObject({ key: modulePrivateObjectKey("onboarding", storageKey), bytes, sha256: checksum, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    return { storageKey, sha256: checksum, byteSize: bytes.length };
  }
  const target = resolveOnboardingStorageKey(storageKey);
  await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== bytes.length) throw new Error("PRIVATE_STORAGE_VERIFICATION_FAILED");
  return { storageKey, sha256: sha256(bytes), byteSize: bytes.length };
}

export async function readOnboardingWorkbook(storageKey: string, expectedSha256: string) {
  if (portableObjectStorageEnabled()) {
    const object = await configuredPrivateObjectStore().getPrivateObject(modulePrivateObjectKey("onboarding", storageKey), MAX_ONBOARDING_WORKBOOK_BYTES);
    if (object.metadata.sha256 !== expectedSha256.toLowerCase()) throw new Error("WORKBOOK_HASH_CHANGED");
    return object.bytes;
  }
  const target = resolveOnboardingStorageKey(storageKey);
  await assertNoSymlinkPath(path.dirname(target));
  const stat = await lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 1 || stat.size > MAX_ONBOARDING_WORKBOOK_BYTES) throw new Error("PRIVATE_WORKBOOK_UNAVAILABLE");
  const bytes = await readFile(target);
  if (sha256(bytes) !== expectedSha256.toLowerCase()) throw new Error("WORKBOOK_HASH_CHANGED");
  return bytes;
}

export async function removeOnboardingWorkbook(storageKey: string) {
  if (portableObjectStorageEnabled()) { await configuredPrivateObjectStore().deleteGovernedObject(modulePrivateObjectKey("onboarding", storageKey)); return; }
  const target = resolveOnboardingStorageKey(storageKey);
  const stat = await lstat(target).catch(() => null);
  if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true });
}

export function resolveOnboardingStorageKey(storageKey: string) {
  if (!STORAGE_KEY.test(storageKey)) throw new Error("PRIVATE_STORAGE_KEY_INVALID");
  const root = onboardingStorageRoot();
  const target = path.resolve(root, ...storageKey.split("/"));
  if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new Error("PRIVATE_STORAGE_KEY_INVALID");
  return target;
}

async function assertNoSymlinkPath(target: string) {
  const root = path.parse(target).root;
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const stat = await lstat(current).catch(() => null);
    if (stat?.isSymbolicLink()) throw new Error("PRIVATE_STORAGE_SYMLINK_REFUSED");
  }
}

export function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex").toLowerCase(); }
function portableObjectStorageEnabled() { return process.env.PRIVATE_OBJECT_STORAGE_PROVIDER?.trim().toUpperCase() === "S3_COMPATIBLE"; }
