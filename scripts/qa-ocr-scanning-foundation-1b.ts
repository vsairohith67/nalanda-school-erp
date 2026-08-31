import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

import type { AuthUser } from "@/lib/auth";
import { admitOcrDocument } from "@/lib/ocr-scanning/admission";
import { OCR_ENGINE_LOCK } from "@/lib/ocr-scanning/model-lock";
import { OCR_DOCUMENT_PROFILES } from "@/lib/ocr-scanning/profiles";
import { loadOcrScanningBackup, restoreOcrScanningBackup, type OcrScanningBackupKey, OCR_SCANNING_BACKUP_KEYS } from "@/lib/ocr-scanning/backup";
import { createOcrUpload, purgeOcrDocument, rejectOcrDocument, reviewOcrField, submitOcrReview } from "@/lib/ocr-scanning/workflow";
import { claimOcrJob, completeOcrJob, failOcrJob, uploadWorkerOcrRaster } from "@/lib/ocr-scanning/worker-service";
import { createFileSystemPrivateObjectStore } from "@/lib/portable-runtime/private-object-store";

const databaseUrl = process.env.OCR_1B_QA_DATABASE_URL ?? "";
const restoreDatabaseUrl = process.env.OCR_1B_QA_RESTORE_DATABASE_URL ?? "";
const objectRoot = path.resolve(process.env.OCR_1B_QA_OBJECT_ROOT ?? "");

async function main() {
for (const [label, value] of [["primary", databaseUrl], ["restore", restoreDatabaseUrl]] as const) assertSyntheticDatabaseUrl(label, value);
if (!objectRoot || !inside(path.resolve(process.cwd(), "tmp"), objectRoot) && !inside(path.resolve(process.cwd(), ".qa-artifacts"), objectRoot) && !inside(path.resolve(process.env.TEMP ?? ""), objectRoot)) throw new Error("OCR_QA_OBJECT_ROOT_NOT_SYNTHETIC");
await mkdir(objectRoot, { recursive: true });

const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const restoreClient = new PrismaClient({ datasources: { db: { url: restoreDatabaseUrl } } });
const store = createFileSystemPrivateObjectStore(objectRoot);
const actor: AuthUser = {
  id: "ocr-qa-super-admin", name: "Synthetic OCR Reviewer", username: "ocr.qa", email: "ocr.qa@example.test",
  designation: "Synthetic QA", role: "SUPER_ADMIN", roleAssignmentId: "ocr-qa-role", authorizationVersion: 1,
  mustChangePassword: false, guardianId: null
};
const raster = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "white" } }).png().toBuffer();
const admitted = await admitOcrDocument({ bytes: raster, filename: "synthetic-ocr-form.png", declaredMime: "image/png" });
const modelReceipt = OCR_ENGINE_LOCK.models.map(({ name, revision, weightSha256 }) => ({ name, revision, weightSha256 }));
const evidence: Record<string, unknown> = { databaseUrl: "isolated-file-url", restoreDatabaseUrl: "isolated-file-url", contexts: [] };

