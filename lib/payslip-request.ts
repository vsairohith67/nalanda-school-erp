import { createHash, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { requireCriticalReauthentication } from "@/lib/iam/security";
import { decryptPayslipSecret, encryptPayslipSecret, generateDocumentPassword, generateOwnerPassword, generateVerificationReference, signPayslipDownload } from "@/lib/payslip-request-crypto";
import { PdfProtectionAdapter, PayslipPdfError, validatePayslipPdf } from "@/lib/payslip-request-pdf";
import { publishPayslipRequestNotification } from "@/lib/payslip-request-notifications";
import { readEncryptedPayslipSource, readProtectedPayslipDerivative, rollbackPayslipStoredFiles, storeEncryptedPayslipSource, storeProtectedPayslipDerivative } from "@/lib/payslip-request-storage";

export const PAYSLIP_REQUEST_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "PREPARATION_IN_PROGRESS", "READY_TO_ISSUE", "PARTIALLY_ISSUED", "ISSUED", "REJECTED", "CANCELLED", "SUPERSEDED", "EXPIRED"] as const;
export const PAYSLIP_REQUEST_PURPOSES = ["BANK_OR_LOAN", "VISA_OR_TRAVEL", "INCOME_PROOF", "TAX_OR_FINANCIAL_RECORD", "EMPLOYMENT_RECORD", "PERSONAL_RECORD", "OTHER"] as const;
export const PAYSLIP_MONTH_STATUSES = ["AVAILABLE", "ALREADY_ISSUED", "UNAVAILABLE", "UNKNOWN", "RECORD_REVIEW_REQUIRED"] as const;
export const PAYSLIP_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie", "X-Robots-Tag": "noindex, nofollow, noarchive" };

type PayslipActor = { user: AuthUser; sessionId: string };
type PayslipDb = PrismaClient | Prisma.TransactionClient;
type Purpose = typeof PAYSLIP_REQUEST_PURPOSES[number];
type MonthStatus = typeof PAYSLIP_MONTH_STATUSES[number];

const OPEN_STATUSES = ["SUBMITTED", "UNDER_REVIEW", "PREPARATION_IN_PROGRESS", "READY_TO_ISSUE", "PARTIALLY_ISSUED"];
const revealAttempts = new Map<string, number[]>();

export class PayslipRequestError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "PAYSLIP_REQUEST_INVALID") { super(message); }
}

export function purposeLabel(value: string) {
  return ({
    BANK_OR_LOAN: "Bank or loan",
    VISA_OR_TRAVEL: "Visa or travel",
    INCOME_PROOF: "Income proof",
    TAX_OR_FINANCIAL_RECORD: "Tax or financial record",
    EMPLOYMENT_RECORD: "Employment record",
    PERSONAL_RECORD: "Personal record",
    OTHER: "Other"
  } as Record<string, string>)[value] ?? "Unavailable";
}

export function requestStatusLabel(value: string) {
  return ({
    SUBMITTED: "Submitted",
    UNDER_REVIEW: "Under review",
    PREPARATION_IN_PROGRESS: "Preparation in progress",
    READY_TO_ISSUE: "Ready to issue",
    PARTIALLY_ISSUED: "Partially issued",
    ISSUED: "Issued",
    REJECTED: "Rejected",
    CANCELLED: "Cancelled",
    SUPERSEDED: "Superseded",
    EXPIRED: "Expired"
  } as Record<string, string>)[value] ?? "Unavailable";
}

export function requestEventLabel(value: string) {
  return ({
    REQUEST_SUBMITTED: "Request submitted",
    CORRECTION_REQUEST_SUBMITTED: "Correction request submitted",
    REQUEST_CANCELLED: "Request cancelled",
    REQUEST_REVIEW_STARTED: "Review started",
    PREPARATION_ASSIGNED: "Preparation assigned",
    PREPARATION_STARTED: "Preparation started",
    REQUEST_REJECTED: "Request rejected",
    REQUEST_EXPIRED: "Request expired",
    REQUEST_SUPERSEDED: "Request superseded by a corrected request",
    DOCUMENT_UPLOADED_AND_PROTECTED: "Protected document uploaded",
    REPLACEMENT_DOCUMENT_UPLOADED: "Replacement document uploaded",
    DOCUMENT_APPROVED_FOR_ISSUE: "Document approved for issue",
    DOCUMENT_ISSUED: "Document issued",
    REPLACEMENT_DOCUMENT_ISSUED: "Replacement document issued"
  } as Record<string, string>)[value] ?? "Workflow event";
}

