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
  loadPayslipRequestQueue,
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
import { evaluateEffectivePermission } from "../lib/iam/effective-access";

const workspace = path.resolve("."), operational = path.join(workspace, "prisma", "dev.db");
const qaRoot = path.join(workspace, "tmp", "payslipreq1qa-copied-qa");
const qaDatabase = path.join(qaRoot, "qa.db"), restoreDatabase = path.join(qaRoot, "restore.db"), storageRoot = path.join(qaRoot, "storage");
const databaseUrl = (file: string) => `file:${file.replaceAll("\\", "/")}`;

type FixtureUser = { id: string; iamPublicKey: string; roleAssignmentId: string; sessionId: string; password: string; actor: { user: AuthUser; sessionId: string } };
type FixturePlan = { director: FixtureUser; superAdmin: FixtureUser; accountant: FixtureUser; accountantDenied: FixtureUser; principal: FixtureUser; admin: FixtureUser; viewer: FixtureUser; teacher: FixtureUser; teacher2: FixtureUser; inactiveTeacher: FixtureUser; staff: { id: string; iamPublicKey: string }; staff2: { id: string; iamPublicKey: string }; inactiveStaff: { id: string; iamPublicKey: string } };

function checkedRoot() {
  const expected = path.join(path.resolve(workspace), "tmp", "payslipreq1qa-copied-qa"), resolved = path.resolve(qaRoot);
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

function newFixtureUser(role: "SUPER_ADMIN" | "DIRECTOR" | "ACCOUNTANT" | "PRINCIPAL" | "ADMIN" | "VIEWER" | "TEACHER", label: string): FixtureUser {
  const id = randomUUID(), iamPublicKey = randomUUID(), roleAssignmentId = randomUUID(), sessionId = randomUUID(), qaLoginCredential = `${randomBytes(18).toString("base64url")}Aa1!`;
  return { id, iamPublicKey, roleAssignmentId, sessionId, password: qaLoginCredential, actor: actor({ id, name: `PAYSLIPREQ1QA ${label}`, username: `payslipreq1qa-${label.toLowerCase()}`, designation: role === "TEACHER" ? "Teacher" : `${role} synthetic QA`, role, roleAssignmentId, sessionId }) };
}

function fixturePlan(): FixturePlan {
  return {
    director: newFixtureUser("DIRECTOR", "Director"), superAdmin: newFixtureUser("SUPER_ADMIN", "SuperAdmin"), accountant: newFixtureUser("ACCOUNTANT", "AccountantGranted"), accountantDenied: newFixtureUser("ACCOUNTANT", "AccountantDenied"), principal: newFixtureUser("PRINCIPAL", "Principal"), admin: newFixtureUser("ADMIN", "Admin"), viewer: newFixtureUser("VIEWER", "Viewer"), teacher: newFixtureUser("TEACHER", "TeacherOne"), teacher2: newFixtureUser("TEACHER", "TeacherTwo"), inactiveTeacher: newFixtureUser("TEACHER", "InactiveTeacher"),
    staff: { id: randomUUID(), iamPublicKey: randomUUID() }, staff2: { id: randomUUID(), iamPublicKey: randomUUID() }, inactiveStaff: { id: randomUUID(), iamPublicKey: randomUUID() }
  };
}

async function seedIdentity(client: PrismaClient, plan: FixturePlan) {
  for (const fixture of [plan.director, plan.superAdmin, plan.accountant, plan.accountantDenied, plan.principal, plan.admin, plan.viewer, plan.teacher, plan.teacher2, plan.inactiveTeacher]) {
    const role = fixture.actor.user.role, inactive = fixture === plan.inactiveTeacher;
    await client.user.create({ data: { id: fixture.id, iamPublicKey: fixture.iamPublicKey, name: fixture.actor.user.name, username: fixture.actor.user.username, designation: fixture.actor.user.designation, passwordHash: await hashPassword(fixture.password), role, isActive: !inactive, lifecycleStatus: inactive ? "DISABLED" : "ACTIVE" } });
    await client.userRoleAssignment.create({ data: { id: fixture.roleAssignmentId, publicKey: randomUUID(), userId: fixture.id, role, status: "ACTIVE", reason: "PAYSLIPREQ1QA isolated copied-database QA", assignedByUserId: plan.director.id, activeKey: `${fixture.id}:${role}` } });
    await client.authSession.create({ data: { id: fixture.sessionId, userId: fixture.id, tokenHash: sha(Buffer.from(`${fixture.id}:synthetic-session`)), credentialVersion: 1, authorizationVersion: 1, activeRoleAssignmentId: fixture.roleAssignmentId, expiresAt: new Date(Date.now() + 3_600_000), deviceSummary: "PAYSLIPREQ1QA copied QA", browserSummary: "Synthetic", networkEvidenceMasked: "local" } });
  }
  for (const permission of ["VIEW_PAYSLIP_REQUESTS", "PREPARE_PAYSLIP_REQUEST", "UPLOAD_PAYSLIP_DOCUMENT"]) await client.userPermissionOverride.create({ data: { userId: plan.accountant.id, permission, effect: "ALLOW", status: "ACTIVE", reason: "PAYSLIPREQ1QA explicit preparation grant", createdByUserId: plan.director.id, activeKey: `${plan.accountant.id}:${permission}` } });
  await client.authSession.create({ data: { id: randomUUID(), userId: plan.teacher.id, tokenHash: sha(Buffer.from(`${plan.teacher.id}:second-synthetic-session`)), credentialVersion: 1, authorizationVersion: 1, activeRoleAssignmentId: plan.teacher.roleAssignmentId, expiresAt: new Date(Date.now() + 3_600_000), deviceSummary: "PAYSLIPREQ1QA second copied QA session", browserSummary: "Synthetic", networkEvidenceMasked: "local" } });
  await client.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: plan.teacher.id, role: "PARENT", status: "ACTIVE", reason: "PAYSLIPREQ1 Teacher and Parent isolation", assignedByUserId: plan.director.id, activeKey: `${plan.teacher.id}:PARENT` } });
  await client.staffMember.createMany({ data: [
    { id: plan.staff.id, iamPublicKey: plan.staff.iamPublicKey, staffCode: "PAYSLIPREQ1QA-STAFF-001", fullName: "PAYSLIPREQ1QA Synthetic Teacher One", displayName: "Synthetic Teacher One", designation: "Teacher", department: "Academics", dateOfJoining: new Date("2025-05-31T18:30:00.000Z"), status: "ACTIVE", userId: plan.teacher.id },
    { id: plan.staff2.id, iamPublicKey: plan.staff2.iamPublicKey, staffCode: "PAYSLIPREQ1QA-STAFF-002", fullName: "PAYSLIPREQ1QA Synthetic Teacher Two", displayName: "Synthetic Teacher Two", designation: "Teacher", department: "Academics", dateOfJoining: new Date("2026-01-10T00:00:00.000Z"), status: "ACTIVE", userId: plan.teacher2.id },
    { id: plan.inactiveStaff.id, iamPublicKey: plan.inactiveStaff.iamPublicKey, staffCode: "PAYSLIPREQ1QA-STAFF-003", fullName: "PAYSLIPREQ1QA Synthetic Inactive Teacher", displayName: "Synthetic Inactive Teacher", designation: "Teacher", dateOfJoining: new Date("2025-01-01T00:00:00.000Z"), status: "INACTIVE", userId: plan.inactiveTeacher.id }
  ] });
  const policy = await client.payrollPolicyVersion.create({ data: { policyCode: "PAYSLIPREQ1QA-BOUNDARY", versionNumber: 1, name: "PAYSLIPREQ1QA boundary-only policy", status: "LOCKED", effectiveFrom: new Date("2025-01-01T00:00:00.000Z"), approvedByUserId: plan.director.id, approvedAt: new Date(), lockedAt: new Date() } });
  const structure = await client.salaryStructureVersion.create({ data: { structureCode: "PAYSLIPREQ1QA-BOUNDARY", versionNumber: 1, name: "PAYSLIPREQ1QA boundary-only structure", status: "LOCKED", policyVersionId: policy.id, effectiveFrom: new Date("2025-01-01T00:00:00.000Z"), approvedByUserId: plan.director.id, approvedAt: new Date(), lockedAt: new Date(), estimatedGrossPaise: 0 } });
  const activeAssignment = await client.staffCompensationAssignment.create({ data: { staffMemberId: plan.staff.id, structureVersionId: structure.id, effectiveFrom: new Date("2025-06-01T00:00:00.000Z"), payrollEligibleFrom: new Date("2025-06-01T00:00:00.000Z"), status: "ACTIVE", reason: "PAYSLIPREQ1QA existing-issued-month label only", approvedByUserId: plan.director.id, approvedAt: new Date() } });
  await client.staffCompensationAssignment.create({ data: { staffMemberId: plan.inactiveStaff.id, structureVersionId: structure.id, effectiveFrom: new Date("2025-01-01T00:00:00.000Z"), effectiveTo: new Date("2026-01-31T00:00:00.000Z"), payrollEligibleFrom: new Date("2025-01-01T00:00:00.000Z"), payrollEligibleTo: new Date("2026-01-31T00:00:00.000Z"), status: "ENDED", reason: "PAYSLIPREQ1QA employment-end boundary only", approvedByUserId: plan.director.id, approvedAt: new Date(), endReason: "Synthetic QA boundary" } });
  const period = await client.payrollPeriod.create({ data: { periodCode: "PAYSLIPREQ1QA-2026-05", payrollMonth: "2026-05", startDate: new Date("2026-05-01T00:00:00.000Z"), endDate: new Date("2026-05-31T00:00:00.000Z"), status: "PAYSLIPS_ISSUED" } });
  const run = await client.payrollRun.create({ data: { runNumber: "PAYSLIPREQ1QA-RUN-2026-05", requestKey: randomUUID(), periodId: period.id, policyVersionId: policy.id, status: "PAYSLIPS_ISSUED", preparedByUserId: plan.director.id, approvedByUserId: plan.director.id, payslipsIssuedByUserId: plan.director.id, approvedAt: new Date(), payslipsIssuedAt: new Date(), employeeCount: 1, reason: "PAYSLIPREQ1QA already-issued label only" } });
  const result = await client.employeePayrollResult.create({ data: { payrollRunId: run.id, staffMemberId: plan.staff.id, compensationAssignmentId: activeAssignment.id, status: "ISSUED", eligibleDays: 0, periodDays: 31, attendanceSummaryJson: "{}", sourceVersionsJson: "{}", formulaSnapshotJson: "{}" } });
  await client.payslipVersion.create({ data: { employeePayrollResultId: result.id, staffMemberId: plan.staff.id, versionNumber: 1, reference: "PAYSLIPREQ1QA-ISSUED-2026-05", status: "ISSUED", snapshotJson: "{\"synthetic\":true,\"salaryValues\":false}", snapshotSha256: sha(Buffer.from("PAYSLIPREQ1QA synthetic no-values snapshot")), issueDate: new Date("2026-06-01T00:00:00.000Z"), issuedByUserId: plan.director.id } });
}