try {
  const targets = await seedTargets(client);
  for (const target of targets) {
    const result = await runContext(target);
    (evidence.contexts as unknown[]).push(result);
  }

  const duplicate = await createOcrUpload({
    client, actor, contextType: "STUDENT", contextId: targets[1].contextId, languageProfile: "ENGLISH",
    handwritingDeclared: false, idempotencyKey: "ocr-qa-duplicate-0001", admitted, store
  });
  if (!duplicate.duplicateDetected) throw new Error("OCR_DUPLICATE_NOT_DETECTED");
  await rejectOcrDocument({ client, actor, documentKey: duplicate.publicKey, reason: "Synthetic duplicate lifecycle QA" });
  const purge = await purgeOcrDocument({ client, actor, documentKey: duplicate.publicKey, store });
  if (purge.status !== "PURGED") throw new Error("OCR_PURGE_NOT_CONFIRMED");

  const stale = await prepareContext(targets[2], "ocr-qa-stale-000001");
  await client.guardian.update({ where: { id: targets[2].contextId }, data: { notes: "Synthetic concurrent change" } });
  let staleBlocked = false;
  try {
    await submitOcrReview({ client, actor, documentKey: stale.documentKey, expectedReviewVersion: stale.reviewVersion, idempotencyKey: "ocr-qa-stale-submit-001", confirmation: "CONFIRM_OCR_SUBMISSION" });
  } catch (error) {
    staleBlocked = String((error as { code?: string }).code ?? (error as Error).message).includes("OCR_TARGET_STALE");
  }
  if (!staleBlocked) throw new Error("OCR_STALE_TARGET_WAS_NOT_BLOCKED");

  const failureTransitions = await runFailureTransitions(targets[1]);

  const backup = await loadOcrScanningBackup(client);
  const maps = {
    users: new Map([[actor.id, actor.id]]),
    students: new Map([[targets[1].contextId, targets[1].contextId]]),
    guardians: new Map([[targets[2].contextId, targets[2].contextId]]),
    staffMembers: new Map([[targets[3].contextId, targets[3].contextId]]),
    restoredBy: actor.id
  };
  const first = restoreResult();
  await restoreOcrScanningBackup(restoreClient, backup, maps, first);
  if (OCR_SCANNING_BACKUP_KEYS.some((key) => first[key].errors.length)) throw new Error(`OCR_RESTORE_ERRORS:${JSON.stringify(first)}`);
  const second = restoreResult();
  await restoreOcrScanningBackup(restoreClient, backup, maps, second);
  if (OCR_SCANNING_BACKUP_KEYS.some((key) => second[key].created !== 0 || second[key].errors.length)) throw new Error(`OCR_RESTORE_NOT_IDEMPOTENT:${JSON.stringify(second)}`);

  const immutable = await proveImmutability(client);
  const counts = Object.fromEntries(OCR_SCANNING_BACKUP_KEYS.map((key) => [key, backup[key].length]));
  Object.assign(evidence, { duplicateDetected: true, purgeConfirmed: true, staleTargetBlocked: true, failureTransitions, backupCounts: counts, restoreFirst: summarize(first), restoreSecond: summarize(second), immutable, warnings: first.warnings });
  console.log(JSON.stringify({ result: "OCR_SCANNING_FOUNDATION_1B_SYNTHETIC_QA_PASSED", evidence }, null, 2));
} finally {
  store.close();
  await Promise.allSettled([client.$disconnect(), restoreClient.$disconnect()]);
}

async function runContext(target: Target) {
  const prepared = await prepareContext(target, `ocr-qa-upload-${target.contextType.toLowerCase()}-0001`);
  const submitted = await submitOcrReview({
    client, actor, documentKey: prepared.documentKey, expectedReviewVersion: prepared.reviewVersion,
    idempotencyKey: `ocr-qa-submit-${target.contextType.toLowerCase()}-0001`, confirmation: "CONFIRM_OCR_SUBMISSION"
  });
  const replay = await submitOcrReview({
    client, actor, documentKey: prepared.documentKey, expectedReviewVersion: prepared.reviewVersion,
    idempotencyKey: `ocr-qa-submit-${target.contextType.toLowerCase()}-0001`, confirmation: "CONFIRM_OCR_SUBMISSION"
  });
  if (submitted.status !== "SUBMITTED" || !replay.idempotent) throw new Error(`OCR_${target.contextType}_SUBMIT_FAILED`);
  return { contextType: target.contextType, documentKey: prepared.documentKey, mappedFields: prepared.mappedFields, humanReviewedFields: prepared.mappedFields, authoritativeSubmission: submitted.status, idempotentReplay: replay.idempotent };
}

