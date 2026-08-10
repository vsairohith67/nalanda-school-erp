import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { requireCriticalReauthentication, type IamActor } from "@/lib/iam/security";
import { parseOnboardingWorkbook } from "@/lib/onboarding-workbooks";
import { readOnboardingWorkbook, sha256 } from "@/lib/onboarding-storage";
import type { OnboardingBundle, OnboardingIssue, OnboardingWorkbookRows } from "@/lib/onboarding-types";

type Client = PrismaClient | Prisma.TransactionClient;
type Resolution = "CREATE_NEW" | "LINK_EXISTING" | "UPDATE_EXISTING" | "SKIP" | "REJECT_ROW";
type Resolutions = Record<string, { decision: Resolution; reason: string }>;
type NormalizedPlan = ReturnType<typeof normalizeWorkbook>;
export const ONBOARDING_PLAN_TTL_MS = 30 * 60 * 1000;
export const PRIVILEGED_ROLE_PROPOSALS = new Set(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"]);

export class OnboardingError extends Error { constructor(message: string, public status = 400, public code = "ONBOARDING_REFUSED") { super(message); } }

export async function createDryRunPlan(client: Client, batch: any, rows: OnboardingWorkbookRows, resolutions: Resolutions = {}) {
  const normalized = normalizeWorkbook(rows);
  const issues: OnboardingIssue[] = [...normalized.issues];
  const [classSections, students, guardians, staff, profiles] = await Promise.all([
    client.timetableClassSection.findMany({ select: { academicYear: true, className: true, section: true, isActive: true, updatedAt: true } }),
    client.student.findMany({ select: { id: true, admissionNo: true, studentName: true, dateOfBirth: true, phone1: true, updatedAt: true } }),
    client.guardian.findMany({ select: { id: true, displayName: true, primaryMobile: true, email: true, updatedAt: true } }),
    client.staffMember.findMany({ select: { id: true, staffCode: true, fullName: true, mobile: true, email: true, department: true, designation: true, updatedAt: true } }),
    client.permissionProfile.findMany({ where: { status: "ACTIVE" }, select: { name: true, updatedAt: true } })
  ]);
  const referenceHash = stableHash({ classSections, profiles: profiles.map((r) => r.name), departments: unique(staff.map((r) => r.department).filter((value): value is string => Boolean(value))), designations: unique(staff.map((r) => r.designation)) });
  const targetHash = stableHash({ students: students.map(targetVersion), guardians: guardians.map(targetVersion), staff: staff.map(targetVersion) });
  const references = new Map(classSections.map((r) => [`${key(r.academicYear)}|${key(r.className)}|${key(r.section)}`, r]));
  const studentByAdmission = new Map(students.map((r) => [key(r.admissionNo), r]));
  const guardianByMobile = new Map(guardians.map((r) => [digits(r.primaryMobile), r]));
  const staffByCode = new Map(staff.filter((r) => r.staffCode).map((r) => [key(r.staffCode), r]));
  const profileNames = new Set(profiles.map((r) => key(r.name)));
  const departmentNames = new Set(staff.map((r) => key(r.department)).filter(Boolean));
  const designationNames = new Set(staff.map((r) => key(r.designation)).filter(Boolean));
  const studentKeys = new Map(normalized.students.map((r) => [r.rowKey, r]));
  const guardianKeys = new Map(normalized.guardians.map((r) => [r.rowKey, r]));

  for (const row of normalized.students) {
    const existing = studentByAdmission.get(key(row.admissionNo));
    if (existing) duplicateIssue(issues, "STUDENT_ADMISSION_EXISTS", "Students", row.rowNumber, row.rowKey, "Admission Number", row.admissionNo, resolutions, "An existing Student has this admission number.");
    else {
      const candidates = students.filter((candidate) => (digits(row.phone1) && digits(candidate.phone1 ?? "") === digits(row.phone1)) || (key(candidate.studentName) === key(row.studentName) && sameDate(candidate.dateOfBirth, row.dateOfBirth)));
      if (candidates.length) {
        if (candidates.length === 1) (row as any).candidateId = candidates[0].id;
        duplicateIssue(issues, "POSSIBLE_STUDENT_MATCH", "Students", row.rowNumber, row.rowKey, "Student Full Name", row.studentName, resolutions, candidates.length === 1 ? `One existing Student has the same governed name/date or contact (${maskPhone(candidates[0].phone1 ?? "")}). Review side by side.` : `${candidates.length} existing Students are possible matches. Create, skip or reject after side-by-side review; linking is ambiguous.`, true, candidates.length === 1);
      }
    }
  }
  for (const row of normalized.guardians) {
    const candidates = guardians.filter((candidate) => digits(candidate.primaryMobile) === digits(row.mobile));
    const existing = guardianByMobile.get(digits(row.mobile));
    if (existing) {
      if (candidates.length === 1) (row as any).candidateId = candidates[0].id;
      duplicateIssue(issues, "GUARDIAN_CONTACT_MATCH", "Guardians", row.rowNumber, row.rowKey, "Mobile", maskPhone(row.mobile), resolutions, candidates.length === 1 ? `One existing Guardian uses this contact (${maskPhone(row.mobile)}). Review side by side.` : `${candidates.length} existing Guardians use this contact. Linking is ambiguous.`, true, candidates.length === 1);
    }
  }
  for (const row of normalized.staff) {
    const existing = staffByCode.get(key(row.employeeCode));
    if (existing) duplicateIssue(issues, "STAFF_CODE_EXISTS", "Staff", row.rowNumber, row.rowKey, "Employee Code", row.employeeCode, resolutions, "An existing Staff record has this employee code.");
    else {
      const candidates = staff.filter((candidate) => (row.mobile && digits(candidate.mobile ?? "") === digits(row.mobile)) || (row.workEmail && key(candidate.email) === key(row.workEmail)) || (row.personalEmail && key(candidate.email) === key(row.personalEmail)));
      if (candidates.length) {
        if (candidates.length === 1) (row as any).candidateId = candidates[0].id;
        duplicateIssue(issues, "POSSIBLE_STAFF_MATCH", "Staff", row.rowNumber, row.rowKey, "Employee contact", maskPhone(row.mobile ?? ""), resolutions, candidates.length === 1 ? "One existing Staff record has the same contact. Review side by side." : `${candidates.length} existing Staff records are possible matches. Linking is ambiguous.`, true, candidates.length === 1);
      }
    }
    if (!designationNames.has(key(row.designation))) issues.push(issue("DESIGNATION_REFERENCE_REQUIRED", "BLOCKING_ERROR", "Staff", row.rowNumber, row.rowKey, "Designation", "The designation must exactly match existing approved reference data."));
    if (row.department && !departmentNames.has(key(row.department))) issues.push(issue("DEPARTMENT_REFERENCE_REQUIRED", "BLOCKING_ERROR", "Staff", row.rowNumber, row.rowKey, "Department", "The department must exactly match existing approved reference data."));
    if (row.roleProposal === "SUPER_ADMIN") issues.push(issue("SUPER_ADMIN_PROPOSAL_REFUSED", "BLOCKING_ERROR", "Staff", row.rowNumber, row.rowKey, "Role Proposal", "Super Admin cannot be proposed by bulk onboarding."));
    else if (row.roleProposal && !["TEACHER", "VIEWER", "ACCOUNTANT", "COMPUTER_OPERATOR"].includes(row.roleProposal) && !profileNames.has(key(row.roleProposal))) issues.push(issue("ROLE_PROFILE_UNKNOWN", "BLOCKING_ERROR", "Staff", row.rowNumber, row.rowKey, "Role Proposal", "The proposed role/profile is inactive or unknown."));
    else if (row.roleProposal && PRIVILEGED_ROLE_PROPOSALS.has(row.roleProposal)) issues.push(issue("PRIVILEGED_ROLE_PROPOSAL", "WARNING", "Staff", row.rowNumber, row.rowKey, "Role Proposal", "This privileged proposal requires separate IAM approval and will not be activated."));
  }
  for (const row of normalized.enrollments) {
    if (!studentKeys.has(row.studentRowKey)) issues.push(issue("ORPHAN_ENROLLMENT", "BLOCKING_ERROR", "Enrollments", row.rowNumber, row.rowKey, "Student Row Key", "The Student row key does not resolve."));
    else if (["SKIP", "REJECT_ROW"].includes(resolutions[row.studentRowKey]?.decision ?? "")) issues.push(issue("SKIPPED_STUDENT_DEPENDENCY", "BLOCKING_ERROR", "Enrollments", row.rowNumber, row.rowKey, "Student Row Key", "An enrollment cannot depend on a skipped Student row."));
    const reference = references.get(`${key(row.academicYear)}|${key(row.className)}|${key(row.section)}`);
    if (!reference) issues.push(issue("REFERENCE_SETUP_REQUIRED", "BLOCKING_ERROR", "Enrollments", row.rowNumber, row.rowKey, "Class", "Academic year, class and section must exactly match configured reference data."));
    else if (!reference.isActive) issues.push(issue("REFERENCE_INACTIVE", "BLOCKING_ERROR", "Enrollments", row.rowNumber, row.rowKey, "Class", "The configured class/section is inactive."));
  }
  for (const row of normalized.links) {
    if (!studentKeys.has(row.studentRowKey)) issues.push(issue("ORPHAN_STUDENT_LINK", "BLOCKING_ERROR", "Student-Guardian Links", row.rowNumber, row.rowKey, "Student Row Key", "The Student row key does not resolve."));
    else if (["SKIP", "REJECT_ROW"].includes(resolutions[row.studentRowKey]?.decision ?? "")) issues.push(issue("SKIPPED_STUDENT_DEPENDENCY", "BLOCKING_ERROR", "Student-Guardian Links", row.rowNumber, row.rowKey, "Student Row Key", "A relationship cannot depend on a skipped Student row."));
    if (!guardianKeys.has(row.guardianRowKey)) issues.push(issue("ORPHAN_GUARDIAN_LINK", "BLOCKING_ERROR", "Student-Guardian Links", row.rowNumber, row.rowKey, "Guardian Row Key", "The Guardian row key does not resolve."));
    else if (["SKIP", "REJECT_ROW"].includes(resolutions[row.guardianRowKey]?.decision ?? "")) issues.push(issue("SKIPPED_GUARDIAN_DEPENDENCY", "BLOCKING_ERROR", "Student-Guardian Links", row.rowNumber, row.rowKey, "Guardian Row Key", "A relationship cannot depend on a skipped Guardian row."));
  }
  const decisionRows = issues.filter((r) => r.severity === "REQUIRES_USER_DECISION").length;
  const blocking = issues.filter((r) => r.severity === "BLOCKING_ERROR").length;
  const warnings = issues.filter((r) => r.severity === "WARNING" || r.severity === "POSSIBLE_DUPLICATE").length;
  const summary = {
    workbookHash: batch.workbookSha256, templateVersion: batch.templateVersion,
    sheetRows: { Students: normalized.students.length, Guardians: normalized.guardians.length, "Student-Guardian Links": normalized.links.length, Enrollments: normalized.enrollments.length, Staff: normalized.staff.length },
    createCount: normalized.students.length + normalized.guardians.length + normalized.staff.length,
    updateCount: 0, linkCount: normalized.links.length, enrollmentCount: normalized.enrollments.length,
    skipCount: Object.values(resolutions).filter((r) => r.decision === "SKIP" || r.decision === "REJECT_ROW").length,
    warningCount: warnings, blockingErrorCount: blocking, duplicateCount: issues.filter((r) => r.severity === "POSSIBLE_DUPLICATE" || r.severity === "REQUIRES_USER_DECISION").length,
    unresolvedDecisionCount: decisionRows,
    accountProposalCount: normalized.guardians.filter((r) => r.parentAccountProposal).length + normalized.staff.filter((r) => r.portalAccountProposal).length,
    affectedAcademicYears: unique(normalized.enrollments.map((r) => r.academicYear)),
    affectedClasses: unique(normalized.enrollments.map((r) => `${r.className} ${r.section}`.trim())),
    departments: unique(normalized.staff.map((r) => r.department).filter((value): value is string => Boolean(value))),
    designations: unique(normalized.staff.map((r) => r.designation)),
    importOrder: ["Students", "Guardians", "Student-Guardian Links", "Enrollments", "Staff", "Pending IAM proposals"],
    executionMode: "ALL_OR_NOTHING", rollbackFeasible: blocking === 0 && decisionRows === 0,
    estimatedExecutionSize: normalized.students.length + normalized.guardians.length + normalized.links.length + normalized.enrollments.length + normalized.staff.length,
    referenceVersionHash: referenceHash, targetVersionHash: targetHash
  };
  const planHash = stableHash({ workbook: batch.workbookSha256, summary, issues, resolutions });
  return { normalized, issues, resolutions, summary, planHash, referenceHash, targetHash };
}

export async function validateStoredBatch(client: PrismaClient, publicKey: string, actorUserId: string, resolutions: Resolutions = {}) {
  const batch = await client.onboardingBatch.findUnique({ where: { publicKey } });
  if (!batch || batch.purgedAt) throw new OnboardingError("The onboarding batch is unavailable.", 404, "BATCH_NOT_FOUND");
  const bytes = await readOnboardingWorkbook(batch.storageKey, batch.workbookSha256);
  const rows = parseOnboardingWorkbook(bytes, batch.bundleType as OnboardingBundle);
  const plan = await createDryRunPlan(client, batch, rows, resolutions);
  const expiresAt = new Date(Date.now() + ONBOARDING_PLAN_TTL_MS);
  const updated = await client.$transaction(async (tx) => {
    const changed = await tx.onboardingBatch.updateMany({ where: { id: batch.id, version: batch.version, status: { in: ["UPLOADED", "VALIDATED", "APPROVAL_REQUIRED", "REJECTED"] } }, data: { status: plan.summary.blockingErrorCount || plan.summary.unresolvedDecisionCount ? "VALIDATED" : "APPROVAL_REQUIRED", version: { increment: 1 }, planVersion: { increment: 1 }, planHash: plan.planHash, planSummaryJson: JSON.stringify({ ...plan.summary, issues: plan.issues, resolutions }), referenceVersionHash: plan.referenceHash, targetVersionHash: plan.targetHash, planExpiresAt: expiresAt, approvedAt: null, approvedByUserId: null, approvalReason: null } });
    if (changed.count !== 1) throw new OnboardingError("The batch changed while validation was running.", 409, "BATCH_VERSION_CHANGED");
    const next = await tx.onboardingBatch.findUniqueOrThrow({ where: { id: batch.id } });
    await appendAudit(tx, next.id, "VALIDATED", batch.status, next.status, actorUserId, null, plan.planHash);
    return next;
  });
  return presentBatch(updated, plan.summary, plan.issues, resolutions);
}

export async function approveOnboardingBatch(client: PrismaClient, publicKey: string, actor: IamActor, input: { reason: string; reauthPassword: string; planHash: string; workbookHash: string }) {
  await requireCriticalReauthentication(client, actor, input.reauthPassword);
  const reason = bounded(input.reason, "Approval reason", 12, 500);
  const batch = await client.onboardingBatch.findUnique({ where: { publicKey } });
  if (!batch || batch.status !== "APPROVAL_REQUIRED") throw new OnboardingError("A current approval-ready plan is required.", 409, "PLAN_NOT_APPROVABLE");
  if (actor.user.role === "PRINCIPAL" && batch.bundleType !== "STUDENT_GUARDIAN") throw new OnboardingError("Principal approval is limited to the Student and Guardian onboarding bundle.", 403, "BUNDLE_APPROVAL_SCOPE_REFUSED");
  if (batch.planExpiresAt == null || batch.planExpiresAt <= new Date()) throw new OnboardingError("The dry-run plan has expired.", 409, "PLAN_EXPIRED");
  if (batch.planHash !== input.planHash || batch.workbookSha256 !== input.workbookHash) throw new OnboardingError("The workbook or plan changed.", 409, "PLAN_HASH_CHANGED");
  const summary = JSON.parse(batch.planSummaryJson ?? "{}") as any;
  if (summary.blockingErrorCount || summary.unresolvedDecisionCount) throw new OnboardingError("Resolve every blocking issue and decision before approval.", 409, "PLAN_HAS_BLOCKERS");
  const privileged = Array.isArray(summary.issues) && summary.issues.some((r: any) => r.code === "PRIVILEGED_ROLE_PROPOSAL");
  if (privileged && batch.uploadedByUserId === actor.user.id) throw new OnboardingError("A privileged IAM proposal requires separation of duties.", 403, "SELF_APPROVAL_REFUSED");
  return client.$transaction(async (tx) => {
    const changed = await tx.onboardingBatch.updateMany({ where: { id: batch.id, version: batch.version, status: "APPROVAL_REQUIRED" }, data: { status: "APPROVED", approvedByUserId: actor.user.id, approvalReason: reason, approvedAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new OnboardingError("The batch changed before approval.", 409, "BATCH_VERSION_CHANGED");
    await appendAudit(tx, batch.id, "APPROVED", batch.status, "APPROVED", actor.user.id, reason, batch.planHash);
    return presentBatch(await tx.onboardingBatch.findUniqueOrThrow({ where: { id: batch.id } }));
  });
}

export async function executeOnboardingBatch(client: PrismaClient, publicKey: string, actor: IamActor, input: { reason: string; reauthPassword: string; planHash: string; workbookHash: string; idempotencyKey: string }) {
  await requireCriticalReauthentication(client, actor, input.reauthPassword);
  const reason = bounded(input.reason, "Execution reason", 12, 500), idempotencyKey = opaqueKey(input.idempotencyKey);
  const batch = await client.onboardingBatch.findUnique({ where: { publicKey } });
  if (!batch) throw new OnboardingError("The onboarding batch is unavailable.", 404, "BATCH_NOT_FOUND");
  const payloadHash = stableHash({ publicKey, planHash: input.planHash, workbookHash: input.workbookHash, reason });
  if (batch.status === "COMPLETED" && batch.executionIdempotencyKey === idempotencyKey) {
    if (batch.executionPayloadHash !== payloadHash) throw new OnboardingError("This idempotency key was used with different input.", 409, "IDEMPOTENCY_PAYLOAD_CHANGED");
    return presentBatch(batch);
  }
  if (batch.status !== "APPROVED" || batch.planExpiresAt == null || batch.planExpiresAt <= new Date()) throw new OnboardingError("A current approved plan is required.", 409, "APPROVAL_STALE");
  if (batch.planHash !== input.planHash || batch.workbookSha256 !== input.workbookHash) throw new OnboardingError("The workbook or plan changed.", 409, "PLAN_HASH_CHANGED");
  const bytes = await readOnboardingWorkbook(batch.storageKey, batch.workbookSha256);
  const rows = parseOnboardingWorkbook(bytes, batch.bundleType as OnboardingBundle);
  const saved = JSON.parse(batch.planSummaryJson ?? "{}") as { resolutions?: Resolutions };
  const plan = await createDryRunPlan(client, batch, rows, saved.resolutions ?? {});
  if (plan.planHash !== batch.planHash || plan.referenceHash !== batch.referenceVersionHash || plan.targetHash !== batch.targetVersionHash) throw new OnboardingError("Reference or target data changed; validate again.", 409, "PLAN_STALE");
  if (plan.summary.blockingErrorCount || plan.summary.unresolvedDecisionCount) throw new OnboardingError("The approved plan contains unresolved issues.", 409, "PLAN_HAS_BLOCKERS");
  return client.$transaction(async (tx) => {
    const claim = await tx.onboardingBatch.updateMany({ where: { id: batch.id, version: batch.version, status: "APPROVED", executionIdempotencyKey: null }, data: { status: "EXECUTING", executionIdempotencyKey: idempotencyKey, executionPayloadHash: payloadHash, executedByUserId: actor.user.id, version: { increment: 1 } } });
    if (claim.count !== 1) {
      const existing = await tx.onboardingBatch.findUniqueOrThrow({ where: { id: batch.id } });
      if (existing.executionIdempotencyKey === idempotencyKey && existing.executionPayloadHash === payloadHash && existing.executionResultJson) return presentBatch(existing);
      throw new OnboardingError("This batch is already being executed.", 409, "CONCURRENT_EXECUTION_REFUSED");
    }
    const result = await applyPlan(tx, batch.id, plan, saved.resolutions ?? {});
    const completed = await tx.onboardingBatch.update({ where: { id: batch.id }, data: { status: "COMPLETED", executedAt: new Date(), executionResultJson: JSON.stringify({ ...result, checksum: stableHash(result), reason }), version: { increment: 1 } } });
    await appendAudit(tx, batch.id, "EXECUTED", "APPROVED", "COMPLETED", actor.user.id, reason, stableHash(result));
    return presentBatch(completed, result);
  }, { maxWait: 10_000, timeout: 120_000 });
}

export async function rollbackOnboardingBatch(client: PrismaClient, publicKey: string, actor: IamActor, input: { reason: string; reauthPassword: string; execute?: boolean }) {
  await requireCriticalReauthentication(client, actor, input.reauthPassword);
  const reason = bounded(input.reason, "Rollback reason", 12, 500);
  const batch = await client.onboardingBatch.findUnique({ where: { publicKey }, include: { rowOutcomes: true } });
  if (!batch || batch.status !== "COMPLETED" || !batch.executedAt) throw new OnboardingError("Only a completed exact batch can be considered for rollback.", 409, "ROLLBACK_NOT_AVAILABLE");
  const ids = groupOutcomeIds(batch.rowOutcomes.filter((r: any) => r.action === "CREATE" && r.targetRecordId));
  const createdOutcomes = batch.rowOutcomes.filter((row: any) => row.action === "CREATE" && row.targetRecordId);
  const dependencies = await rollbackDependencies(client, ids, createdOutcomes);
  const preview = { eligible: dependencies.length === 0, dependencies, counts: Object.fromEntries(Object.entries(ids).map(([k, v]) => [k, v.length])), manualReconciliationRequired: dependencies.length > 0 };
  if (!input.execute) {
    return client.$transaction(async (tx) => {
      await tx.onboardingBatch.update({ where: { id: batch.id }, data: { rollbackPreviewJson: JSON.stringify(preview), version: { increment: 1 } } });
      await appendAudit(tx, batch.id, preview.eligible ? "ROLLBACK_PREVIEW_ELIGIBLE" : "ROLLBACK_PREVIEW_BLOCKED", "COMPLETED", "COMPLETED", actor.user.id, reason, stableHash(preview));
      return preview;
    });
  }
  if (!preview.eligible) throw new OnboardingError("Later business activity blocks automatic rollback. Use manual reconciliation.", 409, "ROLLBACK_DEPENDENCY_EXISTS");
  return client.$transaction(async (tx) => {
    await tx.studentGuardian.deleteMany({ where: { id: { in: ids.LINK } } });
    await tx.academicYearEnrollment.deleteMany({ where: { id: { in: ids.ENROLLMENT } } });
    await tx.staffMember.deleteMany({ where: { id: { in: ids.STAFF } } });
    await tx.guardian.deleteMany({ where: { id: { in: ids.GUARDIAN } } });
    await tx.student.deleteMany({ where: { id: { in: ids.STUDENT } } });
    await tx.onboardingRowOutcome.updateMany({ where: { batchId: batch.id, action: "CREATE" }, data: { status: "ROLLED_BACK" } });
    const rolled = await tx.onboardingBatch.update({ where: { id: batch.id }, data: { status: "ROLLED_BACK", rolledBackAt: new Date(), rolledBackByUserId: actor.user.id, rollbackReason: reason, rollbackPreviewJson: JSON.stringify(preview), version: { increment: 1 } } });
    await appendAudit(tx, batch.id, "ROLLED_BACK", "COMPLETED", "ROLLED_BACK", actor.user.id, reason, stableHash(preview));
    return presentBatch(rolled, preview);
  });
}

export function buildErrorWorkbook(batchPublicKey: string, issues: OnboardingIssue[]) {
  const rows = issues.map((r) => ({ "Original Row Number": r.row, Sheet: r.sheet, Column: r.column ?? "", "Issue Code": r.code, Severity: r.severity, Message: formulaSafe(r.message), "Suggested Correction": formulaSafe(r.suggestion ?? ""), "Current Submitted Value": formulaSafe(r.submittedValue ?? ""), "Corrected Value": "", "Row Import Key": formulaSafe(r.rowKey ?? "") }));
  const wb = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "Issue Code": "NO_ISSUES", Message: "No validation issues were recorded." }]);
  XLSX.utils.book_append_sheet(wb, sheet, "Validation Errors"); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Import Batch Reference", batchPublicKey], ["Privacy", "PRIVATE - authenticated correction workbook"], ["Formula safety", "Generated values are neutralised"]]), "Instructions");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx", compression: true }));
}