export async function loadOwnPayslipRequests(client: PrismaClient, actor: PayslipActor) {
  const staff = await exactActiveStaffContext(client, actor);
  const [availableMonths, requests] = await Promise.all([
    eligibleMonths(client, staff),
    client.staffPayslipRequest.findMany({
      where: { staffMemberId: staff.id },
      include: {
        months: { orderBy: { salaryMonth: "asc" } },
        events: { orderBy: { occurredAt: "asc" } },
        documentVersions: { where: { status: "ACTIVE" }, include: { months: { orderBy: { salaryMonth: "asc" } } }, orderBy: { versionNumber: "desc" } },
        accessEvents: { where: { actorUserId: actor.user.id }, orderBy: { occurredAt: "desc" }, take: 100 }
      },
      orderBy: { createdAt: "desc" },
      take: 100
    })
  ]);
  const visibleDocuments = requests.flatMap((request) => request.documentVersions);
  if (visibleDocuments.length) {
    await client.staffPayslipAccessEvent.createMany({ data: visibleDocuments.map((document) => ({
      requestId: document.requestId,
      documentVersionId: document.id,
      staffMemberId: staff.id,
      actorUserId: actor.user.id,
      sessionId: actor.sessionId,
      eventType: "VIEW",
      safeClientJson: JSON.stringify({ surface: "STAFF_PORTAL" })
    })) });
  }
  return {
    linked: true,
    policy: "Password-protected, editing-restricted and tamper-evident",
    availableMonths,
    purposes: PAYSLIP_REQUEST_PURPOSES.map((value) => ({ value, label: purposeLabel(value) })),
    requests: requests.map((request) => ({
      key: request.publicKey,
      number: request.requestNumber,
      purpose: purposeLabel(request.purpose),
      privateExplanation: request.privateExplanation,
      requiredByDate: dateOnly(request.requiredByDate),
      status: request.status,
      statusLabel: requestStatusLabel(request.status),
      version: request.version,
      submittedAt: request.submittedAt.toISOString(),
      mayCancel: ["SUBMITTED", "UNDER_REVIEW"].includes(request.status),
      months: request.months.map((month) => ({ month: month.salaryMonth, label: monthLabel(month.salaryMonth), issueStatus: month.issueStatus })),
      timeline: request.events.map((event) => ({ key: event.publicKey, type: requestEventLabel(event.eventType), status: event.newStatus ? requestStatusLabel(event.newStatus) : null, reason: event.safeReason, at: event.occurredAt.toISOString() })),
      documents: request.documentVersions.map((document) => {
        const authorization = signPayslipDownload(document.publicKey, actor.sessionId);
        return {
          key: document.publicKey,
          version: document.versionNumber,
          status: document.status,
          months: document.months.map((month) => month.salaryMonth),
          issuedAt: document.issuedAt?.toISOString() ?? null,
          verificationReference: document.verificationReference,
          sha256: document.derivativeSha256,
          pageCount: document.pageCount,
          downloadUrl: `/api/my-payslip-requests/documents/${document.publicKey}/download?authorization=${encodeURIComponent(authorization.authorization)}`,
          downloadExpiresAt: authorization.expiresAt
        };
      }),
      accessHistory: request.accessEvents.map((event) => ({ type: accessLabel(event.eventType), at: event.occurredAt.toISOString() }))
    }))
  };
}

export async function submitOwnPayslipRequest(client: PrismaClient, raw: Record<string, unknown>, actor: PayslipActor) {
  const staff = await exactActiveStaffContext(client, actor);
  const submissionKey = uuid(raw.submissionKey, "Submission reference");
  const existing = await client.staffPayslipRequest.findUnique({ where: { submissionKey } });
  if (existing) {
    if (existing.staffMemberId !== staff.id) throw new PayslipRequestError("The submission reference is unavailable.", 409);
    return { request: await publicOwnRequest(client, existing.id), idempotent: true };
  }
  const purpose = oneOf(raw.purpose, PAYSLIP_REQUEST_PURPOSES, "Purpose") as Purpose;
  const explanation = optionalText(raw.explanation, 500);
  if (purpose === "OTHER" && (!explanation || explanation.length < 5)) throw new PayslipRequestError("Provide a brief explanation when Other is selected.");
  const requiredByDate = optionalFutureDate(raw.requiredByDate);
  const requestedMonths = uniqueMonths(raw.months, 12);
  const options = await eligibleMonths(client, staff);
  const allowed = new Map(options.map((month) => [month.month, month]));
  for (const month of requestedMonths) if (!allowed.has(month)) throw new PayslipRequestError("One or more selected months are no longer available.", 409, "MONTH_NOT_AVAILABLE");
  const correctionKey = optionalKey(raw.correctionOfRequestKey);
  const correction = correctionKey ? await client.staffPayslipRequest.findFirst({ where: { publicKey: correctionKey, staffMemberId: staff.id, status: { in: ["REJECTED", "CANCELLED"] } } }) : null;
  if (correctionKey && !correction) throw new PayslipRequestError("The correction request reference is unavailable.");
  const now = new Date();
  const request = await client.$transaction(async (tx) => {
    const created = await tx.staffPayslipRequest.create({ data: {
      submissionKey,
      requestNumber: requestNumber(now),
      staffMemberId: staff.id,
      purpose,
      privateExplanation: explanation,
      requiredByDate,
      status: "SUBMITTED",
      correctionOfRequestId: correction?.id ?? null,
      months: { create: requestedMonths.map((month) => ({ salaryMonth: month, availabilitySnapshot: allowed.get(month)!.status, activeOverlapKey: `${staff.id}:${month}` })) }
    } });
    await createEvent(tx, created.id, actor, { eventType: correction ? "CORRECTION_REQUEST_SUBMITTED" : "REQUEST_SUBMITTED", newStatus: "SUBMITTED", version: 1, requestHash: submissionKey, metadata: { months: requestedMonths } });
    return created;
  }, transactionOptions);
  await publishPayslipRequestNotification(client, { eventKey: `${request.publicKey}:SUBMITTED`, type: "REQUEST_SUBMITTED", actorUserId: actor.user.id, requestPublicKey: request.publicKey });
  return { request: await publicOwnRequest(client, request.id), idempotent: false };
}