async function runFailureTransitions(target: Target) {
  const codes = ["OCR_MODEL_HASH_MISMATCH", "OCR_CUDA_UNSUPPORTED", "OCR_GPU_OOM", "OCR_WORKER_CRASH", "OCR_MODEL_CACHE_CORRUPT", "OCR_PROCESS_TIMEOUT"];
  const observed: string[] = [];
  for (const [index, failureCode] of codes.entries()) {
    const upload = await createOcrUpload({ client, actor, contextType: target.contextType, contextId: target.contextId, languageProfile: target.languageProfile, handwritingDeclared: false, idempotencyKey: `ocr-qa-failure-${String(index).padStart(2, "0")}-000001`, admitted, store });
    const claim = await claimOcrJob({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`failure-claim:${failureCode}`) });
    if (!claim || claim.documentKey !== upload.publicKey) throw new Error(`OCR_FAILURE_CLAIM_FAILED:${failureCode}`);
    const failed = await failOcrJob({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`failure-result:${failureCode}`), jobKey: claim.jobKey, leaseToken: claim.leaseToken, failureCode, retryable: false });
    if (failed.status !== "FAILED") throw new Error(`OCR_FAILURE_TRANSITION_FAILED:${failureCode}`);
    observed.push(failureCode);
  }
  return observed;
}

async function prepareContext(target: Target, idempotencyKey: string) {
  const upload = await createOcrUpload({ client, actor, contextType: target.contextType, contextId: target.contextId, languageProfile: target.languageProfile, handwritingDeclared: target.handwritingDeclared, idempotencyKey, admitted, store });
  const replay = await createOcrUpload({ client, actor, contextType: target.contextType, contextId: target.contextId, languageProfile: target.languageProfile, handwritingDeclared: target.handwritingDeclared, idempotencyKey, admitted, store });
  if (!replay.idempotent || replay.publicKey !== upload.publicKey) throw new Error(`OCR_${target.contextType}_UPLOAD_IDEMPOTENCY_FAILED`);
  const claim = await claimOcrJob({ client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`claim:${upload.publicKey}`) });
  if (!claim || claim.documentKey !== upload.publicKey) throw new Error(`OCR_${target.contextType}_CLAIM_FAILED`);
  const rasterSha256 = digest(raster);
  const sourceDigest = digest(`${admitted.sha256}\npage:1`);
  await uploadWorkerOcrRaster({
    client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`raster:${upload.publicKey}`), jobKey: claim.jobKey,
    leaseToken: claim.leaseToken, pageNumber: 1, width: 1200, height: 800, sourceRotation: 0, sourceDigest,
    processingDurationMs: 25, retryPreprocessing: false, rasterSha256, bytes: raster, store
  });
  const blocks = target.lines.map((text, index) => ({
    pageNumber: 1, text, polygon: [[20, 20 + index * 40], [900, 20 + index * 40], [900, 50 + index * 40], [20, 50 + index * 40]] as Array<[number, number]>,
    recognitionScore: 0.98, scriptHint: target.scriptHint, processingDurationMs: 25, retryPreprocessing: false
  }));
  const complete = await completeOcrJob({
    client, workerId: "nalanda-ocr-worker-1b", nonceHash: digest(`result:${upload.publicKey}`), jobKey: claim.jobKey,
    leaseToken: claim.leaseToken, result: {
      contractVersion: "nalanda-ocr-worker-result-1", engineId: "paddleocr", engineRevision: "3.7.0",
      runtimeRevision: "paddlepaddle-gpu-3.3.1", modelReceipt, sourceSha256: admitted.sha256,
      pages: [{ pageNumber: 1, width: 1200, height: 800, sourceRotation: 0, sourceDigest, rasterSha256, processingDurationMs: 25, retryPreprocessing: false, blocks }],
      totalDurationMs: 25
    }
  });
  if (complete.status !== "REVIEW_REQUIRED") throw new Error(`OCR_${target.contextType}_RESULT_FAILED`);
  const document = await client.ocrDocument.findUniqueOrThrow({ where: { publicKey: upload.publicKey }, include: { candidates: { orderBy: { fieldKey: "asc" } } } });
  if (document.candidates.length !== OCR_DOCUMENT_PROFILES[target.contextType].length) throw new Error(`OCR_${target.contextType}_PROFILE_INCOMPLETE`);
  let reviewVersion = document.reviewVersion;
  for (const candidate of document.candidates) {
    const decision = candidate.candidateText ? "ACCEPTED" : "MISSING_VALUE";
    const reviewed = await reviewOcrField({ client, actor, documentKey: upload.publicKey, fieldKey: candidate.fieldKey, decision, expectedFieldVersion: candidate.version, expectedReviewVersion: reviewVersion });
    reviewVersion = reviewed.reviewVersion;
  }
  const ready = await client.ocrDocument.findUniqueOrThrow({ where: { publicKey: upload.publicKey } });
  if (ready.status !== "READY_TO_SUBMIT") throw new Error(`OCR_${target.contextType}_REVIEW_NOT_READY`);
  return { documentKey: upload.publicKey, reviewVersion, mappedFields: document.candidates.length };
}