function normalizeWorkbook(rows: OnboardingWorkbookRows) {
  const issues: OnboardingIssue[] = [], seen: Record<string, Set<string>> = { student: new Set(), guardian: new Set(), link: new Set(), enrollment: new Set(), staff: new Set() };
  const students = rows.students.map((raw, i) => normalizeStudent(raw, i + 2, issues, seen.student));
  const guardians = rows.guardians.map((raw, i) => normalizeGuardian(raw, i + 2, issues, seen.guardian));
  const links = rows.links.map((raw, i) => normalizeLink(raw, i + 2, issues, seen.link));
  const enrollments = rows.enrollments.map((raw, i) => normalizeEnrollment(raw, i + 2, issues, seen.enrollment));
  const staff = rows.staff.map((raw, i) => normalizeStaff(raw, i + 2, issues, seen.staff));
  duplicateValues(students, "admissionNo", "Students", "DUPLICATE_ADMISSION_IN_WORKBOOK", issues);
  duplicateValues(guardians, "mobile", "Guardians", "DUPLICATE_GUARDIAN_CONTACT_IN_WORKBOOK", issues);
  duplicateValues(staff, "employeeCode", "Staff", "DUPLICATE_EMPLOYEE_CODE_IN_WORKBOOK", issues);
  duplicateValues(links, "linkIdentity", "Student-Guardian Links", "DUPLICATE_RELATIONSHIP", issues);
  duplicateValues(enrollments, "enrollmentIdentity", "Enrollments", "DUPLICATE_ENROLLMENT", issues);
  duplicateValues(enrollments, "rollIdentity", "Enrollments", "DUPLICATE_ROLL_NUMBER", issues);
  return { students, guardians, links, enrollments, staff, issues };
}
function normalizeStudent(r: any, rowNumber: number, issues: OnboardingIssue[], seen: Set<string>) { const rowKey = required(r["Import Row Key"], "STUDENT_ROW_KEY_REQUIRED", "Students", rowNumber, issues); uniqueKey(rowKey, seen, "Students", rowNumber, issues); const dateOfBirth = date(r["Date of Birth"], "Students", rowNumber, rowKey, issues); if (dateOfBirth && dateOfBirth > new Date()) issues.push(issue("DOB_IN_FUTURE", "BLOCKING_ERROR", "Students", rowNumber, rowKey, "Date of Birth", "Date of birth cannot be in the future.")); return { rowNumber, rowKey, candidateId: null as string | null, admissionNo: required(r["Admission Number"], "ADMISSION_NUMBER_REQUIRED", "Students", rowNumber, issues), studentName: required(r["Student Full Name"], "STUDENT_NAME_REQUIRED", "Students", rowNumber, issues), fatherName: required(r["Father Name"], "FATHER_NAME_REQUIRED", "Students", rowNumber, issues), motherName: optional(r["Mother Name"]), phone1: phone(r["Phone"], "Students", rowNumber, rowKey, issues, true), phone2: phone(r["Alternate Phone"], "Students", rowNumber, rowKey, issues), dateOfBirth, academicYear: required(r["Academic Year"], "ACADEMIC_YEAR_REQUIRED", "Students", rowNumber, issues), className: required(r.Class, "CLASS_REQUIRED", "Students", rowNumber, issues), section: optional(r.Section), rollNo: optional(r["Roll Number"]), status: enumText(r["Student Status"], ["ACTIVE", "INACTIVE"], "ACTIVE", "Students", rowNumber, rowKey, issues), notes: optional(r.Notes) }; }
function normalizeGuardian(r: any, rowNumber: number, issues: OnboardingIssue[], seen: Set<string>) { const rowKey = required(r["Guardian Row Key"], "GUARDIAN_ROW_KEY_REQUIRED", "Guardians", rowNumber, issues); uniqueKey(rowKey, seen, "Guardians", rowNumber, issues); return { rowNumber, rowKey, name: required(r.Name, "GUARDIAN_NAME_REQUIRED", "Guardians", rowNumber, issues), relationship: required(r.Relationship, "RELATIONSHIP_REQUIRED", "Guardians", rowNumber, issues), mobile: phone(r.Mobile, "Guardians", rowNumber, rowKey, issues, true), alternateMobile: phone(r["Alternate Mobile"], "Guardians", rowNumber, rowKey, issues), email: email(r.Email, "Guardians", rowNumber, rowKey, issues), communicationPreference: optional(r["Communication Preference"]), parentAccountProposal: bool(r["Parent Account Proposal"], "Guardians", rowNumber, rowKey, issues) }; }
function normalizeLink(r: any, rowNumber: number, issues: OnboardingIssue[], seen: Set<string>) { const rowKey = required(r["Link Row Key"], "LINK_ROW_KEY_REQUIRED", "Student-Guardian Links", rowNumber, issues); uniqueKey(rowKey, seen, "Student-Guardian Links", rowNumber, issues); const studentRowKey = required(r["Student Row Key"], "LINK_STUDENT_REQUIRED", "Student-Guardian Links", rowNumber, issues), guardianRowKey = required(r["Guardian Row Key"], "LINK_GUARDIAN_REQUIRED", "Student-Guardian Links", rowNumber, issues); return { rowNumber, rowKey, studentRowKey, guardianRowKey, relationship: required(r["Relationship to Student"], "RELATIONSHIP_REQUIRED", "Student-Guardian Links", rowNumber, issues), primary: bool(r["Primary Contact"], "Student-Guardian Links", rowNumber, rowKey, issues), canViewFees: bool(r["Can View Fees"], "Student-Guardian Links", rowNumber, rowKey, issues, true), canReceiveReminders: bool(r["Can Receive Reminders"], "Student-Guardian Links", rowNumber, rowKey, issues, true), linkIdentity: `${key(studentRowKey)}|${key(guardianRowKey)}` }; }
function normalizeEnrollment(r: any, rowNumber: number, issues: OnboardingIssue[], seen: Set<string>) { const rowKey = required(r["Enrollment Row Key"], "ENROLLMENT_ROW_KEY_REQUIRED", "Enrollments", rowNumber, issues); uniqueKey(rowKey, seen, "Enrollments", rowNumber, issues); const studentRowKey = required(r["Student Row Key"], "ENROLLMENT_STUDENT_REQUIRED", "Enrollments", rowNumber, issues), academicYear = required(r["Academic Year"], "ACADEMIC_YEAR_REQUIRED", "Enrollments", rowNumber, issues), className = required(r.Class, "CLASS_REQUIRED", "Enrollments", rowNumber, issues), section = optional(r.Section), rollNo = optional(r["Roll Number"]); return { rowNumber, rowKey, studentRowKey, academicYear, className, section, rollNo, enrollmentDate: date(r["Enrollment Date"], "Enrollments", rowNumber, rowKey, issues), status: enumText(r.Status, ["ACTIVE", "INACTIVE"], "ACTIVE", "Enrollments", rowNumber, rowKey, issues), enrollmentIdentity: `${key(studentRowKey)}|${key(academicYear)}`, rollIdentity: rollNo ? `${key(academicYear)}|${key(className)}|${key(section)}|${key(rollNo)}` : "" }; }
function normalizeStaff(r: any, rowNumber: number, issues: OnboardingIssue[], seen: Set<string>) { const rowKey = required(r["Staff Row Key"], "STAFF_ROW_KEY_REQUIRED", "Staff", rowNumber, issues); uniqueKey(rowKey, seen, "Staff", rowNumber, issues); const joiningDate = date(r["Joining Date"], "Staff", rowNumber, rowKey, issues); if (joiningDate && joiningDate > new Date()) issues.push(issue("JOINING_DATE_IN_FUTURE", "BLOCKING_ERROR", "Staff", rowNumber, rowKey, "Joining Date", "Joining date cannot be in the future.")); return { rowNumber, rowKey, candidateId: null as string | null, employeeCode: required(r["Employee Code"], "EMPLOYEE_CODE_REQUIRED", "Staff", rowNumber, issues), name: required(r.Name, "STAFF_NAME_REQUIRED", "Staff", rowNumber, issues), staffType: enumText(r["Staff Type"], ["TEACHING", "NON_TEACHING", "ADMINISTRATIVE", "SUPPORT"], "TEACHING", "Staff", rowNumber, rowKey, issues), designation: required(r.Designation, "DESIGNATION_REQUIRED", "Staff", rowNumber, issues), department: optional(r.Department), joiningDate, workEmail: email(r["Work Email"], "Staff", rowNumber, rowKey, issues), personalEmail: email(r["Personal Email"], "Staff", rowNumber, rowKey, issues), mobile: phone(r.Mobile, "Staff", rowNumber, rowKey, issues), roleProposal: optional(r["Role Proposal"])?.toUpperCase().replace(/[ -]+/g, "_") ?? null, portalAccountProposal: bool(r["Portal Account Proposal"], "Staff", rowNumber, rowKey, issues), status: enumText(r["Employment Status"], ["ACTIVE", "INACTIVE", "ON_LEAVE"], "ACTIVE", "Staff", rowNumber, rowKey, issues), notes: optional(r.Notes) }; }

