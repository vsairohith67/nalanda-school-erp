import { createHash, randomUUID } from "node:crypto";
import { lstat, mkdir, open, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { validateClassworkUpload, type ValidatedClassworkFile } from "@/lib/classwork-files";
import { ADMISSION_DOCUMENT_TYPES, AdmissionError, safeKey } from "@/lib/admissions";

const STORAGE_KEY = /^[a-f0-9]{2}\/[a-f0-9]{2}\/[a-f0-9-]{36}\.(?:pdf|png|jpg|webp)$/;
const MAX_DOCUMENTS = 12;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024;

export function admissionsStorageRoot() {
  return path.resolve(process.env.ADMISSIONS_PRIVATE_STORAGE_ROOT?.trim() || path.join(process.cwd(), "storage", "admissions"));
}

export async function uploadApplicationDocument(client: PrismaClient, input: { applicationKey?: string; invitationToken?: string; documentType: string; file: File; actor?: AuthUser }) {
  const application = input.actor
    ? await client.admissionApplication.findUnique({ where: { publicKey: safeKey(input.applicationKey) }, include: { cycle: true, documents: { select: { byteSize: true, documentType: true, version: true } } } })
    : await invitedApplication(client, input.invitationToken);
  if (!application) throw new AdmissionError("Application not found.", 404);
  if (input.actor && !["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(input.actor.role)) throw new AdmissionError("This role cannot manage admission documents.", 403);
  if (!input.actor && !["APPLICATION_INVITED", "APPLICATION_IN_PROGRESS"].includes(application.status)) throw new AdmissionError("This application no longer accepts documents.", 409);
  const documentType = String(input.documentType ?? "").trim().toUpperCase();
  if (!(ADMISSION_DOCUMENT_TYPES as readonly string[]).includes(documentType) || !jsonArray(application.cycle.documentTypesJson).includes(documentType)) throw new AdmissionError("This document type is not enabled for the admission cycle.");
  const validated = await validateClassworkUpload(input.file);
  const currentBytes = application.documents.reduce((sum, row) => sum + row.byteSize, 0);
  if (application.documents.length >= MAX_DOCUMENTS || currentBytes + validated.byteSize > MAX_TOTAL_BYTES) throw new AdmissionError("The admission-document quota has been reached.", 413);
  const storageKey = await storeAdmissionFile(validated);
  try {
    const latest = application.documents.filter((row) => row.documentType === documentType).sort((a, b) => b.version - a.version)[0];
    return await client.applicationDocument.create({ data: {
      applicationId: application.id, documentType, version: (latest?.version ?? 0) + 1, storageKey,
      safeDisplayName: `Private ${documentType.toLowerCase().replaceAll("_", " ")} document${validated.extension === ".jpeg" ? ".jpg" : validated.extension}`,
      mediaType: validated.mediaType, extension: validated.extension === ".jpeg" ? ".jpg" : validated.extension,
      byteSize: validated.byteSize, sha256: validated.sha256, width: validated.width, height: validated.height,
      retentionReviewAt: application.retentionReviewAt
    }, select: { publicKey: true, documentType: true, version: true, safeDisplayName: true, mediaType: true, byteSize: true, sha256: true, recoveryStatus: true } });
  } catch (error) { await rollbackAdmissionFile(storageKey); throw error; }
}

export async function retrieveApplicationDocument(client: PrismaClient, documentKey: string, input: { actor?: AuthUser; invitationToken?: string }) {
  const document = await client.applicationDocument.findUnique({ where: { publicKey: safeKey(documentKey) }, include: { application: { include: { reviews: { where: input.actor ? { reviewerUserId: input.actor.id, status: { in: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"] } } : undefined } } } } });
  if (!document) throw new AdmissionError("Document not found.", 404);
  if (input.actor) {
    const broad = ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(input.actor.role);
    const assignedTeacher = input.actor.role === "TEACHER" && document.application.reviews.some((row) => row.reviewerUserId === input.actor!.id);
    if (!broad && !assignedTeacher) throw new AdmissionError("Document not found.", 404);
  } else {
    const application = await invitedApplication(client, input.invitationToken);
    if (!application || application.id !== document.applicationId) throw new AdmissionError("Document not found.", 404);
  }
  if (input.actor && document.recoveryStatus !== "VERIFIED") throw new AdmissionError("Document recovery proof is incomplete.", 409, "DOCUMENT_RECOVERY_REQUIRED");
  const bytes = await readAdmissionFile(document.storageKey, document.sha256);
  return { bytes, document: { safeDisplayName: document.safeDisplayName, mediaType: document.mediaType, byteSize: document.byteSize, sha256: document.sha256 } };
}

export async function storeAdmissionFile(file: ValidatedClassworkFile) {
  const extension = file.extension === ".jpeg" ? ".jpg" : file.extension; const token = randomUUID().toLowerCase(); const storageKey = `${token.slice(0, 2)}/${token.slice(2, 4)}/${token}${extension}`; const target = resolveAdmissionStorageKey(storageKey);
  await assertNoSymlinkPath(admissionsStorageRoot()); await mkdir(path.dirname(target), { recursive: true }); await assertNoSymlinkPath(path.dirname(target));
  const handle = await open(target, "wx", 0o600); try { await handle.writeFile(file.bytes); await handle.sync(); } finally { await handle.close(); }
  const stat = await lstat(target); if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.byteSize) throw new AdmissionError("Private admission-document storage verification failed.", 500);
  return storageKey;
}

export async function readAdmissionFile(storageKey: string, expectedSha256: string) { const target = resolveAdmissionStorageKey(storageKey); await assertNoSymlinkPath(path.dirname(target)); const stat = await lstat(target); if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 5 * 1024 * 1024) throw new AdmissionError("The private document is unavailable.", 404); const bytes = await readFile(target); if (sha256(bytes) !== expectedSha256.toLowerCase()) throw new AdmissionError("The private document failed integrity verification.", 409); return bytes; }
export async function rollbackAdmissionFile(storageKey: string) { const target = resolveAdmissionStorageKey(storageKey); const stat = await lstat(target).catch(() => null); if (stat?.isFile() && !stat.isSymbolicLink()) await rm(target, { force: true }); }
export function resolveAdmissionStorageKey(storageKey: string) { if (!STORAGE_KEY.test(storageKey)) throw new AdmissionError("The private document key is invalid.", 404); const root = admissionsStorageRoot(); const target = path.resolve(root, ...storageKey.split("/")); if (target === root || !target.startsWith(`${root}${path.sep}`)) throw new AdmissionError("The private document key is invalid.", 404); return target; }

async function invitedApplication(client: PrismaClient, token: unknown) { const value = String(token ?? "").trim(); if (!/^[A-Za-z0-9_-]{40,100}$/.test(value)) throw new AdmissionError("This invitation is unavailable or expired.", 404); const row = await client.admissionApplication.findUnique({ where: { invitationTokenHash: sha256(value) }, include: { cycle: true, documents: { select: { byteSize: true, documentType: true, version: true } } } }); if (!row || row.invitationUsedAt || !row.invitationExpiresAt || row.invitationExpiresAt <= new Date() || row.invitationAttemptCount >= row.invitationAttemptLimit) throw new AdmissionError("This invitation is unavailable or expired.", 404); return row; }
async function assertNoSymlinkPath(target: string) { const root = path.parse(target).root; let current = root; for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) { current = path.join(current, part); const stat = await lstat(current).catch(() => null); if (stat?.isSymbolicLink()) throw new AdmissionError("Private storage symlinks are not allowed.", 500); } const rootStat = await lstat(admissionsStorageRoot()).catch(() => null); if (rootStat?.isSymbolicLink()) throw new AdmissionError("Private storage symlinks are not allowed.", 500); if (rootStat) await realpath(admissionsStorageRoot()); }
function jsonArray(value: string) { try { const row = JSON.parse(value); return Array.isArray(row) ? row.map(String) : []; } catch { return []; } }
function sha256(value: Uint8Array | string) { return createHash("sha256").update(value).digest("hex"); }