async function seedTargets(db: PrismaClient): Promise<Target[]> {
  const student = await db.student.create({ data: { id: "ocr-qa-student", admissionNo: "OCRQA001", studentName: "Asha Rao", fatherName: "Vijay Rao", motherName: "Meera Rao", className: "II", phone1: "9000000001", address: "Old synthetic address", dateOfBirth: new Date("2015-01-15") } });
  const guardian = await db.guardian.create({ data: { id: "ocr-qa-guardian", displayName: "Vijay Rao", primaryMobile: "9000000001", alternateMobile: "9000000002", email: "vijay.old@example.test", relationship: "Father" } });
  const staff = await db.staffMember.create({ data: { id: "ocr-qa-staff", staffCode: "OCR-T01", fullName: "Sita Devi", designation: "Teacher", mobile: "9000000003", email: "sita.old@example.test", address: "Old synthetic staff address" } });
  const cycle = await db.admissionCycle.create({ data: { id: "ocr-qa-cycle", cycleCode: "OCR-QA-2026", name: "Synthetic OCR QA", academicYear: "2026-27", enabledClassesJson: '["II"]', admissionNumberPrefix: "OCRQA", createdByUserId: actor.id } });
  const application = await db.admissionApplication.create({ data: {
    id: "ocr-qa-admission", publicKey: "ocr-qa-admission-public", applicationNumber: "OCR-APP-001", cycleId: cycle.id,
    retentionReviewAt: new Date("2027-08-31"), createdByUserId: actor.id,
    child: { create: { id: "ocr-qa-child", fullName: "Asha Rao", dateOfBirth: new Date("2015-01-15"), desiredAcademicYear: "2026-27", desiredClass: "II", previousSchool: "Old Synthetic School" } },
    guardians: { create: { id: "ocr-qa-prospective-guardian", displayName: "Vijay Rao", relationshipToChild: "Father", contactMethod: "PHONE", contactValue: "9000000001", contactHash: digest("PHONE|9000000001"), isPrimary: true } }
  } });
  return [
    { contextType: "ADMISSION", contextId: application.publicKey, languageProfile: "ENGLISH", handwritingDeclared: false, scriptHint: "LATIN", lines: ["Student name: Asha Rao", "Date of birth: 2015-01-15", "Class applied: II", "Application number: OCR-APP-001", "Guardian name: Vijay Rao", "Guardian phone: 9000000011", "Previous school: Synthetic Model School"] },
    { contextType: "STUDENT", contextId: student.id, languageProfile: "ENGLISH_HINDI", handwritingDeclared: false, scriptHint: "MIXED", lines: ["Student name: Asha Rao", "Date of birth: 2015-01-15", "Class: II", "Admission number: OCRQA001", "Father name: Vijay Rao", "Mother name: Meera Rao", "Mobile: 9000000012", "Address: New synthetic student address"] },
    { contextType: "GUARDIAN", contextId: guardian.id, languageProfile: "ENGLISH_TELUGU", handwritingDeclared: false, scriptHint: "MIXED", lines: ["Guardian name: Vijay Rao", "Primary mobile: 9000000013", "Alternate mobile: 9000000014", "Email: vijay.synthetic@example.test", "Relationship: Father"] },
    { contextType: "STAFF", contextId: staff.id, languageProfile: "HINDI", handwritingDeclared: true, scriptHint: "DEVANAGARI", lines: ["Staff name: Sita Devi", "Staff code: OCR-T01", "Mobile: 9000000015", "Email: sita.synthetic@example.test", "Address: New synthetic staff address", "Designation: Senior Teacher"] }
  ];
}