async function available(client: PrismaClient, plan: FixturePlan, staffKey: string, months: string[]) {
  for (const month of months) await setPayslipMonthAvailability(client, { staffKey, month, status: "AVAILABLE", reason: "Director-authorised synthetic historical record" }, plan.director.actor);
}

async function syntheticPdf() {
  const document = await PDFDocument.create(), page = document.addPage([595.28, 841.89]), font = await document.embedFont(StandardFonts.Helvetica);
  page.drawText("PAYSLIPREQ1QA synthetic external-preparation QA document", { x: 48, y: 785, size: 12, font });
  page.drawText("No real Staff identity or salary values", { x: 48, y: 760, size: 10, font });
  const bytes = Buffer.from(await document.save({ useObjectStreams: false }));
  return { bytes, file: { name: "PAYSLIPREQ1QA-synthetic.pdf", type: "application/pdf", size: bytes.length, arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) } as File };
}

async function prepareRequest(client: PrismaClient, plan: FixturePlan, requestKey: string, version: number) {
  const reviewed = await transitionPayslipRequest(client, requestKey, { action: "REVIEW", expectedVersion: version }, plan.director.actor);
  return transitionPayslipRequest(client, requestKey, { action: "ASSIGN", expectedVersion: reviewed.version, preparerKey: plan.accountant.iamPublicKey }, plan.director.actor);
}