async function applyPlan(tx: Prisma.TransactionClient, batchId: string, plan: Awaited<ReturnType<typeof createDryRunPlan>>, resolutions: Resolutions) {
  const studentIds = new Map<string, string>(), guardianIds = new Map<string, string>(); const counts = { students: 0, guardians: 0, links: 0, enrollments: 0, staff: 0, accountProposals: 0, skipped: 0 };
  for (const r of plan.normalized.students) { const decision = resolutions[r.rowKey]?.decision; if (decision === "SKIP" || decision === "REJECT_ROW") { counts.skipped++; continue; } const existing = await tx.student.findUnique({ where: { admissionNo: r.admissionNo } }); if (existing) { if (decision !== "LINK_EXISTING") throw new OnboardingError("Existing Student requires LINK_EXISTING.", 409, "STUDENT_CONFLICT"); studentIds.set(r.rowKey, existing.id); await outcome(tx, batchId, "STUDENT", "Students", r, "LINK_EXISTING", "COMPLETED", existing.id, hashRecord(existing)); continue; } if (decision === "LINK_EXISTING") { const candidate = r.candidateId ? await tx.student.findUnique({ where: { id: r.candidateId } }) : null; if (!candidate) throw new OnboardingError("The selected Student match is unavailable or ambiguous.", 409, "STUDENT_LINK_TARGET_REFUSED"); studentIds.set(r.rowKey, candidate.id); await outcome(tx, batchId, "STUDENT", "Students", r, "LINK_EXISTING", "COMPLETED", candidate.id, hashRecord(candidate)); continue; } const created = await tx.student.create({ data: { admissionNo: r.admissionNo, studentName: r.studentName, fatherName: r.fatherName, motherName: r.motherName, phone1: r.phone1, phone2: r.phone2, dateOfBirth: r.dateOfBirth, academicYear: r.academicYear, className: r.className, section: r.section, rollNo: r.rollNo, status: titleStatus(r.status), remarks: r.notes } }); studentIds.set(r.rowKey, created.id); counts.students++; await outcome(tx, batchId, "STUDENT", "Students", r, "CREATE", "COMPLETED", created.id, hashRecord(created)); }
  for (const r of plan.normalized.guardians) { const decision = resolutions[r.rowKey]?.decision; if (decision === "SKIP" || decision === "REJECT_ROW") { counts.skipped++; continue; } const matches = await tx.guardian.findMany({ where: { primaryMobile: r.mobile }, take: 2 }); if (matches.length && decision !== "CREATE_NEW") { if (decision !== "LINK_EXISTING" || matches.length !== 1) throw new OnboardingError("Existing Guardian requires an unambiguous LINK_EXISTING decision.", 409, "GUARDIAN_CONFLICT"); guardianIds.set(r.rowKey, matches[0].id); await outcome(tx, batchId, "GUARDIAN", "Guardians", r, "LINK_EXISTING", "COMPLETED", matches[0].id, hashRecord(matches[0])); } else { const created = await tx.guardian.create({ data: { displayName: r.name, relationship: r.relationship, primaryMobile: r.mobile, alternateMobile: r.alternateMobile, email: r.email, status: "Active" } }); guardianIds.set(r.rowKey, created.id); counts.guardians++; await outcome(tx, batchId, "GUARDIAN", "Guardians", r, "CREATE", "COMPLETED", created.id, hashRecord(created)); } if (r.parentAccountProposal) { counts.accountProposals++; await outcome(tx, batchId, "ACCOUNT_PROPOSAL", "Guardians", { ...r, rowKey: `${r.rowKey}:ACCOUNT` }, "PROPOSE", "PENDING_ACTIVATION", guardianIds.get(r.rowKey)!, stableHash({ type: "PARENT", guardianRowKey: r.rowKey })); } }
  for (const r of plan.normalized.links) { const studentId = studentIds.get(r.studentRowKey), guardianId = guardianIds.get(r.guardianRowKey); if (!studentId || !guardianId) throw new OnboardingError("A relationship dependency was skipped or unresolved.", 409, "LINK_DEPENDENCY_MISSING"); const existing = await tx.studentGuardian.findUnique({ where: { guardianId_studentId: { guardianId, studentId } } }); if (existing) { await outcome(tx, batchId, "LINK", "Student-Guardian Links", r, "LINK_EXISTING", "COMPLETED", existing.id, hashRecord(existing)); continue; } const created = await tx.studentGuardian.create({ data: { studentId, guardianId, relationshipToStudent: r.relationship, isPrimaryContact: r.primary, canViewFees: r.canViewFees, canReceiveReminders: r.canReceiveReminders } }); counts.links++; await outcome(tx, batchId, "LINK", "Student-Guardian Links", r, "CREATE", "COMPLETED", created.id, hashRecord(created)); }
  for (const r of plan.normalized.enrollments) { const studentId = studentIds.get(r.studentRowKey); if (!studentId) throw new OnboardingError("An enrollment dependency was skipped or unresolved.", 409, "ENROLLMENT_DEPENDENCY_MISSING"); const existing = await tx.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId, academicYear: r.academicYear } } }); if (existing) throw new OnboardingError("An enrollment already exists for this academic year.", 409, "ENROLLMENT_CONFLICT"); const created = await tx.academicYearEnrollment.create({ data: { studentId, academicYear: r.academicYear, className: r.className, section: r.section, rollNo: r.rollNo, enrollmentDate: r.enrollmentDate, status: r.status } }); counts.enrollments++; await outcome(tx, batchId, "ENROLLMENT", "Enrollments", r, "CREATE", "COMPLETED", created.id, hashRecord(created)); }
  for (const r of plan.normalized.staff) { const decision = resolutions[r.rowKey]?.decision; if (decision === "SKIP" || decision === "REJECT_ROW") { counts.skipped++; continue; } const existing = await tx.staffMember.findUnique({ where: { staffCode: r.employeeCode } }); if (existing) { if (decision !== "LINK_EXISTING") throw new OnboardingError("Existing Staff requires LINK_EXISTING.", 409, "STAFF_CONFLICT"); await outcome(tx, batchId, "STAFF", "Staff", r, "LINK_EXISTING", "COMPLETED", existing.id, hashRecord(existing)); continue; } if (decision === "LINK_EXISTING") { const candidate = r.candidateId ? await tx.staffMember.findUnique({ where: { id: r.candidateId } }) : null; if (!candidate) throw new OnboardingError("The selected Staff match is unavailable or ambiguous.", 409, "STAFF_LINK_TARGET_REFUSED"); await outcome(tx, batchId, "STAFF", "Staff", r, "LINK_EXISTING", "COMPLETED", candidate.id, hashRecord(candidate)); continue; } const created = await tx.staffMember.create({ data: { staffCode: r.employeeCode, fullName: r.name, staffType: r.staffType, designation: r.designation, department: r.department, dateOfJoining: r.joiningDate, email: r.workEmail ?? r.personalEmail, mobile: r.mobile, status: r.status, notes: r.notes } }); counts.staff++; await outcome(tx, batchId, "STAFF", "Staff", r, "CREATE", "COMPLETED", created.id, hashRecord(created)); if (r.portalAccountProposal) { counts.accountProposals++; await outcome(tx, batchId, "ACCOUNT_PROPOSAL", "Staff", { ...r, rowKey: `${r.rowKey}:ACCOUNT` }, "PROPOSE", "PENDING_ACTIVATION", created.id, stableHash({ type: "STAFF", role: r.roleProposal, staffRowKey: r.rowKey })); } }
  return counts;
}