export async function cancelOwnPayslipRequest(client: PrismaClient, requestKey: string, raw: Record<string, unknown>, actor: PayslipActor) {
  const staff = await exactActiveStaffContext(client, actor);
  const reason = text(raw.reason, "Cancellation reason", 3, 300);
  const expectedVersion = integer(raw.expectedVersion, "Expected version", 1, 1_000_000);
  const request = await client.staffPayslipRequest.findFirst({ where: { publicKey: safeKey(requestKey), staffMemberId: staff.id } });
  if (!request) throw new PayslipRequestError("The payslip request is unavailable.", 404);
  if (!["SUBMITTED", "UNDER_REVIEW"].includes(request.status)) throw new PayslipRequestError("This request can no longer be cancelled.", 409);
  await client.$transaction(async (tx) => {
    const changed = await tx.staffPayslipRequest.updateMany({ where: { id: request.id, status: request.status, version: expectedVersion }, data: { status: "CANCELLED", cancelledAt: new Date(), version: { increment: 1 } } });
    if (changed.count !== 1) throw new PayslipRequestError("The request changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    await tx.staffPayslipRequestMonth.updateMany({ where: { requestId: request.id }, data: { activeOverlapKey: null } });
    await createEvent(tx, request.id, actor, { eventType: "REQUEST_CANCELLED", previousStatus: request.status, newStatus: "CANCELLED", version: expectedVersion + 1, reason });
  }, transactionOptions);
  await notifyStaff(client, request, actor.user.id, "STATUS_CHANGED", "CANCELLED");
  return { key: request.publicKey, status: "CANCELLED", statusLabel: requestStatusLabel("CANCELLED"), version: expectedVersion + 1 };
}

export async function loadPayslipRequestQueue(client: PrismaClient, options: { includeAudit: boolean }) {
  const [requests, staff, preparerUsers] = await Promise.all([
    client.staffPayslipRequest.findMany({
      include: {
        staffMember: { select: { iamPublicKey: true, fullName: true, displayName: true, designation: true, status: true, userId: true } },
        months: { orderBy: { salaryMonth: "asc" } },
        events: options.includeAudit ? { orderBy: { occurredAt: "asc" } } : false,
        documentVersions: { include: { months: { orderBy: { salaryMonth: "asc" } }, accessEvents: options.includeAudit ? { orderBy: { occurredAt: "desc" }, take: 100 } : false }, orderBy: { versionNumber: "desc" } }
      },
      orderBy: [{ status: "asc" }, { requiredByDate: "asc" }, { createdAt: "asc" }],
      take: 500
    }),
    client.staffMember.findMany({ where: { status: { in: ["ACTIVE", "INACTIVE"] } }, select: { iamPublicKey: true, fullName: true, displayName: true, designation: true, status: true, dateOfJoining: true }, orderBy: { fullName: "asc" }, take: 500 }),
    client.user.findMany({ where: { isActive: true, lifecycleStatus: "ACTIVE", iamPublicKey: { not: null }, iamRoleAssignments: { some: { role: { in: ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"] }, status: "ACTIVE" } } }, select: { id: true, iamPublicKey: true, name: true, designation: true, iamRoleAssignments: { where: { role: { in: ["SUPER_ADMIN", "DIRECTOR", "ACCOUNTANT"] }, status: "ACTIVE" }, select: { id: true, role: true } } }, orderBy: { name: "asc" }, take: 100 })
  ]);
  const preparers = (await Promise.all(preparerUsers.map(async (row) => {
    for (const assignment of row.iamRoleAssignments) {
      const decision = await evaluateEffectivePermission(client, { userId: row.id, roleAssignmentId: assignment.id, permission: "PREPARE_PAYSLIP_REQUEST" });
      if (decision.allowed) return { key: row.iamPublicKey!, name: row.name, designation: row.designation, role: assignment.role };
    }
    return null;
  }))).filter((row): row is NonNullable<typeof row> => Boolean(row));
  return {
    requests: requests.map((request) => ({
      key: request.publicKey,
      number: request.requestNumber,
      staff: { key: request.staffMember.iamPublicKey, name: request.staffMember.displayName || request.staffMember.fullName, designation: request.staffMember.designation, status: request.staffMember.status },
      purpose: purposeLabel(request.purpose),
      requiredByDate: dateOnly(request.requiredByDate),
      overdue: Boolean(request.requiredByDate && dateOnly(request.requiredByDate)! < indiaDateOnly() && OPEN_STATUSES.includes(request.status)),
      status: request.status,
      statusLabel: requestStatusLabel(request.status),
      version: request.version,
      assigned: Boolean(request.assignedPreparerUserId),
      months: request.months.map((month) => ({ month: month.salaryMonth, label: monthLabel(month.salaryMonth), availability: month.availabilitySnapshot, issueStatus: month.issueStatus })),
      documents: request.documentVersions.map((document) => ({ key: document.publicKey, version: document.versionNumber, status: document.status, months: document.months.map((month) => month.salaryMonth), pageCount: document.pageCount, sourceSha256: document.sourceSha256, derivativeSha256: document.derivativeSha256, verificationReference: document.verificationReference, uploadedByDifferentFromIssuer: Boolean(document.issuedByUserId && document.uploadedByUserId !== document.issuedByUserId), approved: Boolean(document.approvedByUserId), issuedAt: document.issuedAt?.toISOString() ?? null, access: options.includeAudit && document.accessEvents ? document.accessEvents.map((event: any) => ({ type: accessLabel(event.eventType), at: event.occurredAt.toISOString() })) : undefined })),
      timeline: options.includeAudit && request.events ? request.events.map((event: any) => ({ type: requestEventLabel(event.eventType), status: event.newStatus ? requestStatusLabel(event.newStatus) : null, reason: event.safeReason, at: event.occurredAt.toISOString() })) : undefined
    })),
    staff: staff.map((row) => ({ key: row.iamPublicKey, name: row.displayName || row.fullName, designation: row.designation, status: row.status, joiningDate: dateOnly(row.dateOfJoining) })),
    preparers
  };
}

export async function setPayslipMonthAvailability(client: PrismaClient, raw: Record<string, unknown>, actor: PayslipActor) {
  const staffKey = uuid(raw.staffKey, "Staff reference"), month = salaryMonth(raw.month), status = oneOf(raw.status, PAYSLIP_MONTH_STATUSES, "Availability") as MonthStatus;
  const reason = text(raw.reason, "Availability reason", 3, 500);
  if (status === "ALREADY_ISSUED") throw new PayslipRequestError("Already issued is derived from an existing immutable payslip.");
  const staff = await client.staffMember.findUnique({ where: { iamPublicKey: staffKey } });
  if (!staff) throw new PayslipRequestError("The Staff record is unavailable.", 404);
  assertMonthWithinEmployment(month, staff.dateOfJoining, await eligibilityEnd(client, staff.id));
  const existing = await client.staffPayslipMonthAvailability.findUnique({ where: { staffMemberId_salaryMonth: { staffMemberId: staff.id, salaryMonth: month } } });
  const row = await client.$transaction(async (tx) => {
    const saved = existing
      ? await tx.staffPayslipMonthAvailability.update({ where: { id: existing.id }, data: { status, sourceType: "HISTORICAL_RECORD", existingPayslipVersionId: null, authorizedByUserId: actor.user.id, authorizationReason: reason, version: { increment: 1 } } })
      : await tx.staffPayslipMonthAvailability.create({ data: { staffMemberId: staff.id, salaryMonth: month, status, sourceType: "HISTORICAL_RECORD", authorizedByUserId: actor.user.id, authorizationReason: reason } });
    await tx.payrollEvent.create({ data: { entityType: "PAYSLIP_MONTH_AVAILABILITY", entityPublicKey: saved.publicKey, eventType: existing ? "HISTORICAL_MONTH_AVAILABILITY_UPDATED" : "HISTORICAL_MONTH_AVAILABILITY_RECORDED", previousStatus: existing?.status ?? null, newStatus: status, entityVersion: saved.version, actorUserId: actor.user.id, actorRole: actor.user.role, reason, safeSnapshotJson: JSON.stringify({ staffReference: staff.iamPublicKey, salaryMonth: month, sourceType: "HISTORICAL_RECORD" }) } });
    return saved;
  }, transactionOptions);
  return { key: row.publicKey, month, status, version: row.version };
}

export async function transitionPayslipRequest(client: PrismaClient, requestKey: string, raw: Record<string, unknown>, actor: PayslipActor) {
  const action = String(raw.action ?? "").trim().toUpperCase();
  const request = await client.staffPayslipRequest.findUnique({ where: { publicKey: safeKey(requestKey) }, include: { staffMember: { select: { userId: true } } } });
  if (!request) throw new PayslipRequestError("The payslip request is unavailable.", 404);
  const expectedVersion = integer(raw.expectedVersion, "Expected version", 1, 1_000_000);
  let nextStatus: string, eventType: string, reason: string | null = null, assignedPreparerUserId = request.assignedPreparerUserId;
  if (action === "REVIEW" && request.status === "SUBMITTED") { nextStatus = "UNDER_REVIEW"; eventType = "REQUEST_REVIEW_STARTED"; }
  else if (action === "ASSIGN" && ["SUBMITTED", "UNDER_REVIEW"].includes(request.status)) {
    const preparerKey = uuid(raw.preparerKey, "Preparer reference");
    const preparer = await client.user.findFirst({ where: { iamPublicKey: preparerKey, isActive: true, lifecycleStatus: "ACTIVE" }, include: { iamRoleAssignments: { where: { status: "ACTIVE" }, select: { id: true } } } });
    if (!preparer) throw new PayslipRequestError("The selected preparer is unavailable.");
    const decisions = await Promise.all(preparer.iamRoleAssignments.map((assignment) => evaluateEffectivePermission(client, { userId: preparer.id, roleAssignmentId: assignment.id, permission: "PREPARE_PAYSLIP_REQUEST" })));
    if (!decisions.some((decision) => decision.allowed)) throw new PayslipRequestError("The selected user is not explicitly authorised to prepare payslip requests.", 403, "PREPARER_PERMISSION_REQUIRED");
    assignedPreparerUserId = preparer.id; nextStatus = "PREPARATION_IN_PROGRESS"; eventType = "PREPARATION_ASSIGNED";
  } else if (action === "PREPARE" && ["SUBMITTED", "UNDER_REVIEW"].includes(request.status)) { nextStatus = "PREPARATION_IN_PROGRESS"; eventType = "PREPARATION_STARTED"; assignedPreparerUserId = actor.user.id; }
  else if (action === "REJECT" && ["SUBMITTED", "UNDER_REVIEW", "PREPARATION_IN_PROGRESS", "READY_TO_ISSUE"].includes(request.status)) { nextStatus = "REJECTED"; eventType = "REQUEST_REJECTED"; reason = text(raw.reason, "Rejection reason", 3, 500); }
  else if (action === "EXPIRE" && OPEN_STATUSES.includes(request.status)) { nextStatus = "EXPIRED"; eventType = "REQUEST_EXPIRED"; reason = text(raw.reason, "Expiry reason", 3, 500); }
  else throw new PayslipRequestError("That request transition is not allowed.", 409, "INVALID_TRANSITION");
  await client.$transaction(async (tx) => {
    const changed = await tx.staffPayslipRequest.updateMany({ where: { id: request.id, status: request.status, version: expectedVersion }, data: { status: nextStatus, assignedPreparerUserId, preparationStartedAt: nextStatus === "PREPARATION_IN_PROGRESS" ? new Date() : request.preparationStartedAt, rejectedAt: nextStatus === "REJECTED" ? new Date() : request.rejectedAt, expiredAt: nextStatus === "EXPIRED" ? new Date() : request.expiredAt, version: { increment: 1 } } });
    if (changed.count !== 1) throw new PayslipRequestError("The request changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    if (["REJECTED", "EXPIRED"].includes(nextStatus)) await tx.staffPayslipRequestMonth.updateMany({ where: { requestId: request.id }, data: { activeOverlapKey: null } });
    await createEvent(tx, request.id, actor, { eventType, previousStatus: request.status, newStatus: nextStatus, version: expectedVersion + 1, reason, metadata: action === "ASSIGN" ? { assigned: true } : undefined });
  }, transactionOptions);
  if (action === "ASSIGN" && assignedPreparerUserId) await publishPayslipRequestNotification(client, { eventKey: `${request.publicKey}:ASSIGNED:${assignedPreparerUserId}`, type: "REQUEST_SUBMITTED", actorUserId: actor.user.id, requestPublicKey: request.publicKey, assignedPreparerUserId, assignedPreparerOnly: true });
  await notifyStaff(client, request, actor.user.id, nextStatus === "REJECTED" ? "REQUEST_REJECTED" : "STATUS_CHANGED", eventType);
  return { key: request.publicKey, status: nextStatus, statusLabel: requestStatusLabel(nextStatus), version: expectedVersion + 1 };
}

export async function uploadPayslipDocument(client: PrismaClient, requestKey: string, file: File, raw: Record<string, unknown>, actor: PayslipActor, replacement: boolean) {
  const request = await client.staffPayslipRequest.findUnique({ where: { publicKey: safeKey(requestKey) }, include: { months: true, documentVersions: { include: { months: true } } } });
  if (!request || !["PREPARATION_IN_PROGRESS", "READY_TO_ISSUE", "PARTIALLY_ISSUED", "ISSUED"].includes(request.status)) throw new PayslipRequestError("The payslip request is not ready for an upload.", 409);
  const monthValues = uniqueMonths(raw.months, 12);
  const requestMonths = new Map(request.months.map((month) => [month.salaryMonth, month]));
  if (monthValues.some((month) => !requestMonths.has(month))) throw new PayslipRequestError("The document includes a month outside this request.");
  const supersedesKey = replacement ? safeKey(String(raw.supersedesDocumentKey ?? "")) : null;
  const replacementReason = replacement ? text(raw.replacementReason, "Replacement reason", 3, 500) : null;
  const supersedes = supersedesKey ? request.documentVersions.find((document) => document.publicKey === supersedesKey && document.status === "ACTIVE") : null;
  if (replacement && !supersedes) throw new PayslipRequestError("The active document to replace is unavailable.", 409);
  if (!replacement && request.documentVersions.some((document) => document.status === "ACTIVE" && document.months.some((linked) => monthValues.includes(linked.salaryMonth)))) {
    throw new PayslipRequestError("Use the governed replacement workflow for an already issued month.", 409);
  }
  const validated = await validatePayslipPdf(file);
  const documentPublicKey = randomUUID();
  const openingPassword = generateDocumentPassword(), ownerPassword = generateOwnerPassword();
  const derivative = await new PdfProtectionAdapter().protect(validated, openingPassword, ownerPassword);
  const passwordEnvelope = encryptOpeningPassword(openingPassword, documentPublicKey);
  const storedKeys: string[] = [];
  try {
    const source = await storeEncryptedPayslipSource(validated.bytes, documentPublicKey); storedKeys.push(source.storageKey);
    const derivativeStorageKey = await storeProtectedPayslipDerivative(derivative.bytes); storedKeys.push(derivativeStorageKey);
    const document = await client.$transaction(async (tx) => {
      const latest = await tx.staffPayslipDocumentVersion.findFirst({ where: { requestId: request.id }, orderBy: { versionNumber: "desc" } });
      const created = await tx.staffPayslipDocumentVersion.create({ data: {
        publicKey: documentPublicKey,
        requestId: request.id,
        versionNumber: (latest?.versionNumber ?? 0) + 1,
        status: "READY_TO_ISSUE",
        verificationReference: generateVerificationReference(),
        sourceStorageKey: source.storageKey,
        sourceKeyVersion: source.envelope.keyVersion,
        sourceNonce: source.envelope.nonce,
        sourceAuthTag: source.envelope.authTag,
        sourceSha256: validated.sha256,
        sourceByteSize: validated.byteSize,
        derivativeStorageKey,
        derivativeSha256: derivative.sha256,
        derivativeByteSize: derivative.byteSize,
        pageCount: derivative.pageCount,
        passwordKeyVersion: passwordEnvelope.keyVersion,
        passwordNonce: passwordEnvelope.nonce,
        passwordCiphertext: passwordEnvelope.ciphertext,
        passwordAuthTag: passwordEnvelope.authTag,
        uploadedByUserId: actor.user.id,
        replacementReason,
        supersedesVersionId: supersedes?.id ?? null,
        months: { create: monthValues.map((month) => ({ requestMonthId: requestMonths.get(month)!.id, salaryMonth: month })) }
      }, include: { months: true } });
      const requestChanged = await tx.staffPayslipRequest.updateMany({ where: { id: request.id, version: integer(raw.expectedVersion, "Expected version", 1, 1_000_000) }, data: { status: "READY_TO_ISSUE", readyToIssueAt: new Date(), version: { increment: 1 } } });
      if (requestChanged.count !== 1) throw new PayslipRequestError("The request changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
      await createEvent(tx, request.id, actor, { eventType: replacement ? "REPLACEMENT_DOCUMENT_UPLOADED" : "DOCUMENT_UPLOADED_AND_PROTECTED", previousStatus: request.status, newStatus: "READY_TO_ISSUE", version: request.version + 1, reason: replacementReason, metadata: { documentReference: created.publicKey, months: monthValues, pageCount: created.pageCount } });
      return created;
    }, transactionOptions);
    await notifyStaff(client, request, actor.user.id, "STATUS_CHANGED", "READY_TO_ISSUE");
    return { key: document.publicKey, version: document.versionNumber, status: document.status, months: document.months.map((month) => month.salaryMonth), sourceSha256: document.sourceSha256, derivativeSha256: document.derivativeSha256, pageCount: document.pageCount, protection: "Password-protected, editing-restricted and tamper-evident" };
  } catch (error) {
    await rollbackPayslipStoredFiles(storedKeys);
    throw error;
  }
}

export async function approvePayslipDocument(client: PrismaClient, requestKey: string, raw: Record<string, unknown>, actor: PayslipActor) {
  const documentKey = safeKey(String(raw.documentKey ?? ""));
  const document = await client.staffPayslipDocumentVersion.findFirst({ where: { publicKey: documentKey, request: { publicKey: safeKey(requestKey) }, status: "READY_TO_ISSUE" }, include: { request: { select: { version: true } } } });
  if (!document) throw new PayslipRequestError("The document is unavailable for approval.", 404);
  const requestVersion = integer(raw.requestVersion, "Request version", 1, 1_000_000);
  if (document.request.version !== requestVersion) throw new PayslipRequestError("The request changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
  if (document.uploadedByUserId === actor.user.id && raw.confirmIndependentReview !== true) throw new PayslipRequestError("An uploader must explicitly confirm independent final review before approval.");
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const changed = await client.staffPayslipDocumentVersion.updateMany({ where: { id: document.id, status: "READY_TO_ISSUE", approvedByUserId: null }, data: { approvedByUserId: actor.user.id } });
  if (changed.count !== 1) throw new PayslipRequestError("The document changed; refresh and try again.", 409);
  await createEvent(client, document.requestId, actor, { eventType: "DOCUMENT_APPROVED_FOR_ISSUE", version: requestVersion, metadata: { documentReference: document.publicKey } });
  return { key: document.publicKey, approved: true };
}

export async function issuePayslipDocument(client: PrismaClient, requestKey: string, raw: Record<string, unknown>, actor: PayslipActor) {
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const documentKey = safeKey(String(raw.documentKey ?? ""));
  const request = await client.staffPayslipRequest.findUnique({ where: { publicKey: safeKey(requestKey) }, include: { months: true, staffMember: { select: { userId: true } }, documentVersions: { include: { months: true } } } });
  if (!request) throw new PayslipRequestError("The payslip request is unavailable.", 404);
  const document = request.documentVersions.find((candidate) => candidate.publicKey === documentKey && candidate.status === "READY_TO_ISSUE");
  if (!document || !document.approvedByUserId) throw new PayslipRequestError("Approve the protected document before final issue.", 409);
  const expectedVersion = integer(raw.expectedVersion, "Expected version", 1, 1_000_000), now = new Date();
  let nextStatus = request.status, notification: "DOCUMENT_ISSUED" | "DOCUMENT_REPLACED" = document.supersedesVersionId ? "DOCUMENT_REPLACED" : "DOCUMENT_ISSUED";
  await client.$transaction(async (tx) => {
    if (document.supersedesVersionId) {
      const replaced = await tx.staffPayslipDocumentVersion.updateMany({ where: { id: document.supersedesVersionId, status: "ACTIVE" }, data: { status: "REPLACED" } });
      if (replaced.count !== 1) throw new PayslipRequestError("The former document is no longer active.", 409, "REPLACEMENT_CONFLICT");
    }
    const issued = await tx.staffPayslipDocumentVersion.updateMany({ where: { id: document.id, status: "READY_TO_ISSUE", approvedByUserId: { not: null } }, data: { status: "ACTIVE", issuedByUserId: actor.user.id, issuedAt: now } });
    if (issued.count !== 1) throw new PayslipRequestError("The document changed; refresh and try again.", 409, "ISSUE_CONFLICT");
    if (!document.supersedesVersionId) await tx.staffPayslipRequestMonth.updateMany({ where: { id: { in: document.months.map((month) => month.requestMonthId) }, issueStatus: "PENDING" }, data: { issueStatus: "ISSUED" } });
    const pending = await tx.staffPayslipRequestMonth.count({ where: { requestId: request.id, issueStatus: "PENDING" } });
    nextStatus = pending ? "PARTIALLY_ISSUED" : "ISSUED";
    const requestChanged = await tx.staffPayslipRequest.updateMany({ where: { id: request.id, version: expectedVersion }, data: { status: nextStatus, issuedAt: pending ? request.issuedAt : now, version: { increment: 1 } } });
    if (requestChanged.count !== 1) throw new PayslipRequestError("The request changed; refresh and try again.", 409, "EXPECTED_VERSION_CONFLICT");
    if (!pending) await tx.staffPayslipRequestMonth.updateMany({ where: { requestId: request.id }, data: { activeOverlapKey: null } });
    await createEvent(tx, request.id, actor, { eventType: document.supersedesVersionId ? "REPLACEMENT_DOCUMENT_ISSUED" : "DOCUMENT_ISSUED", previousStatus: request.status, newStatus: nextStatus, version: expectedVersion + 1, reason: document.replacementReason, metadata: { documentReference: document.publicKey, months: document.months.map((month) => month.salaryMonth) } });
    if (!pending && request.correctionOfRequestId) {
      const corrected = await tx.staffPayslipRequest.findUnique({ where: { id: request.correctionOfRequestId } });
      if (!corrected || !["REJECTED", "CANCELLED"].includes(corrected.status)) throw new PayslipRequestError("The corrected request is no longer eligible to be superseded.", 409, "CORRECTION_CONFLICT");
      const superseded = await tx.staffPayslipRequest.updateMany({ where: { id: corrected.id, status: corrected.status, version: corrected.version }, data: { status: "SUPERSEDED", supersededAt: now, version: { increment: 1 } } });
      if (superseded.count !== 1) throw new PayslipRequestError("The corrected request changed; refresh and try again.", 409, "CORRECTION_CONFLICT");
      await createEvent(tx, corrected.id, actor, { eventType: "REQUEST_SUPERSEDED", previousStatus: corrected.status, newStatus: "SUPERSEDED", version: corrected.version + 1, metadata: { correctionRequestReference: request.publicKey } });
    }
  }, transactionOptions);
  await publishPayslipRequestNotification(client, { eventKey: `${document.publicKey}:ISSUED`, type: notification, actorUserId: actor.user.id, requestPublicKey: request.publicKey, staffUserId: request.staffMember.userId });
  return { key: document.publicKey, status: "ACTIVE", requestStatus: nextStatus, requestStatusLabel: requestStatusLabel(nextStatus), requestVersion: expectedVersion + 1 };
}

export async function revealOwnPayslipPassword(client: PrismaClient, documentKey: string, raw: Record<string, unknown>, actor: PayslipActor) {
  const staff = await exactActiveStaffContext(client, actor);
  assertRevealRate(actor.user.id, actor.sessionId, documentKey);
  await requireCriticalReauthentication(client, actor, String(raw.reauthPassword ?? ""));
  const document = await client.staffPayslipDocumentVersion.findFirst({ where: { publicKey: safeKey(documentKey), status: "ACTIVE", request: { staffMemberId: staff.id } } });
  if (!document) throw new PayslipRequestError("The active payslip document is unavailable.", 404);
  const password = decryptPayslipSecret({ keyVersion: document.passwordKeyVersion, nonce: document.passwordNonce, ciphertext: document.passwordCiphertext, authTag: document.passwordAuthTag }, document.publicKey, "OPENING_PASSWORD").toString("utf8");
  await client.staffPayslipAccessEvent.create({ data: { requestId: document.requestId, documentVersionId: document.id, staffMemberId: staff.id, actorUserId: actor.user.id, sessionId: actor.sessionId, eventType: "PASSWORD_REVEAL", safeClientJson: JSON.stringify({ surface: "STAFF_REAUTH_DIALOG" }) } });
  return { password, expiresAt: new Date(Date.now() + 60_000).toISOString() };
}

export async function downloadOwnPayslip(client: PrismaClient, documentKey: string, actor: PayslipActor) {
  const staff = await exactActiveStaffContext(client, actor);
  const document = await client.staffPayslipDocumentVersion.findFirst({ where: { publicKey: safeKey(documentKey), status: "ACTIVE", request: { staffMemberId: staff.id } } });
  if (!document) throw new PayslipRequestError("The active payslip document is unavailable.", 404);
  const bytes = await readProtectedPayslipDerivative(document.derivativeStorageKey, document.derivativeSha256);
  await client.staffPayslipAccessEvent.create({ data: { requestId: document.requestId, documentVersionId: document.id, staffMemberId: staff.id, actorUserId: actor.user.id, sessionId: actor.sessionId, eventType: "DOWNLOAD", safeClientJson: JSON.stringify({ surface: "STAFF_PRIVATE_DOWNLOAD" }) } });
  return { bytes, filename: `protected-payslip-${document.versionNumber}.pdf`, sha256: document.derivativeSha256 };
}

export async function previewManagementPayslipSource(client: PrismaClient, documentKey: string, actor: PayslipActor) {
  const document = await client.staffPayslipDocumentVersion.findUnique({ where: { publicKey: safeKey(documentKey) }, include: { request: true } });
  if (!document) throw new PayslipRequestError("The management source is unavailable.", 404);
  const bytes = await readEncryptedPayslipSource(document.sourceStorageKey, document.sourceSha256, document.publicKey, { keyVersion: document.sourceKeyVersion, nonce: document.sourceNonce, authTag: document.sourceAuthTag });
  await client.staffPayslipAccessEvent.create({ data: { requestId: document.requestId, documentVersionId: document.id, staffMemberId: document.request.staffMemberId, actorUserId: actor.user.id, sessionId: actor.sessionId, eventType: "VIEW", safeClientJson: JSON.stringify({ surface: "MANAGEMENT_SOURCE_PREVIEW" }) } });
  return { bytes, sha256: document.sourceSha256 };
}

async function exactActiveStaffContext(client: PayslipDb, actor: PayslipActor) {
  if (actor.user.role !== "TEACHER") throw new PayslipRequestError("Switch to the Staff/Teacher context before accessing payslip requests.", 403, "STAFF_CONTEXT_REQUIRED");
  const [session, staff] = await Promise.all([
    client.authSession.findFirst({ where: { id: actor.sessionId, userId: actor.user.id, revokedAt: null, expiresAt: { gt: new Date() }, activeRoleAssignmentId: actor.user.roleAssignmentId } }),
    client.staffMember.findFirst({ where: { userId: actor.user.id, status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } }, select: { id: true, iamPublicKey: true, dateOfJoining: true, status: true, userId: true } })
  ]);
  if (!session || !staff || !staff.dateOfJoining) throw new PayslipRequestError("An active verified Staff link and joining date are required.", 403, "STAFF_LINK_REQUIRED");
  return staff;
}

async function eligibleMonths(client: PayslipDb, staff: { id: string; dateOfJoining: Date | null }) {
  if (!staff.dateOfJoining) return [];
  const [configured, issued, endDate] = await Promise.all([
    client.staffPayslipMonthAvailability.findMany({ where: { staffMemberId: staff.id }, orderBy: { salaryMonth: "desc" } }),
    client.payslipVersion.findMany({ where: { staffMemberId: staff.id, status: "ISSUED" }, include: { employeePayrollResult: { include: { payrollRun: { include: { period: true } } } } } }),
    eligibilityEnd(client, staff.id)
  ]);
  const issuedMonths = new Set(issued.map((row) => row.employeePayrollResult.payrollRun.period.payrollMonth));
  const latest = latestCompletedSalaryMonth();
  const earliest = monthFromDate(staff.dateOfJoining);
  const endMonth = endDate ? monthFromDate(endDate) : null;
  const options = new Map<string, { month: string; label: string; status: "AVAILABLE" | "ALREADY_ISSUED" }>();
  for (const row of configured) if (["AVAILABLE", "ALREADY_ISSUED"].includes(row.status) && row.salaryMonth >= earliest && row.salaryMonth <= latest && (!endMonth || row.salaryMonth <= endMonth)) {
    options.set(row.salaryMonth, { month: row.salaryMonth, label: monthLabel(row.salaryMonth), status: issuedMonths.has(row.salaryMonth) ? "ALREADY_ISSUED" : "AVAILABLE" });
  }
  for (const month of issuedMonths) if (month >= earliest && month <= latest && (!endMonth || month <= endMonth)) options.set(month, { month, label: monthLabel(month), status: "ALREADY_ISSUED" });
  return [...options.values()].sort((a, b) => b.month.localeCompare(a.month));
}

async function eligibilityEnd(client: PayslipDb, staffMemberId: string) {
  const assignment = await client.staffCompensationAssignment.findFirst({ where: { staffMemberId, payrollEligibleTo: { not: null }, status: { in: ["ENDED", "ACTIVE", "FUTURE"] } }, orderBy: { payrollEligibleTo: "desc" }, select: { payrollEligibleTo: true } });
  return assignment?.payrollEligibleTo ?? null;
}

async function notifyStaff(client: PrismaClient, request: { id: string; publicKey: string; staffMemberId: string }, actorUserId: string, type: "STATUS_CHANGED" | "REQUEST_REJECTED", eventKey: string) {
  const staff = await client.staffMember.findUnique({ where: { id: request.staffMemberId }, select: { userId: true } });
  await publishPayslipRequestNotification(client, { eventKey: `${request.publicKey}:${eventKey}`, type, actorUserId, requestPublicKey: request.publicKey, staffUserId: staff?.userId });
}

async function publicOwnRequest(client: PayslipDb, id: string) {
  const request = await client.staffPayslipRequest.findUnique({ where: { id }, include: { months: { orderBy: { salaryMonth: "asc" } } } });
  if (!request) throw new PayslipRequestError("The payslip request is unavailable.", 404);
  return { key: request.publicKey, number: request.requestNumber, status: request.status, statusLabel: requestStatusLabel(request.status), version: request.version, months: request.months.map((month) => month.salaryMonth) };
}

async function createEvent(client: PayslipDb, requestId: string, actor: PayslipActor, input: { eventType: string; previousStatus?: string | null; newStatus?: string | null; version: number; reason?: string | null; metadata?: Record<string, unknown>; requestHash?: string | null }) {
  return client.staffPayslipRequestEvent.create({ data: { requestId, eventType: input.eventType, actorUserId: actor.user.id, actorRole: actor.user.role, previousStatus: input.previousStatus, newStatus: input.newStatus, entityVersion: input.version, safeReason: input.reason, safeMetadataJson: input.metadata ? JSON.stringify(input.metadata) : null, requestHash: input.requestHash } });
}

function encryptOpeningPassword(password: string, documentPublicKey: string) { return encryptPayslipSecret(password, documentPublicKey, "OPENING_PASSWORD"); }

function assertRevealRate(userId: string, sessionId: string, documentKey: string) {
  const key = createHash("sha256").update(`${userId}|${sessionId}|${documentKey}`).digest("hex");
  const cutoff = Date.now() - 15 * 60 * 1000;
  const attempts = (revealAttempts.get(key) ?? []).filter((time) => time > cutoff);
  if (attempts.length >= 5) throw new PayslipRequestError("Too many password reveal attempts. Try again later.", 429, "REVEAL_RATE_LIMITED");
  attempts.push(Date.now()); revealAttempts.set(key, attempts);
  if (revealAttempts.size > 5_000) for (const [candidate, times] of revealAttempts) if (times.every((time) => time <= cutoff)) revealAttempts.delete(candidate);
}

function assertMonthWithinEmployment(month: string, joining: Date | null, end: Date | null) {
  if (!joining) throw new PayslipRequestError("A verified joining date is required before month availability can be recorded.");
  if (month > latestCompletedSalaryMonth()) throw new PayslipRequestError("Future or incomplete salary months cannot be marked available.");
  if (month < monthFromDate(joining)) throw new PayslipRequestError("The month precedes the verified joining month.");
  if (end && month > monthFromDate(end)) throw new PayslipRequestError("The month follows the approved payroll eligibility end.");
}

function latestCompletedSalaryMonth(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).formatToParts(now);
  let year = Number(parts.find((part) => part.type === "year")?.value), month = Number(parts.find((part) => part.type === "month")?.value) - 1;
  if (month === 0) { year -= 1; month = 12; }
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthFromDate(value: Date) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" }).format(value); }
function monthLabel(value: string) { const [year, month] = value.split("-").map(Number); return new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(Date.UTC(year, month - 1, 15))); }
function salaryMonth(value: unknown) { const result = String(value ?? "").trim(); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(result)) throw new PayslipRequestError("Salary month must use YYYY-MM."); return result; }
function uniqueMonths(value: unknown, maximum: number) { if (!Array.isArray(value) || !value.length || value.length > maximum) throw new PayslipRequestError(`Select 1 to ${maximum} salary months.`); const result = [...new Set(value.map(salaryMonth))]; if (result.length !== value.length) throw new PayslipRequestError("Salary months must be unique."); return result.sort(); }
function requestNumber(now: Date) { return `PSR-${now.toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase()}`; }
function text(value: unknown, label: string, min: number, max: number) { const result = String(value ?? "").trim(); if (result.length < min || result.length > max) throw new PayslipRequestError(`${label} must contain ${min} to ${max} characters.`); return result; }
function optionalText(value: unknown, max: number) { const result = String(value ?? "").trim(); if (!result) return null; if (result.length > max) throw new PayslipRequestError(`Explanation must contain at most ${max} characters.`); return result; }
function optionalFutureDate(value: unknown) { const raw = String(value ?? "").trim(); if (!raw) return null; if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new PayslipRequestError("Required-by date must use YYYY-MM-DD."); const result = new Date(`${raw}T12:00:00.000Z`), today = indiaDateOnly(), maximum = new Date(`${today}T12:00:00.000Z`); maximum.setUTCDate(maximum.getUTCDate() + 180); if (Number.isNaN(result.getTime()) || result.toISOString().slice(0, 10) !== raw || raw < today || raw > maximum.toISOString().slice(0, 10)) throw new PayslipRequestError("Required-by date must be within the next 180 days."); return result; }
function indiaDateOnly(now = new Date()) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
function dateOnly(value: Date | null | undefined) { return value?.toISOString().slice(0, 10) ?? null; }
function safeKey(value: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{8,100}$/.test(result)) throw new PayslipRequestError("The private reference is invalid.", 404); return result; }
function optionalKey(value: unknown) { const result = String(value ?? "").trim(); return result ? safeKey(result) : null; }
function uuid(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new PayslipRequestError(`${label} is invalid.`); return result; }
function integer(value: unknown, label: string, min: number, max: number) { const result = Number(value); if (!Number.isSafeInteger(result) || result < min || result > max) throw new PayslipRequestError(`${label} is invalid.`); return result; }
function oneOf<T extends readonly string[]>(value: unknown, choices: T, label: string) { const result = String(value ?? "").trim(); if (!(choices as readonly string[]).includes(result)) throw new PayslipRequestError(`${label} is invalid.`); return result; }
function accessLabel(value: string) { return value === "PASSWORD_REVEAL" ? "Password revealed" : value === "DOWNLOAD" ? "Downloaded" : "Viewed"; }

const transactionOptions = { maxWait: 5_000, timeout: 20_000 } as const;