async function main() {
  if (!process.env.QPDF_EXECUTABLE_PATH || !path.isAbsolute(process.env.QPDF_EXECUTABLE_PATH)) throw new Error("PAYSLIPREQ1QA_REQUIRES_FIXED_QPDF_PATH");
  const before = { sha256: fileSha256(operational), size: statSync(operational).size };
  cleanup(); mkdirSync(checkedRoot(), { recursive: true }); copyFileSync(operational, qaDatabase); copyFileSync(operational, restoreDatabase); migrate(qaDatabase); migrate(qaDatabase); migrate(restoreDatabase); migrate(restoreDatabase);
  process.env.PAYSLIP_REQUEST_STORAGE_ROOT = storageRoot;
  process.env.PAYSLIP_REQUEST_TEMP_ROOT = path.join(qaRoot, "processing");
  process.env.PAYSLIP_REQUEST_KEYRING_JSON = JSON.stringify({ active: "QA_V1", keys: { QA_V1: randomBytes(32).toString("base64") } });
  process.env.SESSION_SECRET = randomBytes(48).toString("base64url");
  const plan = fixturePlan(), client = new PrismaClient({ datasourceUrl: databaseUrl(qaDatabase) }), restoreClient = new PrismaClient({ datasourceUrl: databaseUrl(restoreDatabase) });
  try {
    await seedIdentity(client, plan); await seedIdentity(restoreClient, plan);
    const roleMatrix = await Promise.all([plan.director, plan.superAdmin, plan.accountant, plan.accountantDenied, plan.principal, plan.admin, plan.viewer].map(async (fixture) => ({
      role: fixture.actor.user.role,
      name: fixture.actor.user.name,
      prepare: (await evaluateEffectivePermission(client, { userId: fixture.id, roleAssignmentId: fixture.roleAssignmentId, permission: "PREPARE_PAYSLIP_REQUEST" })).allowed,
      issue: (await evaluateEffectivePermission(client, { userId: fixture.id, roleAssignmentId: fixture.roleAssignmentId, permission: "ISSUE_PAYSLIP_DOCUMENT" })).allowed,
      revealOwn: (await evaluateEffectivePermission(client, { userId: fixture.id, roleAssignmentId: fixture.roleAssignmentId, permission: "VIEW_OWN_PAYSLIP_REQUESTS" })).allowed
    })));
    const byName = new Map(roleMatrix.map((row) => [row.name, row]));
    if (!byName.get(plan.director.actor.user.name)?.issue || !byName.get(plan.superAdmin.actor.user.name)?.issue || !byName.get(plan.accountant.actor.user.name)?.prepare || byName.get(plan.accountant.actor.user.name)?.issue || byName.get(plan.accountantDenied.actor.user.name)?.prepare || [plan.principal, plan.admin, plan.viewer].some((fixture) => byName.get(fixture.actor.user.name)?.prepare || byName.get(fixture.actor.user.name)?.issue || byName.get(fixture.actor.user.name)?.revealOwn)) throw new Error("PAYSLIPREQ1QA_ROLE_PERMISSION_MATRIX_FAILED");
    await available(client, plan, plan.staff.iamPublicKey, ["2025-06", "2026-04", "2026-05", "2026-06", "2026-07"]);
    await available(client, plan, plan.staff2.iamPublicKey, ["2026-02", "2026-03", "2026-04", "2026-05", "2026-06", "2026-07"]);
    await setPayslipMonthAvailability(client, { staffKey: plan.staff.iamPublicKey, month: "2026-03", status: "UNKNOWN", reason: "Synthetic record review is unresolved" }, plan.director.actor);
    await expectReject(setPayslipMonthAvailability(client, { staffKey: plan.staff.iamPublicKey, month: "2025-05", status: "AVAILABLE", reason: "Month before joining must fail" }, plan.director.actor), /joining|employment/i);
    await expectReject(setPayslipMonthAvailability(client, { staffKey: plan.staff.iamPublicKey, month: "2026-09", status: "AVAILABLE", reason: "Future month must fail" }, plan.director.actor), /future|incomplete/i);
    await expectReject(setPayslipMonthAvailability(client, { staffKey: plan.inactiveStaff.iamPublicKey, month: "2026-02", status: "AVAILABLE", reason: "Employment-end boundary must fail" }, plan.director.actor), /eligibility end/i);
    const parentActor = { ...plan.teacher.actor, user: { ...plan.teacher.actor.user, role: "PARENT" as const, roleAssignmentId: randomUUID() } };
    await expectReject(loadOwnPayslipRequests(client, parentActor), /Staff\/Teacher context/i);
    await expectReject(loadOwnPayslipRequests(client, plan.inactiveTeacher.actor), /active verified Staff link/i);
    const own = await loadOwnPayslipRequests(client, plan.teacher.actor);
    if (!own.availableMonths.some((row) => row.month === "2025-06") || own.availableMonths.find((row) => row.month === "2026-05")?.status !== "ALREADY_ISSUED" || own.availableMonths.some((row) => row.month === "2026-03") || own.availableMonths.some((row) => row.month > "2026-07")) throw new Error("PAYSLIPREQ1_MONTH_FILTER_FAILED");
    const queue = await loadPayslipRequestQueue(client, { includeAudit: true });
    if (!queue.preparers.some((row) => row.key === plan.accountant.iamPublicKey) || queue.preparers.some((row) => row.key === plan.accountantDenied.iamPublicKey)) throw new Error("PAYSLIPREQ1QA_PREPARER_LIST_PERMISSION_FAILED");

    const submissionKey = randomUUID();
    const submitted = await submitOwnPayslipRequest(client, { submissionKey, months: ["2026-06", "2026-07"], purpose: "OTHER", explanation: "Synthetic combined-record QA", requiredByDate: "2026-08-20" }, plan.teacher.actor);
    const replay = await submitOwnPayslipRequest(client, { submissionKey, months: ["2026-06", "2026-07"], purpose: "OTHER", explanation: "Synthetic combined-record QA", requiredByDate: "2026-08-20" }, plan.teacher.actor);
    if (!replay.idempotent) throw new Error("PAYSLIPREQ1_SUBMISSION_IDEMPOTENCY_FAILED");
    await expectReject(submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-07"], purpose: "PERSONAL_RECORD" }, plan.teacher.actor), /unique|overlap|constraint/i);
    const reviewed = await transitionPayslipRequest(client, submitted.request.key, { action: "REVIEW", expectedVersion: submitted.request.version }, plan.director.actor);
    await expectReject(transitionPayslipRequest(client, submitted.request.key, { action: "ASSIGN", expectedVersion: reviewed.version, preparerKey: plan.accountantDenied.iamPublicKey }, plan.director.actor), /explicitly authorised/i);
    await expectReject(transitionPayslipRequest(client, submitted.request.key, { action: "ASSIGN", expectedVersion: submitted.request.version, preparerKey: plan.accountant.iamPublicKey }, plan.director.actor), /changed|refresh/i);
    const prepared = await transitionPayslipRequest(client, submitted.request.key, { action: "ASSIGN", expectedVersion: reviewed.version, preparerKey: plan.accountant.iamPublicKey }, plan.director.actor);
    const assignedNoticeCount = await client.notificationRecipient.count({ where: { userId: plan.accountant.id, campaign: { campaignNumber: { startsWith: "PAYSLIPREQ1-REQUEST_SUBMITTED-" } } } });
    if (assignedNoticeCount !== 1) throw new Error(`PAYSLIPREQ1QA_ASSIGNED_PREPARER_NOTIFICATION_FAILED:${assignedNoticeCount}`);
    const pdf = await syntheticPdf();
    const uploaded = await uploadPayslipDocument(client, submitted.request.key, pdf.file, { months: ["2026-06", "2026-07"], expectedVersion: prepared.version }, plan.accountant.actor, false);
    await expectReject(approvePayslipDocument(client, submitted.request.key, { documentKey: uploaded.key, requestVersion: 3, reauthPassword: plan.director.password }, plan.director.actor), /changed|refresh/i);
    await approvePayslipDocument(client, submitted.request.key, { documentKey: uploaded.key, requestVersion: 4, reauthPassword: plan.director.password }, plan.director.actor);
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
    const correction = await submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-03"], purpose: "BANK_OR_LOAN", correctionOfRequestKey: rejection.request.key }, plan.teacher2.actor);
    const correctionPrepared = await prepareRequest(client, plan, correction.request.key, correction.request.version);
    const correctionDocument = await uploadPayslipDocument(client, correction.request.key, pdf.file, { months: ["2026-03"], expectedVersion: correctionPrepared.version }, plan.accountant.actor, false);
    await approvePayslipDocument(client, correction.request.key, { documentKey: correctionDocument.key, requestVersion: 4, reauthPassword: plan.director.password }, plan.director.actor);
    await issuePayslipDocument(client, correction.request.key, { documentKey: correctionDocument.key, expectedVersion: 4, reauthPassword: plan.director.password }, plan.director.actor);
    const supersededRequest = await client.staffPayslipRequest.findUniqueOrThrow({ where: { publicKey: rejection.request.key }, include: { events: true } });
    if (supersededRequest.status !== "SUPERSEDED" || !supersededRequest.supersededAt || !supersededRequest.events.some((event) => event.eventType === "REQUEST_SUPERSEDED")) throw new Error("PAYSLIPREQ1_CORRECTED_REQUEST_NOT_SUPERSEDED");

    const expiring = await submitOwnPayslipRequest(client, { submissionKey: randomUUID(), months: ["2026-06"], purpose: "TAX_OR_FINANCIAL_RECORD" }, plan.teacher2.actor);
    await transitionPayslipRequest(client, expiring.request.key, { action: "EXPIRE", expectedVersion: expiring.request.version, reason: "Synthetic governed expiry" }, plan.director.actor);

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

    await expectReject(client.staffPayslipRequest.delete({ where: { publicKey: submitted.request.key } }), /delete|immutable|append/i);
    const backup = parseAndValidateBackup(await generateFullBackup(client as never, { generatedBy: "PAYSLIPREQ1QA independent copied QA" }));
    if (!backup.staffPayslipDocumentVersions.length || JSON.stringify(backup).includes(firstPassword.password)) throw new Error("PAYSLIPREQ1_METADATA_BACKUP_SECRET_LEAK_OR_MISSING_ROWS");
    const firstRestore = await restorePayslipRequestBackup(restoreClient, backup), secondRestore = await restorePayslipRequestBackup(restoreClient, backup);
    if (firstRestore.staffPayslipDocumentVersions.created !== backup.staffPayslipDocumentVersions.length || secondRestore.staffPayslipDocumentVersions.skipped !== backup.staffPayslipDocumentVersions.length || await restoreClient.staffPayslipDocumentVersion.count() !== backup.staffPayslipDocumentVersions.length) throw new Error("PAYSLIPREQ1_METADATA_RESTORE_IDEMPOTENCY_FAILED");
    const assetKey = randomBytes(32), assetProof = await createAndVerifyPayslipRequestAssetBackup(client, { artifactPath: path.join(qaRoot, "payslip-assets.npsbackup"), key: assetKey, keyVersion: "V91", restoreRoots: [path.join(qaRoot, "asset-restore-a"), path.join(qaRoot, "asset-restore-b")] });
    if (assetProof.documentCount !== backup.staffPayslipDocumentVersions.length || assetProof.firstRestore.assetDigest !== assetProof.secondRestore.assetDigest) throw new Error("PAYSLIPREQ1_ASSET_DOUBLE_RESTORE_FAILED");
    const lifecycleStatuses = new Set((await client.staffPayslipRequestEvent.findMany({ where: { newStatus: { not: null } }, select: { newStatus: true } })).map((event) => event.newStatus));
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "PREPARATION_IN_PROGRESS", "READY_TO_ISSUE", "PARTIALLY_ISSUED", "ISSUED", "REJECTED", "CANCELLED", "SUPERSEDED", "EXPIRED"]) if (!lifecycleStatuses.has(status)) throw new Error(`PAYSLIPREQ1_LIFECYCLE_STATUS_UNPROVEN:${status}`);
    const accessCount = await client.staffPayslipAccessEvent.count(), eventCount = await client.staffPayslipRequestEvent.count(), notificationDuplicates = await client.notificationCampaign.groupBy({ by: ["campaignNumber"], _count: { _all: true }, having: { campaignNumber: { _count: { gt: 1 } } } });
    if (accessCount < 4 || eventCount < 15 || notificationDuplicates.length) throw new Error(`PAYSLIPREQ1_AUDIT_OR_NOTIFICATION_EVIDENCE_FAILED:${accessCount}:${eventCount}:${notificationDuplicates.length}`);
    const after = { sha256: fileSha256(operational), size: statSync(operational).size };
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("PAYSLIPREQ1_OPERATIONAL_DATABASE_CHANGED");
    console.log(JSON.stringify({ result: "PAYSLIPREQ1QA_COPIED_DATABASE_VERIFIED", operationalMutation: false, roleMatrix: true, deniedPreparerExcluded: true, assignedPreparerNotifiedOnce: true, staleApprovalDenied: true, deployTwice: true, joiningMonthIncluded: true, existingIssuedMonthLabelled: true, preJoiningFutureAndEmploymentEndMonthsDenied: true, indiaMonthBoundary: true, noSalaryAmountRequired: true, combinedRequest: true, partialIssue: true, replacement: true, correctedRequestSuperseded: true, lifecycleStatusesProven: true, concurrentIssueSerialized: true, metadataRestoreTwice: true, assetRestoreTwice: true, noHardDeletion: true, documentVersions: backup.staffPayslipDocumentVersions.length, accessEvents: accessCount, requestEvents: eventCount }));
  } finally {
    await client.$disconnect(); await restoreClient.$disconnect(); cleanup(); cleanup();
  }
  if (existsSync(qaRoot)) throw new Error("PAYSLIPREQ1_QA_RESIDUE_REMAINS");
}

async function expectReject(value: Promise<unknown>, pattern: RegExp) { try { await value; } catch (error) { if (pattern.test(error instanceof Error ? error.message : String(error))) return; throw error; } throw new Error("PAYSLIPREQ1_EXPECTED_REFUSAL_DID_NOT_OCCUR"); }
function sha(value: Uint8Array) { return createHash("sha256").update(value).digest("hex"); }

main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