async function proveImmutability(db: PrismaClient) {
  const document = await db.ocrDocument.findFirstOrThrow({ where: { status: "SUBMITTED" } });
  const candidate = await db.ocrFieldCandidate.findFirstOrThrow({ where: { documentId: document.id } });
  const event = await db.ocrWorkflowEvent.findFirstOrThrow({ where: { documentId: document.id } });
  const failures: string[] = [];
  try { await db.ocrDocument.update({ where: { id: document.id }, data: { sourceSha256: "0".repeat(64) } }); } catch { failures.push("OCR_DOCUMENT_SOURCE_IMMUTABLE"); }
  try { await db.ocrFieldCandidate.update({ where: { id: candidate.id }, data: { candidateText: "tampered" } }); } catch { failures.push("OCR_CANDIDATE_SOURCE_EVIDENCE_IMMUTABLE"); }
  try { await db.ocrWorkflowEvent.delete({ where: { id: event.id } }); } catch { failures.push("OCR_WORKFLOW_EVENT_IMMUTABLE"); }
  if (failures.length !== 3) throw new Error("OCR_IMMUTABILITY_TRIGGER_FAILED");
  return failures;
}

function restoreResult() {
  const entity = () => ({ created: 0, updated: 0, skipped: 0, errors: [] as string[] });
  return { ...Object.fromEntries(OCR_SCANNING_BACKUP_KEYS.map((key) => [key, entity()])), warnings: [] as string[] } as Record<OcrScanningBackupKey, ReturnType<typeof entity>> & { warnings: string[] };
}
function summarize(value: ReturnType<typeof restoreResult>) { return Object.fromEntries(OCR_SCANNING_BACKUP_KEYS.map((key) => [key, { created: value[key].created, skipped: value[key].skipped, errors: value[key].errors.length }])); }
function digest(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function inside(root: string, candidate: string) { const relative = path.relative(root, candidate); return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative); }
function assertSyntheticDatabaseUrl(label: string, value: string) {
  const parsed = new URL(value);
  if (parsed.protocol !== "file:") throw new Error(`OCR_QA_${label.toUpperCase()}_DATABASE_NOT_FILE`);
  const databasePath = path.resolve(fileURLToPath(parsed));
  if (/[/\\]prisma[/\\]dev\.db$/i.test(databasePath)) throw new Error("OCR_QA_OPERATIONAL_DATABASE_REJECTED");
  const allowed = [path.resolve(process.cwd(), "tmp"), path.resolve(process.cwd(), ".qa-artifacts"), path.resolve(process.env.TEMP ?? "")];
  if (!allowed.some((root) => inside(root, databasePath))) throw new Error(`OCR_QA_${label.toUpperCase()}_DATABASE_NOT_SYNTHETIC`);
}

type Target = {
  contextType: "ADMISSION" | "STUDENT" | "GUARDIAN" | "STAFF";
  contextId: string;
  languageProfile: "ENGLISH" | "HINDI" | "ENGLISH_HINDI" | "ENGLISH_TELUGU";
  handwritingDeclared: boolean;
  scriptHint: "LATIN" | "DEVANAGARI" | "MIXED";
  lines: string[];
};
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "OCR_SCANNING_FOUNDATION_1B_SYNTHETIC_QA_FAILED");
  process.exitCode = 1;
});