async function rollbackDependencies(client: PrismaClient, ids: ReturnType<typeof groupOutcomeIds>, createdOutcomes: any[]) {
  const reasons: string[] = [];
  const [payments, attendance, marks, cards, classwork, departures, support, payroll, parentAccounts, staffAccounts, students, guardians, links, enrollments, staff] = await Promise.all([
    client.payment.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.studentAttendanceRecord.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.studentMark.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.studentReportCard.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.classworkSubmission.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.studentDepartureRequest.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.supportRequestLinkedChild.count({ where: { studentId: { in: ids.STUDENT } } }),
    client.employeePayrollResult.count({ where: { staffMemberId: { in: ids.STAFF } } }),
    client.user.count({ where: { guardianId: { in: ids.GUARDIAN }, isActive: true } }),
    client.staffMember.count({ where: { id: { in: ids.STAFF }, userId: { not: null } } }),
    client.student.findMany({ where: { id: { in: ids.STUDENT } } }),
    client.guardian.findMany({ where: { id: { in: ids.GUARDIAN } } }),
    client.studentGuardian.findMany({ where: { id: { in: ids.LINK } } }),
    client.academicYearEnrollment.findMany({ where: { id: { in: ids.ENROLLMENT } } }),
    client.staffMember.findMany({ where: { id: { in: ids.STAFF } } })
  ]);
  for (const [label, count] of [["PAYMENT", payments], ["ATTENDANCE", attendance], ["MARKS", marks], ["REPORT_CARD", cards], ["CLASSWORK", classwork], ["SAFE_EXIT", departures], ["SUPPORT", support], ["PAYROLL", payroll], ["PARENT_ACCOUNT", parentAccounts], ["STAFF_ACCOUNT", staffAccounts]] as const) if (count) reasons.push(`${label}:${count}`);
  const expected = new Map(createdOutcomes.map((row) => [`${row.entityType}:${row.targetRecordId}`, row.afterHash]));
  for (const [entityType, rows] of [["STUDENT", students], ["GUARDIAN", guardians], ["LINK", links], ["ENROLLMENT", enrollments], ["STAFF", staff]] as const) {
    const current = new Map(rows.map((row: any) => [row.id, hashRecord(row)]));
    for (const id of ids[entityType]) if (current.get(id) !== expected.get(`${entityType}:${id}`)) reasons.push(`MANUAL_EDIT_OR_MISSING:${entityType}`);
  }
  return [...new Set(reasons)];
}
function groupOutcomeIds(rows: any[]) { const result: Record<"STUDENT"|"GUARDIAN"|"LINK"|"ENROLLMENT"|"STAFF", string[]> = { STUDENT: [], GUARDIAN: [], LINK: [], ENROLLMENT: [], STAFF: [] }; for (const row of rows) if (row.targetRecordId && row.entityType in result) result[row.entityType as keyof typeof result].push(row.targetRecordId); return result; }
async function outcome(tx: Prisma.TransactionClient, batchId: string, entityType: string, sheetName: string, row: any, action: string, status: string, targetRecordId: string | null, afterHash: string) { await tx.onboardingRowOutcome.create({ data: { batchId, entityType, sheetName, sourceRowNumber: row.rowNumber, importRowKey: row.rowKey, action, status, targetRecordId, afterHash, issueCodesJson: "[]" } }); }
async function appendAudit(tx: Prisma.TransactionClient, batchId: string, eventType: string, previousStatus: string | null, newStatus: string | null, actorUserId: string, reasonSafe: string | null, evidenceHash: string | null) { const last = await tx.onboardingAuditEvent.findFirst({ where: { batchId }, orderBy: { sequence: "desc" }, select: { sequence: true } }); await tx.onboardingAuditEvent.create({ data: { batchId, sequence: (last?.sequence ?? 0) + 1, eventType, previousStatus, newStatus, actorUserId, reasonSafe, evidenceHash } }); }
export function presentBatch(batch: any, result?: any, issues?: OnboardingIssue[], resolutions?: Resolutions) { return { batchReference: batch.publicKey, bundleType: batch.bundleType, mode: batch.mode, status: batch.status, version: batch.version, workbookHash: batch.workbookSha256, templateVersion: batch.templateVersion, schemaVersion: batch.schemaVersion, planHash: batch.planHash, planVersion: batch.planVersion, planExpiresAt: batch.planExpiresAt, approvedAt: batch.approvedAt, executedAt: batch.executedAt, rolledBackAt: batch.rolledBackAt, createdAt: batch.createdAt, result: result ?? safeJson(batch.executionResultJson), plan: safeJson(batch.planSummaryJson), issues, resolutions } as const; }
function safeJson(value: string | null | undefined) { try { return value ? JSON.parse(value) : null; } catch { return null; } }
function duplicateIssue(issues: OnboardingIssue[], code: string, sheet: string, row: number, rowKey: string, column: string, value: string, resolutions: Resolutions, message: string, allowCreateNew = false, linkUnambiguous = true) { const decision = resolutions[rowKey]; if (!decision) issues.push({ code, severity: "REQUIRES_USER_DECISION", sheet, row, rowKey, column, submittedValue: value, message, suggestion: allowCreateNew ? "Choose CREATE_NEW, LINK_EXISTING, SKIP or REJECT_ROW and record a reason." : "Choose LINK_EXISTING, SKIP or REJECT_ROW and record a reason." }); else if (!decision.reason?.trim()) issues.push(issue("DECISION_REASON_REQUIRED", "BLOCKING_ERROR", sheet, row, rowKey, column, "A duplicate decision requires a reason.")); else if (decision.decision === "UPDATE_EXISTING") issues.push(issue("UPDATE_MODE_NOT_AUTHORISED", "BLOCKING_ERROR", sheet, row, rowKey, column, "Updates require a separately authorised correction workbook.")); else if (decision.decision === "CREATE_NEW" && !allowCreateNew) issues.push(issue("CREATE_DUPLICATE_REFUSED", "BLOCKING_ERROR", sheet, row, rowKey, column, "Create-new is not safe for an existing governed identifier; link, skip or reject the row.")); else if (decision.decision === "LINK_EXISTING" && !linkUnambiguous) issues.push(issue("AMBIGUOUS_LINK_REFUSED", "BLOCKING_ERROR", sheet, row, rowKey, column, "More than one possible target exists; linking is refused until the workbook is corrected.")); }
function issue(code: string, severity: OnboardingIssue["severity"], sheet: string, row: number, rowKey: string, column: string, message: string): OnboardingIssue { return { code, severity, sheet, row, rowKey, column, message }; }
function required(value: unknown, code: string, sheet: string, row: number, issues: OnboardingIssue[]) { const result = text(value); if (!result) issues.push(issue(code, "BLOCKING_ERROR", sheet, row, "", "", `${code.replaceAll("_", " ").toLowerCase()} is required.`)); return result; }
function optional(value: unknown) { return text(value) || null; }
function text(value: unknown) { return String(value ?? "").trim().normalize("NFC").slice(0, 500); }
function uniqueKey(value: string, seen: Set<string>, sheet: string, row: number, issues: OnboardingIssue[]) { const normalized = key(value); if (normalized && seen.has(normalized)) issues.push(issue("DUPLICATE_ROW_KEY", "BLOCKING_ERROR", sheet, row, value, "Row Key", "The row key is duplicated.")); seen.add(normalized); }
function phone(value: unknown, sheet: string, row: number, rowKey: string, issues: OnboardingIssue[], requiredValue = false) { const raw = text(value); if (!raw) { if (requiredValue) issues.push(issue("PHONE_REQUIRED", "BLOCKING_ERROR", sheet, row, rowKey, "Phone", "A phone number is required.")); return ""; } const result = digits(raw); if (result.length === 12 && result.startsWith("91")) return result.slice(2); if (result.length !== 10 || !/^[6-9]/.test(result)) issues.push(issue("PHONE_INVALID", "BLOCKING_ERROR", sheet, row, rowKey, "Phone", "Use a valid 10-digit Indian mobile number.")); return result; }
function email(value: unknown, sheet: string, row: number, rowKey: string, issues: OnboardingIssue[]) { const result = text(value).toLowerCase(); if (result && (!/^\S+@\S+\.\S+$/.test(result) || result.length > 254)) issues.push(issue("EMAIL_INVALID", "BLOCKING_ERROR", sheet, row, rowKey, "Email", "The email format is invalid.")); return result || null; }
function date(value: unknown, sheet: string, row: number, rowKey: string, issues: OnboardingIssue[]) { if (value == null || value === "") return null; let result: Date | null = null, parts: [number, number, number] | null = null; if (typeof value === "number" && Number.isFinite(value)) result = new Date(Date.UTC(1899, 11, 30) + value * 86400000); else { const raw = text(value), m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$|^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/); if (m) { parts = [Number(m[1] ?? m[6]), Number(m[2] ?? m[5]), Number(m[3] ?? m[4])]; result = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])); } } if (!result || Number.isNaN(result.getTime()) || parts && (result.getUTCFullYear() !== parts[0] || result.getUTCMonth() + 1 !== parts[1] || result.getUTCDate() !== parts[2])) { issues.push(issue("DATE_INVALID", "BLOCKING_ERROR", sheet, row, rowKey, "Date", "Use a valid YYYY-MM-DD or DD/MM/YYYY date.")); return null; } return result; }
function bool(value: unknown, sheet: string, row: number, rowKey: string, issues: OnboardingIssue[], defaultValue = false) { const raw = key(value); if (!raw) return defaultValue; if (["YES", "TRUE", "1"].includes(raw)) return true; if (["NO", "FALSE", "0"].includes(raw)) return false; issues.push(issue("BOOLEAN_INVALID", "BLOCKING_ERROR", sheet, row, rowKey, "Boolean", "Use YES or NO.")); return defaultValue; }
function enumText(value: unknown, allowed: string[], fallback: string, sheet: string, row: number, rowKey: string, issues: OnboardingIssue[]) { const result = key(value).replace(/[ -]+/g, "_") || fallback; if (!allowed.includes(result)) issues.push(issue("CODE_INVALID", "BLOCKING_ERROR", sheet, row, rowKey, "Code", `Allowed values: ${allowed.join(", ")}.`)); return result; }
function duplicateValues(rows: any[], field: string, sheet: string, code: string, issues: OnboardingIssue[]) { const seen = new Set<string>(); for (const row of rows) { const value = key(row[field]); if (value && seen.has(value)) issues.push(issue(code, "BLOCKING_ERROR", sheet, row.rowNumber, row.rowKey, field, "The value is duplicated in this workbook.")); seen.add(value); } }
function stableHash(value: unknown) { return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex"); }
function canonical(value: unknown): unknown { if (value instanceof Date) return value.toISOString(); if (Array.isArray(value)) return value.map(canonical); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])); return value; }
function targetVersion(row: any) { return [row.id, row.updatedAt?.toISOString?.() ?? row.updatedAt]; }
function hashRecord(row: any) { return stableHash(Object.fromEntries(Object.entries(row).filter(([k]) => !["passwordHash"].includes(k)))); }
function key(value: unknown) { return text(value).toUpperCase(); }
function digits(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function maskPhone(value: string) { return value.length > 4 ? `${"*".repeat(value.length - 4)}${value.slice(-4)}` : "****"; }
function sameDate(left: Date | string | null | undefined, right: Date | string | null | undefined) { if (!left || !right) return false; return new Date(left).toISOString().slice(0, 10) === new Date(right).toISOString().slice(0, 10); }
function unique(values: string[]) { return [...new Set(values.filter(Boolean))].sort(); }
function titleStatus(value: string) { return value === "ACTIVE" ? "Active" : "Inactive"; }
function bounded(value: unknown, label: string, min: number, max: number) { const result = text(value); if (result.length < min || result.length > max) throw new OnboardingError(`${label} must contain ${min} to ${max} characters.`); return result; }
function opaqueKey(value: unknown) { const result = text(value); if (!/^[A-Za-z0-9_-]{16,100}$/.test(result)) throw new OnboardingError("A valid idempotency key is required."); return result; }
function formulaSafe(value: string) { return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value; }
