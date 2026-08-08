import { createHash, randomBytes, randomUUID } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { hashPassword } from "../lib/password";
import {
  approvePayslipDocument,
  cancelOwnPayslipRequest,
  downloadOwnPayslip,
  issuePayslipDocument,
  loadOwnPayslipRequests,
  previewManagementPayslipSource,
  revealOwnPayslipPassword,
  setPayslipMonthAvailability,
  submitOwnPayslipRequest,
  transitionPayslipRequest,
  uploadPayslipDocument
} from "../lib/payslip-request";
import { restorePayslipRequestBackup } from "../lib/payslip-request-backup";
import { createAndVerifyPayslipRequestAssetBackup } from "../lib/payslip-request-asset-backup";
import { generateFullBackup } from "../lib/backup";
import { parseAndValidateBackup } from "../lib/restore";
import { fileSha256 } from "./migration-check-utils";
import type { AuthUser } from "../lib/auth";

const workspace = path.resolve("."), operational = path.join(workspace, "prisma", "dev.db");
const qaRoot = path.join(workspace, "tmp", "payslipreq1-copied-qa");
const qaDatabase = path.join(qaRoot, "qa.db"), restoreDatabase = path.join(qaRoot, "restore.db"), storageRoot = path.join(qaRoot, "storage");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;

type FixtureUser = { id: string; iamPublicKey: string; roleAssignmentId: string; sessionId: string; password: string; actor: { user: AuthUser; sessionId: string } };
type FixturePlan = { director: FixtureUser; accountant: FixtureUser; teacher: FixtureUser; teacher2: FixtureUser; inactiveTeacher: FixtureUser; staff: { id: string; iamPublicKey: string }; staff2: { id: string; iamPublicKey: string }; inactiveStaff: { id: string; iamPublicKey: string } };

function checkedRoot() {
  const expected = path.join(path.resolve(workspace), "tmp", "payslipreq1-copied-qa"), resolved = path.resolve(qaRoot);
  if (resolved !== expected || !resolved.startsWith(`${path.join(path.resolve(workspace), "tmp")}${path.sep}`)) throw new Error("PAYSLIPREQ1_QA_SCOPE_REFUSED");
  return resolved;
}

function cleanup() { const root = checkedRoot(); if (existsSync(root)) rmSync(root, { recursive: true, force: true }); }

function migrate(file: string) {
  const pnpm = path.join(process.env.APPDATA ?? "", "npm", "node_modules", "pnpm", "bin", "pnpm.mjs");
  const result = spawnSync(process.execPath, [pnpm, "exec", "prisma", "migrate", "deploy", "--schema", "prisma/schema.prisma"], { cwd: workspace, env: { ...process.env, DATABASE_URL: databaseUrl(file) }, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  if (result.error || result.status !== 0) throw new Error(`PAYSLIPREQ1_COPIED_MIGRATION_FAILED:${result.error?.message ?? `${result.stdout}\n${result.stderr}`}`);
}

function actor(user: { id: string; name: string; username: string; designation: string | null; role: any; roleAssignmentId: string; sessionId: string }): { user: AuthUser; sessionId: string } {
  return { sessionId: user.sessionId, user: { id: user.id, name: user.name, username: user.username, email: null, designation: user.designation, role: user.role, roleAssignmentId: user.roleAssignmentId, authorizationVersion: 1, mustChangePassword: false, guardianId: null } };
}

function newFixtureUser(role: "DIRECTOR" | "ACCOUNTANT" | "TEACHER", label: string): FixtureUser {
  const id = randomUUID(), iamPublicKey = randomUUID(), roleAssignmentId = randomUUID(), sessionId = randomUUID(), qaLoginCredential = `${randomBytes(18).toString("base64url")}Aa1!`;
  return { id, iamPublicKey, roleAssignmentId, sessionId, password: qaLoginCredential, actor: actor({ id, name: `PAYSLIPREQ1 ${label}`, username: `payslipreq1-${label.toLowerCase()}`, designation: role === "TEACHER" ? "Teacher" : `${role} synthetic QA`, role, roleAssignmentId, sessionId }) };
}

function fixturePlan(): FixturePlan {
  return {
    director: newFixtureUser("DIRECTOR", "Director"), accountant: newFixtureUser("ACCOUNTANT", "Accountant"), teacher: newFixtureUser("TEACHER", "TeacherOne"), teacher2: newFixtureUser("TEACHER", "TeacherTwo"), inactiveTeacher: newFixtureUser("TEACHER", "InactiveTeacher"),
    staff: { id: randomUUID(), iamPublicKey: randomUUID() }, staff2: { id: randomUUID(), iamPublicKey: randomUUID() }, inactiveStaff: { id: randomUUID(), iamPublicKey: randomUUID() }
  };
}

async function seedIdentity(client: PrismaClient, plan: FixturePlan) {
  for (const fixture of [plan.director, plan.accountant, plan.teacher, plan.teacher2, plan.inactiveTeacher]) {
    const role = fixture.actor.user.role, inactive = fixture === plan.inactiveTeacher;
    await client.user.create({ data: { id: fixture.id, iamPublicKey: fixture.iamPublicKey, name: fixture.actor.user.name, username: fixture.actor.user.username, designation: fixture.actor.user.designation, passwordHash: await hashPassword(fixture.password), role, isActive: !inactive, lifecycleStatus: inactive ? "DISABLED" : "ACTIVE" } });
    await client.userRoleAssignment.create({ data: { id: fixture.roleAssignmentId, publicKey: randomUUID(), userId: fixture.id, role, status: "ACTIVE", reason: "PAYSLIPREQ1 isolated copied-database QA", assignedByUserId: plan.director.id, activeKey: `${fixture.id}:${role}` } });
    await client.authSession.create({ data: { id: fixture.sessionId, userId: fixture.id, tokenHash: sha(Buffer.from(`${fixture.id}:synthetic-session`)), credentialVersion: 1, authorizationVersion: 1, activeRoleAssignmentId: fixture.roleAssignmentId, expiresAt: new Date(Date.now() + 3_600_000), deviceSummary: "PAYSLIPREQ1 copied QA", browserSummary: "Synthetic", networkEvidenceMasked: "local" } });
  }
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: plan.teacher.id, role: "PARENT", status: "ACTIVE", reason: "PAYSLIPREQ1 Teacher and Parent isolation", assignedByUserId: plan.director.id, activeKey: `${plan.teacher.id}:PARENT` } });
  await client.staffMember.createMany({ data: [
    { id: plan.staff.id, iamPublicKey: plan.staff.iamPublicKey, staffCode: "PAYSLIPREQ1-STAFF-001", fullName: "PAYSLIPREQ1 Synthetic Teacher One", displayName: "Synthetic Teacher One", designation: "Teacher", department: "Academics", dateOfJoining: new Date("2025-06-12T00:00:00.000Z"), status: "ACTIVE", userId: plan.teacher.id },
    { id: plan.staff2.id, iamPublicKey: plan.staff2.iamPublicKey, staffCode: "PAYSLIPREQ1-STAFF-002", fullName: "PAYSLIPREQ1 Synthetic Teacher Two", displayName: "Synthetic Teacher Two", designation: "Teacher", department: "Academics", dateOfJoining: new Date("2026-01-10T00:00:00.000Z"), status: "ACTIVE", userId: plan.teacher2.id },
    { id: plan.inactiveStaff.id, iamPublicKey: plan.inactiveStaff.iamPublicKey, staffCode: "PAYSLIPREQ1-STAFF-003", fullName: "PAYSLIPREQ1 Synthetic Inactive Teacher", displayName: "Synthetic Inactive Teacher", designation: "Teacher", dateOfJoining: new Date("2025-01-01T00:00:00.000Z"), status: "INACTIVE", userId: plan.inactiveTeacher.id }
  ] });
}

async function available(client: PrismaClient, plan: FixturePlan, staffKey: string, months: string[]) {
  for (const month of months) await setPayslipMonthAvailability(client, { staffKey, month, status: "AVAILABLE", reason: "Director-authorised synthetic historical record" }, plan.director.actor);
}

async function syntheticPdf() {
  const document = await PDFDocument.create(), page = document.addPage([595.28, 841.89]), font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("PAYSLIPREQ1 synthetic external-preparation QA document", { x: 48, y: 785, size: 12, font });
  page.drawText("No real Staff identity or salary values", { x: 48, y: 760, size: 10, font });
  const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
  return { bytes, file: { name: "PAYSLIPREQ1-synthetic.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as File };
}

async function prepareRequest(client: PrismaClient, plan: FixturePlan, requestKey: string, version: number) {
  const reviewed = await transitionPayslipRequest(client, requestKey, { action: "REVIEW", expectedVersion: version }, plan.director.actor);
  return transitionPayslipRequest(client, requestKey, { action: "ASSIGN", expectedVersion: reviewed.version, preparerKey: plan.accountant.iamPublicKey }, plan.director.actor);
}

async function main() {
  if (!process.env.QPDF_EXECUTABLE_PATH || !path.isAbsolute(process.env.QPDF_EXECUTABLE_PATH)) throw new Error("PAYSLIPREQ1_QA_REQUIRES_FIXED_QPDF_PATH");
  const before = { sha256: fileSha256(operational), size: statSync(operational).size };
  cleanup(); mkdirSync(checkedRoot(), { recursive: true }); copyFileSync(operational, qaDatabase); copyFileSync(operational, restoreDatabase); migrate(qaDatabase); migrate(restoreDatabase);
  process.env.PAYSLIP_REQUEST_STORAGE_ROOT = storageRoot;
  process.env.PAYSLIP_REQUEST_TEMP_ROOT = path.join(qaRoot, "processing");
  process.env.PAYSLIP_REQUEST_KEYRING_JSON = JSON.stringify({ active: "QA_V1", keys: { QA_V1: randomBytes(32).toString("base64") } });
  process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
  const plan = fixturePlan(), client = new PrismaClient({ datasourceUrl: databaseUrl(qaDatabase) }), restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(restoreDatabase) });
  try {
    await seedIdentity(client, plan); await seedIdentity(restoreClient, plan);
    await available(client, plan, plan.staff.iamPublicKey, ["2026-04", "2026-05", "2026-06", "2026-07"]);
    await available(client, plan, plan.staff2.iamPublicKey, ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    await setPayslipMonthAvailability(client, { staffKey: plan.staff.iamPublicKey, month: "2026-03", status: "UNKNOWN", reason: "Synthetic record review is unresolved" }, plan.director.actor);
    await expectReject(setPayslipMonthAvailability(client, { staffKey: plan.staff.iamPublicKey, month: "2026-09", status: "AVAILABLE", reason: "Future month must fail" }, plan.director.actor), /future|incomplete/i);
    const parentActor = { ...plan.teacher.actor, user: { ...plan.teacher.actor.user, role: "PARENT" as const, roleAssignmentId: randomUUID() } };
    await expectReject(loadOwnPayslipRequests(client, parentActor), /Staff\/Teacher context/i);
    await expectReject(loadOwnPayslipRequests(client, plan.inactiveTeacher.actor), /active verified Staff link/i);
    const own = await loadOwnPayslipRequests(client, plan.teacher.actor);
    if (own.availableMonths.some((row) => row.month === "2026-03") || own.availableMonths.some((row) => row.month > "2026-07")) throw new Error("PAYSLIPREQ1_MONTH_FILTER_FAILED");

    const submissionKey = randomUUID();
    const submitted = await submitOwnPayslipRequest(client, { submissionKey, months: ["2026-06", "2026-07"], purpose: "OTHER", explanation: "Synthetic combined-record QA", requiredByDate: "2026-08-20" }, plan.teacher.actor);
    const replay = await submitOwnPayslipRequest(client, { submissionKey, months: ["2026-06", "2026-07"], purpose: "OTHER", explanation: "Synthetic combined-record QA", requiredByDate: "2026-08-20" }, plan.teacher.actor);
    if (!replay.idempotent) throw new Error("PAYSLIPREQ1_SUBMISSION_IDEMPOTENCY_FAILED");
    await expectReject(submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-07"], purpose: "PERSONAL_RECORD" }, plan.teacher.actor), /unique|overlap|constraint/i);
    const prepared = await prepareRequest(client, plan, submitted.request.key, submitted.request.version);
    const pdf = await syntheticPdf();
    const uploaded = await uploadPayslipDocument(client, submitted.request.key, pdf.file, { months: ["2026-06", "2026-07"], expectedVersion: prepared.version }, plan.accountant.actor, false);
    await approvePayslipDocument(client, submitted.request.key, { documentKey: uploaded.key, requestVersion: uploaded.version + 3, reauthPassword: plan.director.password }, plan.director.actor);
    const issueRace = await Promise.allSettled([0, 1].map(() => issuePayslipDocument(client, submitted.request.key, { documentKey: uploaded.key, expectedVersion: 4, reauthPassword: plan.director.password }, plan.director.actor)));
    if (issueRace.filter((row) => row.status === "fulfilled").length !== 1) throw new Error("PAYSLIPREQ1_CONCURRENT_ISSUE_NOT_SERIALIZED");
    await expectReject(revealOwnPayslipPassword(client, uploaded.key, { reauthPassword: "local-only-invalid-credential" }, plan.teacher.actor), /Re-authentication failed/i);
    const firstPassword = await revealOwnPayslipPassword(client, uploaded.key, { reauthPassword: plan.teacher.password }, plan.teacher.actor);
    const firstDownload = await downloadOwnPayslip(client, uploaded.key, plan.teacher.actor);
    const preview = await previewManagementPayslipSource(client, uploaded.key, plan.director.actor);
    if (sha(firstDownload.bytes) !== uploaded.derivativeSha256 || sha(preview.bytes) !== sha(pdf.bytes)) throw new Error("PAYSLIPREQ1_SOURCE_OR_DERIVATIVE_HASH_FAILED");

    const replacement = await uploadPayslipDocument(client, submitted.request.key, pdf.file, { months: ["2026-06", "2026-07"], expectedVersion: 5, supersedesDocumentKey: uploaded.key, replacementReason: "Synthetic correction after governed review" }, plan.accountant.actor, true);
    await approvePayslipDocument(client, submitted.request.key, { documentKey: replacement.key, requestVersion: 6, reauthPassword: plan.director.password }, plan.director.actor);
    const replacementIssued = await issuePayslipDocument(client, submitted.request.key, { documentKey: replacement.key, expectedVersion: 6, reauthPassword: plan.director.password }, plan.director.actor);
    if (replacementIssued.requestStatus !== "ISSUED") throw new Error("PAYSLIPREQ1_REPLACEMENT_ISSUE_FAILED");
    await expectReject(downloadOwnPayslip(client, uploaded.key, plan.teacher.actor), /unavailable/i);
    const replacementPassword = await revealOwnPayslipPassword(client, replacement.key, { reauthPassword: plan.teacher.password }, plan.teacher.actor);
    if (replacementPassword.password === firstPassword.password) throw new Error("PAYSLIPREQ1_REPLACEMENT_PASSWORD_REUSED");

    const cancellation = await submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-02"], purpose: "PERSONAL_RECORD" }, plan.teacher2.actor);
    await cancelOwnPayslipRequest(client, cancellation.request.key, { expectedVersion: cancellation.request.version, reason: "Synthetic cancellation before preparation" }, plan.teacher2.actor);
    const rejection = await submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-03"], purpose: "BANK_OR_LOAN" }, plan.teacher2.actor);
    await transitionPayslipRequest(client, rejection.request.key, { action: "REJECT", expectedVersion: rejection.request.version, reason: "Synthetic historical record mismatch" }, plan.director.actor);

    const partial = await submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-04", "2026-05"], purpose: "EMPLOYMENT_RECORD" }, plan.teacher2.actor);
    const partialPrepared = await prepareRequest(client, plan, partial.request.key, partial.request.version);
    const firstPart = await uploadPayslipDocument(client, partial.request.key, pdf.file, { months: ["2026-04"], expectedVersion: partialPrepared.version }, plan.accountant.actor, false);
    await approvePayslipDocument(client, partial.request.key, { documentKey: firstPart.key, requestVersion: 4, reauthPassword: plan.director.password }, plan.director.actor);
    const partiallyIssued = await issuePayslipDocument(client, partial.request.key, { documentKey: firstPart.key, expectedVersion: 4, reauthPassword: plan.director.password }, plan.director.actor);
    if (partiallyIssued.requestStatus !== "PARTIALLY_ISSUED") throw new Error("PAYSLIPREQ1_PARTIAL_ISSUE_FAILED");
    const secondPart = await uploadPayslipDocument(client, partial.request.key, pdf.file, { months: ["2026-05"], expectedVersion: partiallyIssued.requestVersion }, plan.accountant.actor, false);
    await approvePayslipDocument(client, partial.request.key, { documentKey: secondPart.key, requestVersion: 6, reauthPassword: plan.director.password }, plan.director.actor);
    const fullyIssued = await issuePayslipDocument(client, partial.request.key, { documentKey: secondPart.key, expectedVersion: 6, reauthPassword: plan.director.password }, plan.director.actor);
    if (fullyIssued.requestStatus !== "ISSUED") throw new Error("PAYSLIPREQ1_SEPARATE_DOCUMENT_ISSUE_FAILED");

    const backup = parseAndValidateBackup(await generateFullBackup(client as never, { generatedBy: "PAYSLIPREQ1 copied QA" }));
    if (!backup.staffPayslipDocumentVersions.length || JSON.stringify(backup).includes(firstPassword.password)) throw new Error("PAYSLIPREQ1_METADATA_BACKUP_SECRET_LEAK_OR_MISSING_ROWS");
    const firstRestore = await restorePayslipRequestBackup(restoreClient, backup), secondRestore = await restorePayslipRequestBackup(restoreClient, backup);
    if (firstRestore.staffPayslipDocumentVersions.created !== backup.staffPayslipDocumentVersions.length || secondRestore.staffPayslipDocumentVersions.skipped !== backup.staffPayslipDocumentVersions.length || await restoreClient.staffPayslipDocumentVersion.count() !== backup.staffPayslipDocumentVersions.length) throw new Error("PAYSLIPREQ1_METADATA_RESTORE_IDEMPOTENCY_FAILED");
    const assetKey = randomBytes(32), assetProof = await createAndVerifyPayslipRequestAssetBackup(client, { artifactPath: path.join(qaRoot, "payslip-assets.npsbackup"), key: assetKey, keyVersion: "V91", restoreRoots: [path.join(qaRoot, "asset-restore-a"), path.join(qaRoot, "asset-restore-b")] });
    if (assetProof.documentCount !== backup.staffPayslipDocumentVersions.length || assetProof.firstRestore.assetDigest !== assetProof.secondRestore.assetDigest) throw new Error("PAYSLIPREQ1_ASSET_DOUBLE_RESTORE_FAILED");
    const accessCount = await client.staffPayslipAccessEvent.count(), eventCount = await client.staffPayslipRequestEvent.count(), notificationDuplicates = await client.notificationCampaign.groupBy({ by: ["campaignNumber"], _count: { _all: true }, having: { campaignNumber: { _count: { gt: 1 } } } });
    if (accessCount < 4 || eventCount < 15 || notificationDuplicates.length) throw new Error(`PAYSLIPREQ1_AUDIT_OR_NOTIFICATION_EVIDENCE_FAILED:${accessCount}:${eventCount}:${notificationDuplicates.length}`);
    const after = { sha256: fileSha256(operational), size: statSync(operational).size };
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PAYSLIPREQ1_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "PAYSLIPREQ1_COPIED_DATABASE_VERIFIED", operationalMutation: false, combinedRequest: true, partialIssue: true, replacement: true, concurrentIssueSerialized: true, metadataRestoreTwice: true, assetRestoreTwice: true, documentVersions: backup.staffPayslipDocumentVersions.length, accessEvents: accessCount, requestEvents: eventCount }));
  } finally {
    await client.$disconnect(); await restoreClient.$disconnect(); cleanup(); cleanup();
  }
  if (existsSync(qaRoot)) throw new Error("PAYSLIPREQ1_QA_RESIDUE_REMAINS");
}

async function expectReject(value: Promise<unknown>, pattern: RegExp) { try { await value; } catch (error) { if (pattern.test(error instanceof Error ? error.message : String(error))) return; throw error; } throw new Error("PAYSLIPREQ1_EXPECTED_REFUSAL_DID_NOT_OCCUR"); }
function sha(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
