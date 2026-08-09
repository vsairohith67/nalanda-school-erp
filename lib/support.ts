import { createHmac, randomBytes } from "node:crypto";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { listChildContexts } from "@/lib/iam/contexts";
import { publishSupportNotification, type SupportNotificationType } from "@/lib/support-notifications";

export const SUPPORT_SOURCES = ["AUTHENTICATED_PARENT_PORTAL", "AUTHENTICATED_STAFF_PORTAL", "AUTHENTICATED_LEADERSHIP_PORTAL", "LOGIN_SUPPORT", "IN_PERSON", "PHONE_RECORDED_BY_STAFF", "PAPER_FORM_RECORDED_BY_STAFF", "ADMISSIONS_APPLICANT_SUPPORT"] as const;
export const SUPPORT_CATEGORIES = ["TECHNICAL_LOGIN", "ACCOUNT_ACCESS", "FEE_OR_RECEIPT", "ATTENDANCE", "HOMEWORK_OR_CLASSWORK", "EXAM_OR_REPORT_CARD", "ACADEMIC_SUPPORT", "ADMISSION", "DATA_CORRECTION", "FACILITIES", "STAFF_HR", "SAFETY_OR_BULLYING", "COMPLAINT_AGAINST_STAFF", "COMPLAINT_AGAINST_SERVICE", "PRIVACY_OR_DATA", "SUGGESTION", "APPRECIATION", "OTHER"] as const;
export const PUBLIC_SUPPORT_CATEGORIES = ["LOGIN_SUPPORT", "ACCOUNT_ACCESS", "TECHNICAL_LOGIN", "ADMISSION", "OTHER"] as const;
export const SUPPORT_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export const SUPPORT_CONFIDENTIALITY = ["STANDARD", "RESTRICTED", "SAFEGUARDING", "LEADERSHIP_ONLY"] as const;
export const SUPPORT_STATUSES = ["DRAFT", "SUBMITTED", "ACKNOWLEDGED", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "WAITING_FOR_INTERNAL_ACTION", "ESCALATED", "RESOLVED", "CLOSED", "REOPENED", "REJECTED_AS_INVALID", "CANCELLED", "ARCHIVED"] as const;
export const SUPPORT_RESOLUTION_CATEGORIES = ["INFORMATION_PROVIDED", "TECHNICAL_FIX_COMPLETED", "RECORD_CORRECTED", "FINANCE_ACTION_COMPLETED", "ACADEMIC_ACTION_COMPLETED", "POLICY_EXPLAINED", "REQUEST_NOT_VALID", "DUPLICATE", "REFERRED_FOR_FURTHER_ACTION", "OTHER"] as const;
export const SUPPORT_PRIVACY_NOTICE_VERSION = "SUPPORT-PRIVACY-DRAFT-V1-DRAFT_PENDING_APPROVAL";

type SupportActor = { id: string; name: string; role: string; roleAssignmentId?: string | null; permissions: ReadonlySet<string> };
type StoredFile = { storageKey: string; safeDisplayName: string; mediaType: string; extension: string; byteSize: number; sha256: string; width: number | null; height: number | null; pageCount: number | null };

export class SupportError extends Error {
  constructor(message: string, public readonly status = 400, public readonly code = "SUPPORT_REQUEST_INVALID") { super(message); }
}

export function validatePublicSupportInput(value: unknown) {
  const row = object(value);
  const requesterType = oneOf(row.requesterType, ["PARENT", "STAFF", "APPLICANT", "OTHER"], "Requester type");
  const contactChannel = oneOf(row.contactChannel, ["MOBILE", "EMAIL"], "Preferred contact channel");
  const category = oneOf(row.category, PUBLIC_SUPPORT_CATEGORIES, "Category");
  const message = text(row.message, "Message", 20, 2000);
  if (category === "OTHER" && message.length < 40) throw new SupportError("Other requests need a short explanation of at least 40 characters.");
  const contactValue = contactChannel === "EMAIL" ? email(row.contactValue) : mobile(row.contactValue);
  return {
    requesterName: text(row.requesterName, "Requester name", 2, 100), requesterType,
    requesterIdentifier: optionalText(row.requesterIdentifier, "Optional reference", 80), contactChannel, contactValue,
    category, message, consent: row.consent === true, honeypot: optionalText(row.honeypot, "Website", 200),
    submissionKey: key(row.submissionKey, "Submission key")
  };
}

export function validateAuthenticatedSupportInput(value: unknown) {
  const row = object(value);
  const category = oneOf(row.category, SUPPORT_CATEGORIES, "Category");
  const description = text(row.description, "Description", 20, 6000);
  if (category === "OTHER" && description.length < 40) throw new SupportError("Other requests need a short explanation of at least 40 characters.");
  return {
    category,
    subject: text(row.subject, "Subject", 3, 160),
    description,
    childHandles: Array.isArray(row.childHandles) ? [...new Set(row.childHandles.map((item) => key(item, "Child context")))].slice(0, 5) : [],
    contextVersion: integer(row.contextVersion, "Context version", 0, Number.MAX_SAFE_INTEGER, true),
    linkedReceiptReference: optionalText(row.linkedReceiptReference, "Receipt reference", 80),
    submissionKey: key(row.submissionKey, "Submission key"),
    consent: row.consent === true
  };
}

export function validateManualSupportInput(value: unknown) {
  const row = object(value);
  return {
    source: oneOf(row.source, ["IN_PERSON", "PHONE_RECORDED_BY_STAFF", "PAPER_FORM_RECORDED_BY_STAFF"], "Original source"),
    requesterName: text(row.requesterName, "Requester name", 2, 100),
    requesterType: oneOf(row.requesterType, ["PARENT", "STAFF", "APPLICANT", "OTHER"], "Requester type"),
    requesterIdentifier: optionalText(row.requesterIdentifier, "Supplied identifier", 80),
    contactChannel: row.contactChannel ? oneOf(row.contactChannel, ["MOBILE", "EMAIL"], "Contact channel") : null,
    contactValue: optionalText(row.contactValue, "Contact", 254),
    category: oneOf(row.category, SUPPORT_CATEGORIES, "Category"),
    subject: text(row.subject, "Subject", 3, 160), statement: text(row.statement, "Original statement", 20, 8000),
    identityVerified: row.identityVerified === true,
    verifiedStudentId: optionalText(row.verifiedStudentId, "Verified Student", 100),
    signedPaperReference: optionalText(row.signedPaperReference, "Signed-paper reference", 120),
    submissionKey: key(row.submissionKey, "Submission key"), consentRecorded: row.consentRecorded === true,
    complainedAboutUserKey: optionalText(row.complainedAboutUserKey, "Complained-about Staff", 100)
  };
}

export async function createPublicSupportRequest(client: any, input: ReturnType<typeof validatePublicSupportInput>, sourceEvidence: string, attachment?: StoredFile | null, now = new Date()) {
  const sourceHash = privateHash(`source|${sourceEvidence}`), identifierHash = input.requesterIdentifier ? privateHash(`identifier|${input.requesterIdentifier.toLowerCase()}`) : privateHash(`contact|${input.contactValue.toLowerCase()}`);
  const since = new Date(now.getTime() - 60 * 60 * 1000);
  const [sourceAttempts, identifierAttempts] = await Promise.all([
    client.supportAccessEvent.count({ where: { sourceHash, occurredAt: { gte: since } } }),
    client.supportAccessEvent.count({ where: { identifierHash, occurredAt: { gte: since } } })
  ]);
  const neutralized = Boolean(input.honeypot) || !input.consent || sourceAttempts >= 6 || identifierAttempts >= 4;
  if (neutralized) {
    await client.supportAccessEvent.create({ data: { sourceHash, identifierHash, eventType: "PUBLIC_INTAKE", outcome: "NEUTRALISED", safeMetadataJson: JSON.stringify({ reason: input.honeypot ? "BOT_CONTROL" : !input.consent ? "CONSENT_MISSING" : "RATE_LIMIT" }), occurredAt: now } });
    return { accepted: true, reference: opaqueNeutralReference(input.submissionKey), neutralized: true };
  }
  const policyCode = input.category === "LOGIN_SUPPORT" ? "TECHNICAL_LOGIN" : input.category;
  const policy = await activePolicy(client, policyCode, now);
  const duplicateFingerprint = privateHash([input.requesterName, input.requesterType, input.requesterIdentifier ?? "", input.contactValue, policyCode, input.message].map(normalizeFingerprint).join("|"));
  const duplicate = await client.supportRequest.findFirst({ where: { duplicateFingerprint, createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) } }, select: { reference: true } });
  if (duplicate) {
    await client.supportAccessEvent.create({ data: { sourceHash, identifierHash, eventType: "PUBLIC_INTAKE", outcome: "DUPLICATE_NEUTRALISED", safeMetadataJson: JSON.stringify({ duplicate: true }), occurredAt: now } });
    return { accepted: true, reference: opaqueNeutralReference(input.submissionKey), neutralized: true };
  }
  const actorUserId = await notificationActor(client);
  const request = await client.$transaction(async (tx: any) => {
    const created = await createRequest(tx, {
      source: "LOGIN_SUPPORT", requesterName: input.requesterName, requesterType: input.requesterType,
      requesterIdentifier: input.requesterIdentifier, requesterContactChannel: input.contactChannel, requesterContactValue: input.contactValue,
      identityVerified: false, categoryPolicy: policy, subject: supportCategoryLabel(policyCode), originalStatement: input.message,
      privacyNoticeVersion: SUPPORT_PRIVACY_NOTICE_VERSION, consentRecordedAt: now, submissionKey: input.submissionKey,
      duplicateFingerprint, priority: policy.defaultPriority, confidentiality: policy.defaultConfidentiality, now
    });
    await tx.supportRequestParticipant.create({ data: { requestId: created.id, participantType: "REQUESTER", displayLabel: "Unverified public requester" } });
    if (attachment) await createAttachmentRow(tx, created.id, null, attachment, "REQUESTER_VISIBLE", "PUBLIC", null, now);
    await tx.supportAccessEvent.create({ data: { requestId: created.id, sourceHash, identifierHash, eventType: "PUBLIC_INTAKE", outcome: "ACCEPTED", safeMetadataJson: JSON.stringify({ attachment: Boolean(attachment) }), occurredAt: now } });
    if (actorUserId) await publishSupportNotification(tx, { eventKey: `${created.publicKey}:SUBMITTED`, type: "REQUEST_SUBMITTED", actorUserId, requestPublicKey: created.publicKey, queueRoles: parseStringArray(policy.permittedAssigneeRolesJson), confidentiality: created.confidentiality, priority: created.priority, now });
    return created;
  });
  return { accepted: true, reference: request.reference, neutralized: false, publicKey: request.publicKey };
}

export async function createAuthenticatedSupportRequest(client: any, actor: SupportActor, context: { sessionId: string; academicYear: string }, input: ReturnType<typeof validateAuthenticatedSupportInput>, now = new Date()) {
  if (!actor.permissions.has("CREATE_OWN_SUPPORT")) throw new SupportError("Support request creation is not authorised.", 403);
  const existing = await client.supportRequest.findUnique({ where: { submissionKey: input.submissionKey } });
  if (existing) { if (existing.requesterUserId === actor.id && existing.requesterRole === actor.role) return existing; throw new SupportError("This submission key is unavailable.", 409); }
  if (!input.consent) throw new SupportError("Acknowledge the privacy notice before submitting.");
  if (salaryDocumentRequest(input.category, `${input.subject} ${input.description}`)) throw new SupportError("Payslip and salary-document requests must use the dedicated Payslip Requests module.", 409, "PAYSLIP_REQUEST_BOUNDARY");
  const policy = await activePolicy(client, input.category, now);
  const parent = actor.role === "PARENT";
  if (parent && !actor.permissions.has("VIEW_OWN_SUPPORT")) throw new SupportError("Parent support is unavailable.", 403);
  const staff = parent ? null : await client.staffMember.findFirst({ where: { userId: actor.id, status: "ACTIVE", user: { isActive: true, lifecycleStatus: "ACTIVE" } }, select: { id: true, fullName: true, displayName: true } });
  if (!parent && !staff) throw new SupportError("An active linked Staff profile is required to create a Staff support request.", 403);
  const linkedChildren = parent ? await resolveParentSupportChildren(client, actor, context, input.childHandles, input.contextVersion) : [];
  if (policy.linkedChildRequired && !linkedChildren.length) throw new SupportError(parent ? "Select an authorised linked child for this category." : "Switch to the Parent context to create a linked-child request.", 409);
  if (!parent && linkedChildren.length) throw new SupportError("Staff context cannot attach a Parent child context.", 403);
  if (input.linkedReceiptReference) {
    if (!parent || input.category !== "FEE_OR_RECEIPT" || !await receiptBelongsToChildren(client, input.linkedReceiptReference, linkedChildren.map((row) => row.studentId))) throw new SupportError("The selected receipt is unavailable for this Parent and linked-child context.", 404);
  }
  const requesterGuardianId = parent ? (await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true } }))?.guardianId ?? null : null;
  const created = await client.$transaction(async (tx: any) => {
    const request = await createRequest(tx, {
      source: parent ? "AUTHENTICATED_PARENT_PORTAL" : ["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"].includes(actor.role) ? "AUTHENTICATED_LEADERSHIP_PORTAL" : "AUTHENTICATED_STAFF_PORTAL",
      requesterUserId: actor.id, requesterRole: actor.role, requesterStaffMemberId: staff?.id ?? null, requesterGuardianId,
      requesterName: parent ? actor.name : staff?.displayName || staff?.fullName || actor.name, requesterType: parent ? "PARENT" : "STAFF",
      identityVerified: true, categoryPolicy: policy, subject: input.subject, originalStatement: input.description,
      linkedReceiptReference: input.linkedReceiptReference, privacyNoticeVersion: SUPPORT_PRIVACY_NOTICE_VERSION,
      consentRecordedAt: now, submissionKey: input.submissionKey, priority: policy.defaultPriority, confidentiality: policy.defaultConfidentiality, now
    });
    await tx.supportRequestParticipant.create({ data: { requestId: request.id, participantType: "REQUESTER", userId: actor.id, guardianId: requesterGuardianId, staffMemberId: staff?.id ?? null, displayLabel: parent ? "Parent requester" : "Staff requester", addedByUserId: actor.id } });
    for (const child of linkedChildren) await tx.supportRequestLinkedChild.create({ data: { requestId: request.id, studentId: child.studentId, admissionReferenceMasked: maskReference(child.admissionNo), childDisplaySnapshot: child.studentName, classSnapshot: [child.className, child.section].filter(Boolean).join("-"), guardianLinkVerified: true, guardianLinkVerifiedAt: now, guardianLinkVerifiedByUserId: actor.id } });
    await publishSupportNotification(tx, { eventKey: `${request.publicKey}:SUBMITTED`, type: "REQUEST_SUBMITTED", actorUserId: actor.id, requestPublicKey: request.publicKey, requesterUserId: actor.id, queueRoles: parseStringArray(policy.permittedAssigneeRolesJson), confidentiality: request.confidentiality, priority: request.priority, now });
    return request;
  });
  return created;
}

export async function createManualSupportRequest(client: any, actor: SupportActor, input: ReturnType<typeof validateManualSupportInput>, now = new Date()) {
  if (!actor.permissions.has("RECORD_IN_PERSON_SUPPORT")) throw new SupportError("In-person complaint recording is not authorised.", 403);
  const existing = await client.supportRequest.findUnique({ where: { submissionKey: input.submissionKey } });
  if (existing) { if (existing.recordedByUserId === actor.id) return existing; throw new SupportError("This submission key is unavailable.", 409); }
  if (salaryDocumentRequest(input.category, `${input.subject} ${input.statement}`)) throw new SupportError("Payslip and salary-document requests must use the dedicated Payslip Requests module.", 409, "PAYSLIP_REQUEST_BOUNDARY");
  const policy = await activePolicy(client, input.category, now);
  const complainedAbout = input.complainedAboutUserKey ? await client.user.findUnique({ where: { iamPublicKey: input.complainedAboutUserKey }, select: { id: true } }) : null;
  let verifiedChild: any = null;
  if (input.identityVerified && input.verifiedStudentId) verifiedChild = await client.student.findFirst({ where: { id: input.verifiedStudentId, deletedAt: null }, select: { id: true, admissionNo: true, studentName: true, className: true, section: true } });
  if (input.identityVerified && input.verifiedStudentId && !verifiedChild) throw new SupportError("The verified Student context is unavailable.", 404);
  const request = await client.$transaction(async (tx: any) => {
    const created = await createRequest(tx, {
      source: input.source, requesterName: input.requesterName, requesterType: input.requesterType,
      requesterIdentifier: input.requesterIdentifier, requesterContactChannel: input.contactChannel, requesterContactValue: input.contactValue,
      identityVerified: input.identityVerified && Boolean(verifiedChild), recordedByUserId: actor.id, signedPaperReference: input.signedPaperReference,
      categoryPolicy: policy, subject: input.subject, originalStatement: input.statement, complainedAboutUserId: complainedAbout?.id ?? null,
      privacyNoticeVersion: SUPPORT_PRIVACY_NOTICE_VERSION, consentRecordedAt: input.consentRecorded ? now : null,
      submissionKey: input.submissionKey, priority: policy.defaultPriority, confidentiality: policy.defaultConfidentiality, now
    });
    await tx.supportRequestParticipant.create({ data: { requestId: created.id, participantType: "REQUESTER", displayLabel: "Manually recorded requester", addedByUserId: actor.id } });
    if (verifiedChild) await tx.supportRequestLinkedChild.create({ data: { requestId: created.id, studentId: verifiedChild.id, admissionReferenceMasked: maskReference(verifiedChild.admissionNo), childDisplaySnapshot: verifiedChild.studentName, classSnapshot: [verifiedChild.className, verifiedChild.section].filter(Boolean).join("-"), guardianLinkVerified: true, guardianLinkVerifiedAt: now, guardianLinkVerifiedByUserId: actor.id } });
    await publishSupportNotification(tx, { eventKey: `${created.publicKey}:SUBMITTED`, type: "REQUEST_SUBMITTED", actorUserId: actor.id, requestPublicKey: created.publicKey, queueRoles: parseStringArray(policy.permittedAssigneeRolesJson), confidentiality: created.confidentiality, priority: created.priority, now });
    return created;
  });
  return request;
}

export async function listOwnSupportRequests(client: any, actor: SupportActor) {
  if (!actor.permissions.has("VIEW_OWN_SUPPORT")) throw new SupportError("Own support history is not authorised.", 403);
  const rows = await client.supportRequest.findMany({ where: { requesterUserId: actor.id, requesterRole: actor.role }, include: ownInclude, orderBy: { createdAt: "desc" }, take: 200 });
  const filtered = [];
  for (const row of rows) if (await requesterObjectScopeValid(client, actor, row)) filtered.push(serializeOwn(row));
  return filtered;
}

export async function listManagedSupportRequests(client: any, actor: SupportActor) {
  if (!actor.permissions.has("VIEW_SUPPORT_REQUESTS")) throw new SupportError("Support queue access is not authorised.", 403);
  const rows = await client.supportRequest.findMany({ include: managementInclude, orderBy: [{ priority: "desc" }, { createdAt: "asc" }], take: 500 });
  return rows.filter((row: any) => canManageRow(actor, row)).map((row: any) => serializeManaged(actor, row));
}

export async function listSupportAssignees(client: any, actor: SupportActor, requestKey: string, now = new Date()) {
  if (!actor.permissions.has("ASSIGN_SUPPORT_REQUESTS")) throw new SupportError("Support assignment is not authorised.", 403);
  const request = await scopedManagementRow(client, actor, requestKey), roles = parseStringArray(request.categoryPolicy.permittedAssigneeRolesJson);
  const users = await client.user.findMany({ where: { isActive: true, lifecycleStatus: "ACTIVE", id: { not: request.complainedAboutUserId ?? undefined }, iamRoleAssignments: { some: { role: { in: roles }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } }, include: { iamRoleAssignments: { where: { role: { in: roles }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } }, orderBy: { name: "asc" }, take: 200 });
  const allowed = [];
  for (const user of users) { const assignment = user.iamRoleAssignments.find((row: any) => roles.includes(row.role)); if (assignment && (await evaluateEffectivePermission(client, { userId: user.id, roleAssignmentId: assignment.id, permission: "RESPOND_SUPPORT_REQUESTS" })).allowed) allowed.push({ publicKey: user.iamPublicKey, name: user.name, role: assignment.role }); }
  return allowed;
}

export async function loadSupportRequestForActor(client: any, actor: SupportActor, requestKey: string, mode: "OWN" | "MANAGE") {
  const row = await client.supportRequest.findUnique({ where: { publicKey: safePublicKey(requestKey) }, include: managementInclude });
  if (!row) throw new SupportError("Support request not found.", 404);
  if (mode === "OWN") {
    if (!actor.permissions.has("VIEW_OWN_SUPPORT") || row.requesterUserId !== actor.id || row.requesterRole !== actor.role || !await requesterObjectScopeValid(client, actor, row)) throw new SupportError("Support request not found.", 404);
    return serializeOwn(row);
  }
  if (!actor.permissions.has("VIEW_SUPPORT_REQUESTS") || !canManageRow(actor, row)) throw new SupportError("Support request not found.", 404);
  await client.supportAccessEvent.create({ data: { requestId: row.id, actorUserId: actor.id, eventType: "REQUEST_VIEW", outcome: "ALLOWED", safeMetadataJson: JSON.stringify({ role: actor.role }) } });
  return serializeManaged(actor, row);
}

export async function triageSupportRequest(client: any, actor: SupportActor, requestKey: string, inputValue: unknown, now = new Date()) {
  if (!actor.permissions.has("TRIAGE_SUPPORT_REQUESTS")) throw new SupportError("Support triage is not authorised.", 403);
  const input = object(inputValue), expectedVersion = integer(input.expectedVersion, "Expected version", 1), categoryCode = oneOf(input.category, SUPPORT_CATEGORIES, "Category"), priority = oneOf(input.priority, SUPPORT_PRIORITIES, "Priority"), confidentiality = oneOf(input.confidentiality, SUPPORT_CONFIDENTIALITY, "Confidentiality"), reason = text(input.reason, "Triage reason", 3, 1000);
  assertConfidentialityPermission(actor, confidentiality);
  const policy = await activePolicy(client, categoryCode, now);
  const complainedAbout = input.complainedAboutUserKey ? await client.user.findUnique({ where: { iamPublicKey: key(input.complainedAboutUserKey, "Complained-about Staff") }, select: { id: true } }) : null;
  return client.$transaction(async (tx: any) => {
    const current = await scopedManagementRow(tx, actor, requestKey);
    if (!["SUBMITTED", "ACKNOWLEDGED", "TRIAGED", "REOPENED"].includes(current.status)) throw new SupportError("This request is not in a triage state.", 409);
    if (complainedAbout?.id && current.assignments.some((row: any) => row.status === "ACTIVE" && row.assigneeUserId === complainedAbout.id)) await endActiveAssignment(tx, current.id, now);
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { categoryPolicyId: policy.id, queueId: policy.queueId, priority, confidentiality, complainedAboutUserId: complainedAbout?.id ?? current.complainedAboutUserId, status: "TRIAGED", version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    await appendEvent(tx, current.id, "REQUEST_TRIAGED", actor, current.status, "TRIAGED", expectedVersion + 1, reason, { categoryCode, priority, confidentiality });
    if (priority === "URGENT" || confidentiality === "SAFEGUARDING") await publishSupportNotification(tx, { eventKey: `${current.publicKey}:URGENT:${expectedVersion + 1}`, type: "URGENT_RESTRICTED_ALERT", actorUserId: actor.id, requestPublicKey: current.publicKey, confidentiality, priority, now });
    return tx.supportRequest.findUnique({ where: { id: current.id }, include: managementInclude });
  });
}

export async function assignSupportRequest(client: any, actor: SupportActor, requestKey: string, value: unknown, now = new Date()) {
  if (!actor.permissions.has("ASSIGN_SUPPORT_REQUESTS")) throw new SupportError("Support assignment is not authorised.", 403);
  const input = object(value), expectedVersion = integer(input.expectedVersion, "Expected version", 1), assigneeKey = key(input.assigneeUserKey, "Assignee"), reason = text(input.reason, "Assignment reason", 3, 1000);
  return client.$transaction(async (tx: any) => {
    const current = await scopedManagementRow(tx, actor, requestKey);
    if (["RESOLVED", "CLOSED", "REJECTED_AS_INVALID", "CANCELLED", "ARCHIVED"].includes(current.status)) throw new SupportError("A terminal request cannot be assigned.", 409);
    const assignee = await tx.user.findUnique({ where: { iamPublicKey: assigneeKey }, include: { iamRoleAssignments: { where: { status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } } });
    if (!assignee?.isActive || assignee.lifecycleStatus !== "ACTIVE") throw new SupportError("The assignee is inactive or unavailable.", 409);
    if (current.complainedAboutUserId === assignee.id) throw new SupportError("A complaint cannot be assigned to the complained-about person.", 409);
    const allowedRoles = parseStringArray(current.categoryPolicy.permittedAssigneeRolesJson), assignment = assignee.iamRoleAssignments.find((row: any) => allowedRoles.includes(row.role));
    if (!assignment || !(await evaluateEffectivePermission(tx, { userId: assignee.id, roleAssignmentId: assignment.id, permission: "RESPOND_SUPPORT_REQUESTS" })).allowed) throw new SupportError("The selected user lacks the exact active assignee role and permission.", 403);
    if (assignee.id === actor.id && !canManageRow(actor, current)) throw new SupportError("Self-assignment cannot be used to gain hidden access.", 403);
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: "ASSIGNED", version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    await endActiveAssignment(tx, current.id, now);
    await tx.supportAssignment.create({ data: { requestId: current.id, queueId: current.queueId, assigneeUserId: assignee.id, assignedByUserId: actor.id, reason, activeKey: current.id, assignedAt: now } });
    await appendEvent(tx, current.id, "REQUEST_ASSIGNED", actor, current.status, "ASSIGNED", expectedVersion + 1, reason, { assigneeRole: assignment.role });
    await publishSupportNotification(tx, { eventKey: `${current.publicKey}:ASSIGNED:${expectedVersion + 1}`, type: "REQUEST_ASSIGNED", actorUserId: actor.id, requestPublicKey: current.publicKey, assigneeUserId: assignee.id, confidentiality: current.confidentiality, priority: current.priority, now });
    return tx.supportRequest.findUnique({ where: { id: current.id }, include: managementInclude });
  });
}

export async function addSupportMessage(client: any, actor: SupportActor, requestKey: string, value: unknown, mode: "OWN" | "MANAGE", now = new Date()) {
  const input = object(value), body = plainText(input.body, "Message", 1, 6000), expectedVersion = integer(input.expectedVersion, "Expected version", 1), correctsMessageKey = optionalText(input.correctsMessageKey, "Corrected message", 100);
  const messageType = mode === "OWN" ? "REQUESTER_VISIBLE" : oneOf(input.messageType, ["REQUESTER_VISIBLE", "INTERNAL_NOTE"], "Message type");
  const informationRequested = mode === "MANAGE" && input.informationRequested === true;
  return client.$transaction(async (tx: any) => {
    const current = mode === "OWN" ? await scopedOwnRow(tx, actor, requestKey) : await scopedManagementRow(tx, actor, requestKey);
    if (["CLOSED", "REJECTED_AS_INVALID", "CANCELLED", "ARCHIVED"].includes(current.status)) throw new SupportError("This request does not accept new messages.", 409);
    if (mode === "OWN" && !actor.permissions.has("REPLY_OWN_SUPPORT")) throw new SupportError("Support replies are not authorised.", 403);
    if (mode === "MANAGE" && messageType === "REQUESTER_VISIBLE" && !actor.permissions.has("RESPOND_SUPPORT_REQUESTS")) throw new SupportError("Requester-visible responses are not authorised.", 403);
    if (mode === "MANAGE" && messageType === "INTERNAL_NOTE" && !actor.permissions.has("ADD_SUPPORT_INTERNAL_NOTES")) throw new SupportError("Internal notes are not authorised.", 403);
    const restricted = messageType === "INTERNAL_NOTE" && current.confidentiality !== "STANDARD";
    if (restricted) assertConfidentialityPermission(actor, current.confidentiality);
    let correctsMessageId: string | null = null;
    if (correctsMessageKey) {
      const corrected = await tx.supportRequestMessage.findFirst({ where: { requestId: current.id, publicKey: safePublicKey(correctsMessageKey), messageType, authorUserId: actor.id }, select: { id: true } });
      if (!corrected) throw new SupportError("The message correction target is unavailable.", 404);
      correctsMessageId = corrected.id;
    }
    const nextStatus = mode === "OWN" && ["WAITING_FOR_REQUESTER", "REOPENED"].includes(current.status) ? "IN_PROGRESS" : informationRequested ? "WAITING_FOR_REQUESTER" : current.status === "ASSIGNED" && messageType === "REQUESTER_VISIBLE" ? "IN_PROGRESS" : current.status;
    const firstResponseAt = mode === "MANAGE" && messageType === "REQUESTER_VISIBLE" && !current.firstResponseAt ? now : undefined;
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: nextStatus, ...(firstResponseAt ? { firstResponseAt } : {}), version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    const message = await tx.supportRequestMessage.create({ data: { requestId: current.id, messageType, body, authorUserId: actor.id, authorRole: actor.role, authorLabel: mode === "OWN" ? "Requester" : actor.name, restricted, correctsMessageId, createdAt: now } });
    if (informationRequested) await tx.supportSlaSnapshot.updateMany({ where: { requestId: current.id, pausedAt: null }, data: { pausedAt: now, pauseState: "WAITING_FOR_REQUESTER" } });
    if (mode === "OWN" && current.status === "WAITING_FOR_REQUESTER") await resumeSupportSla(tx, current.id, now);
    await appendEvent(tx, current.id, correctsMessageId ? "MESSAGE_CORRECTION_ADDED" : messageType === "INTERNAL_NOTE" ? "INTERNAL_NOTE_ADDED" : mode === "OWN" ? "REQUESTER_REPLY_ADDED" : "REQUESTER_VISIBLE_RESPONSE_ADDED", actor, current.status, nextStatus, expectedVersion + 1, null, { messagePublicKey: message.publicKey, visibility: messageType });
    if (mode === "MANAGE" && messageType === "REQUESTER_VISIBLE") await publishSupportNotification(tx, { eventKey: message.publicKey, type: informationRequested ? "INFORMATION_REQUESTED" : "REQUESTER_VISIBLE_RESPONSE", actorUserId: actor.id, requestPublicKey: current.publicKey, requesterUserId: current.requesterUserId, confidentiality: current.confidentiality, priority: current.priority, now });
    return message;
  });
}

export async function performSupportTransition(client: any, actor: SupportActor, requestKey: string, value: unknown, now = new Date()) {
  const input = object(value), action = oneOf(input.action, ["ACKNOWLEDGE", "START", "WAIT_FOR_INTERNAL", "ESCALATE", "CLOSE", "REJECT_AS_INVALID", "CANCEL", "ARCHIVE"], "Action"), expectedVersion = integer(input.expectedVersion, "Expected version", 1), reason = text(input.reason, "Reason", 3, 1000);
  if (!actor.permissions.has(action === "ACKNOWLEDGE" ? "TRIAGE_SUPPORT_REQUESTS" : action === "CLOSE" ? "RESOLVE_SUPPORT_REQUESTS" : action === "ESCALATE" ? "TRIAGE_SUPPORT_REQUESTS" : "RESPOND_SUPPORT_REQUESTS")) throw new SupportError("This support transition is not authorised.", 403);
  return client.$transaction(async (tx: any) => {
    const current = await scopedManagementRow(tx, actor, requestKey);
    const next = transition(current.status, action);
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: next, ...(action === "ACKNOWLEDGE" ? { acknowledgedAt: now } : {}), ...(action === "CLOSE" ? { closedAt: now } : {}), ...(action === "ARCHIVE" ? { archivedAt: now } : {}), version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    if (current.status === "WAITING_FOR_REQUESTER" && next !== "WAITING_FOR_REQUESTER") await resumeSupportSla(tx, current.id, now);
    await appendEvent(tx, current.id, `REQUEST_${action}`, actor, current.status, next, expectedVersion + 1, reason);
    let notification: SupportNotificationType | null = action === "ACKNOWLEDGE" ? "REQUEST_ACKNOWLEDGED" : action === "CLOSE" ? "REQUEST_CLOSED" : null;
    if (action === "ESCALATE") {
      const escalationKey = `${current.id}:${reason}:${expectedVersion + 1}`;
      await tx.supportEscalation.upsert({ where: { idempotencyKey: escalationKey }, update: {}, create: { requestId: current.id, escalationLevel: current.escalations.filter((row: any) => row.status === "ACTIVE").length + 1, reasonCode: "MANUAL", reason, fromQueueId: current.queueId, toQueueId: "supportq-leadership", idempotencyKey: escalationKey, escalatedByUserId: actor.id, escalatedAt: now } });
      notification = "REQUEST_ESCALATED";
    }
    if (notification) await publishSupportNotification(tx, { eventKey: `${current.publicKey}:${action}:${expectedVersion + 1}`, type: notification, actorUserId: actor.id, requestPublicKey: current.publicKey, requesterUserId: current.requesterUserId, confidentiality: current.confidentiality, priority: current.priority, now });
    return tx.supportRequest.findUnique({ where: { id: current.id }, include: managementInclude });
  });
}

export async function resolveSupportRequest(client: any, actor: SupportActor, requestKey: string, value: unknown, now = new Date()) {
  if (!actor.permissions.has("RESOLVE_SUPPORT_REQUESTS")) throw new SupportError("Support resolution is not authorised.", 403);
  const input = object(value), expectedVersion = integer(input.expectedVersion, "Expected version", 1), resolutionCategory = oneOf(input.resolutionCategory, SUPPORT_RESOLUTION_CATEGORIES, "Resolution category"), requesterVisibleSummary = plainText(input.requesterVisibleSummary, "Requester-visible resolution", 10, 4000), internalActionSummary = plainText(input.internalActionSummary, "Internal action summary", 3, 4000), linkedActionType = optionalText(input.linkedActionType, "Linked action type", 80), linkedActionReference = optionalText(input.linkedActionReference, "Linked action reference", 120);
  return client.$transaction(async (tx: any) => {
    const current = await scopedManagementRow(tx, actor, requestKey);
    if (!["ASSIGNED", "IN_PROGRESS", "WAITING_FOR_REQUESTER", "WAITING_FOR_INTERNAL_ACTION", "ESCALATED", "REOPENED"].includes(current.status)) throw new SupportError("This request is not ready for resolution.", 409);
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: "RESOLVED", resolvedAt: now, linkedCorrectiveActionType: linkedActionType, linkedCorrectiveActionReference: linkedActionReference, version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    const resolutionVersion = current.resolutions.length + 1;
    const resolution = await tx.supportResolution.create({ data: { requestId: current.id, resolutionVersion, resolutionCategory, requesterVisibleSummary, internalActionSummary, linkedActionType, linkedActionReference, resolvedByUserId: actor.id, resolvedAt: now } });
    await appendEvent(tx, current.id, "REQUEST_RESOLVED", actor, current.status, "RESOLVED", expectedVersion + 1, requesterVisibleSummary, { resolutionCategory, resolutionVersion, linkedActionType: linkedActionType ?? null });
    await publishSupportNotification(tx, { eventKey: resolution.publicKey, type: "REQUEST_RESOLVED", actorUserId: actor.id, requestPublicKey: current.publicKey, requesterUserId: current.requesterUserId, confidentiality: current.confidentiality, priority: current.priority, now });
    await publishSupportNotification(tx, { eventKey: `${resolution.publicKey}:SATISFACTION`, type: "SATISFACTION_REQUEST", actorUserId: actor.id, requestPublicKey: current.publicKey, requesterUserId: current.requesterUserId, confidentiality: current.confidentiality, priority: current.priority, now });
    return resolution;
  });
}

export async function reopenOwnSupportRequest(client: any, actor: SupportActor, requestKey: string, value: unknown, now = new Date()) {
  if (!actor.permissions.has("REOPEN_OWN_SUPPORT")) throw new SupportError("Support reopening is not authorised.", 403);
  const input = object(value), expectedVersion = integer(input.expectedVersion, "Expected version", 1), reason = plainText(input.reason, "Reopen reason", 10, 1000);
  return client.$transaction(async (tx: any) => {
    const current = await scopedOwnRow(tx, actor, requestKey);
    if (!['RESOLVED','CLOSED'].includes(current.status)) throw new SupportError("Only resolved or closed requests may be reopened.", 409);
    if (["SAFEGUARDING", "LEADERSHIP_ONLY"].includes(current.confidentiality)) throw new SupportError("Closed safety or privacy cases require restricted staff review before reopening.", 409, "RESTRICTED_REOPEN_REVIEW");
    if (current.reopenedCount >= 5) throw new SupportError("Repeated reopening requires staff review.", 429);
    const changed = await tx.supportRequest.updateMany({ where: { id: current.id, version: expectedVersion }, data: { status: "REOPENED", reopenedCount: { increment: 1 }, closedAt: null, version: { increment: 1 } } });
    if (changed.count !== 1) throw new SupportError("The request changed. Refresh and retry.", 409, "STALE_VERSION");
    await appendEvent(tx, current.id, "REQUEST_REOPENED", actor, current.status, "REOPENED", expectedVersion + 1, reason);
    await tx.supportRequestMessage.create({ data: { requestId: current.id, messageType: "REQUESTER_VISIBLE", body: reason, authorUserId: actor.id, authorRole: actor.role, authorLabel: "Requester", createdAt: now } });
    await publishSupportNotification(tx, { eventKey: `${current.publicKey}:REOPEN:${expectedVersion + 1}`, type: "REQUEST_REOPENED", actorUserId: actor.id, requestPublicKey: current.publicKey, requesterUserId: current.requesterUserId, queueRoles: parseStringArray(current.categoryPolicy.permittedAssigneeRolesJson), confidentiality: current.confidentiality, priority: current.priority, now });
    return tx.supportRequest.findUnique({ where: { id: current.id }, include: ownInclude });
  });
}

export async function submitSupportSatisfaction(client: any, actor: SupportActor, requestKey: string, value: unknown, now = new Date()) {
  if (!actor.permissions.has("SUBMIT_SUPPORT_SATISFACTION")) throw new SupportError("Support satisfaction feedback is not authorised.", 403);
  const input = object(value), declined = input.declined === true, rating = declined ? null : integer(input.rating, "Rating", 1, 5), issueUnderstood = declined ? null : boolean(input.issueUnderstood, "Issue understood"), responseClear = declined ? null : boolean(input.responseClear, "Response clear"), issueResolved = declined ? null : boolean(input.issueResolved, "Issue resolved"), comment = optionalPlainText(input.comment, "Comment", 1000);
  return client.$transaction(async (tx: any) => {
    const current = await scopedOwnRow(tx, actor, requestKey), resolution = current.resolutions.at(-1);
    if (!resolution || !["RESOLVED", "CLOSED"].includes(current.status)) throw new SupportError("Satisfaction feedback is available only after resolution.", 409);
    const response = await tx.supportSatisfactionResponse.create({ data: { requestId: current.id, resolutionId: resolution.id, issueUnderstood, responseClear, issueResolved, rating, comment, declined, submittedByUserId: actor.id, createdAt: now } }).catch((error: any) => { if (error?.code === "P2002") throw new SupportError("Feedback was already submitted for this resolution.", 409); throw error; });
    await appendEvent(tx, current.id, declined ? "SATISFACTION_DECLINED" : "SATISFACTION_SUBMITTED", actor, current.status, current.status, current.version, null, { resolutionVersion: resolution.resolutionVersion });
    return response;
  });
}

export async function createSupportAttachmentRecord(client: any, actor: SupportActor, requestKey: string, messageKey: string | null, file: StoredFile, visibility: "REQUESTER_VISIBLE" | "INTERNAL_NOTE", mode: "OWN" | "MANAGE", now = new Date()) {
  return client.$transaction(async (tx: any) => {
    const current = mode === "OWN" ? await scopedOwnRow(tx, actor, requestKey) : await scopedManagementRow(tx, actor, requestKey);
    if (!actor.permissions.has("UPLOAD_SUPPORT_ATTACHMENTS")) throw new SupportError("Support attachment upload is not authorised.", 403);
    if (!current.categoryPolicy.attachmentsAllowed) throw new SupportError("Attachments are disabled for this support category.", 409);
    if (mode === "OWN" && visibility !== "REQUESTER_VISIBLE") throw new SupportError("Requesters cannot create internal attachments.", 403);
    if (visibility === "INTERNAL_NOTE" && !actor.permissions.has("ADD_SUPPORT_INTERNAL_NOTES")) throw new SupportError("Internal attachments are not authorised.", 403);
    const existing = current.attachments;
    if (existing.length >= 5 || existing.reduce((sum: number, row: any) => sum + row.byteSize, 0) + file.byteSize > 20 * 1024 * 1024) throw new SupportError("The support attachment quota has been reached.", 413);
    let messageId: string | null = null;
    if (messageKey) {
      const message = await tx.supportRequestMessage.findFirst({ where: { requestId: current.id, publicKey: safePublicKey(messageKey), messageType: visibility }, select: { id: true } });
      if (!message) throw new SupportError("The attachment message target is unavailable.", 404);
      messageId = message.id;
    }
    const attachment = await createAttachmentRow(tx, current.id, messageId, file, visibility, "AUTHENTICATED", actor.id, now);
    await appendEvent(tx, current.id, "ATTACHMENT_ADDED", actor, current.status, current.status, current.version, null, { attachmentPublicKey: attachment.publicKey, visibility, sha256: attachment.sha256 });
    return attachment;
  });
}

export async function loadSupportAttachment(client: any, actor: SupportActor, attachmentKey: string, mode: "OWN" | "MANAGE") {
  const row = await client.supportRequestAttachment.findUnique({ where: { publicKey: safePublicKey(attachmentKey) }, include: { request: { include: { linkedChildren: true, assignments: true, categoryPolicy: { include: { queue: true } }, queue: true } } } });
  if (!row) throw new SupportError("Attachment not found.", 404);
  if (mode === "OWN") {
    if (row.visibility !== "REQUESTER_VISIBLE" || row.request.requesterUserId !== actor.id || row.request.requesterRole !== actor.role || !await requesterObjectScopeValid(client, actor, row.request)) throw new SupportError("Attachment not found.", 404);
  } else if (!canManageRow(actor, row.request) || row.visibility === "INTERNAL_NOTE" && !actor.permissions.has("ADD_SUPPORT_INTERNAL_NOTES")) throw new SupportError("Attachment not found.", 404);
  await client.supportAccessEvent.create({ data: { requestId: row.requestId, actorUserId: actor.id, eventType: "ATTACHMENT_DOWNLOAD", outcome: "ALLOWED", safeMetadataJson: JSON.stringify({ attachmentPublicKey: row.publicKey, visibility: row.visibility }) } });
  return row;
}

export async function supportReport(client: any, actor: SupportActor, now = new Date()) {
  if (!actor.permissions.has("VIEW_SUPPORT_REPORTS")) throw new SupportError("Support reporting is not authorised.", 403);
  const rows = await client.supportRequest.findMany({ include: { queue: true, assignments: { where: { status: "ACTIVE" } }, categoryPolicy: { select: { categoryCode: true, label: true } }, resolutions: { orderBy: { resolutionVersion: "desc" }, take: 1 }, satisfactionResponses: true, escalations: { where: { status: "ACTIVE" } }, slaSnapshots: { orderBy: { createdAt: "desc" }, take: 1 } }, take: 10_000 });
  const visible = actor.role === "VIEWER" ? rows.filter((row: any) => row.confidentiality === "STANDARD") : rows.filter((row: any) => canReportRow(actor, row));
  const byCategory = new Map<string, { category: string; label: string; count: number }>();
  for (const row of visible) { const current = byCategory.get(row.categoryPolicy.categoryCode) ?? { category: row.categoryPolicy.categoryCode, label: row.categoryPolicy.label, count: 0 }; current.count++; byCategory.set(current.category, current); }
  const durations = visible.filter((row: any) => row.firstResponseAt).map((row: any) => Math.max(0,row.firstResponseAt.getTime() - row.receivedAt.getTime() - slaPausedMilliseconds(row,now))).sort((a: number,b: number) => a-b);
  const resolutionDurations = visible.filter((row: any) => row.resolvedAt).map((row: any) => Math.max(0,row.resolvedAt.getTime() - row.receivedAt.getTime() - slaPausedMilliseconds(row,now))).sort((a: number,b: number) => a-b);
  const satisfaction = visible.flatMap((row: any) => row.satisfactionResponses).filter((row: any) => row.rating != null).map((row: any) => row.rating);
  const suppress = (row: { count: number }) => actor.role === "VIEWER" && row.count < 5;
  return {
    generatedAt: now.toISOString(), targetsAreSchoolPolicyNotLegalPromises: true,
    open: visible.filter((row: any) => !["RESOLVED","CLOSED","REJECTED_AS_INVALID","CANCELLED","ARCHIVED"].includes(row.status)).length,
    urgentOrEscalated: visible.filter((row: any) => row.priority === "URGENT" || row.escalations.length).length,
    overdueAcknowledgment: visible.filter((row: any) => !row.acknowledgedAt && row.slaSnapshots[0]?.acknowledgmentTargetAt < now).length,
    overdueResponse: visible.filter((row: any) => !row.firstResponseAt && row.slaSnapshots[0]?.firstResponseTargetAt < now).length,
    overdueResolution: visible.filter((row: any) => !row.resolvedAt && row.slaSnapshots[0]?.resolutionTargetAt < now).length,
    reopened: visible.reduce((sum: number, row: any) => sum + row.reopenedCount, 0),
    categories: [...byCategory.values()].filter((row) => !suppress(row)),
    firstResponse: durationSummary(durations), resolution: durationSummary(resolutionDurations),
    satisfaction: satisfaction.length >= 5 || actor.role !== "VIEWER" ? { count: satisfaction.length, average: satisfaction.length ? round(satisfaction.reduce((a: number,b: number) => a+b,0)/satisfaction.length) : null } : { count: 0, average: null, suppressed: true },
    lowCountSuppression: actor.role === "VIEWER", staffRanking: false
  };
}

export async function escalateOverdueSupportRequests(client:any,actor:SupportActor,now=new Date()){
  if(!actor.permissions.has("TRIAGE_SUPPORT_REQUESTS")||!["SUPER_ADMIN","DIRECTOR"].includes(actor.role))throw new SupportError("Overdue support escalation requires governed leadership authority.",403);
  const rows=await client.supportRequest.findMany({where:{status:{notIn:["RESOLVED","CLOSED","REJECTED_AS_INVALID","CANCELLED","ARCHIVED"]}},include:{slaSnapshots:{orderBy:{createdAt:"desc"},take:1},categoryPolicy:true,queue:true,assignments:true,escalations:true},take:10_000});let created=0,skipped=0;
  for(const row of rows){const snapshot=row.slaSnapshots[0];if(!snapshot||snapshot.pausedAt){skipped++;continue;}const reasonCode=!row.acknowledgedAt&&snapshot.acknowledgmentTargetAt<now?"ACKNOWLEDGMENT_TARGET_OVERDUE":!row.firstResponseAt&&snapshot.firstResponseTargetAt<now?"FIRST_RESPONSE_TARGET_OVERDUE":!row.resolvedAt&&snapshot.resolutionTargetAt<now?"RESOLUTION_TARGET_OVERDUE":null;if(!reasonCode){skipped++;continue;}const idempotencyKey=`SLA:${row.id}:${snapshot.id}:${reasonCode}`;const result=await client.$transaction(async(tx:any)=>{if(await tx.supportEscalation.findUnique({where:{idempotencyKey},select:{id:true}}))return false;const current=await scopedManagementRow(tx,actor,row.publicKey),nextVersion=current.version+1;await tx.supportRequest.update({where:{id:current.id},data:{status:"ESCALATED",version:{increment:1}}});const escalation=await tx.supportEscalation.create({data:{requestId:current.id,escalationLevel:current.escalations.filter((item:any)=>item.status==="ACTIVE").length+1,reasonCode,reason:`School policy target overdue: ${reasonCode.replaceAll("_"," ").toLowerCase()}.`,fromQueueId:current.queueId,toQueueId:"supportq-leadership",idempotencyKey,escalatedByUserId:actor.id,escalatedAt:now}});await appendEvent(tx,current.id,"REQUEST_TARGET_OVERDUE_ESCALATION",actor,current.status,"ESCALATED",nextVersion,escalation.reason,{reasonCode,slaSnapshotPublicKey:snapshot.publicKey});await publishSupportNotification(tx,{eventKey:idempotencyKey,type:"REQUEST_ESCALATED",actorUserId:actor.id,requestPublicKey:current.publicKey,requesterUserId:current.requesterUserId,confidentiality:current.confidentiality,priority:current.priority,now});return true;});if(result)created++;else skipped++;}
  return{evaluated:rows.length,created,skipped,idempotent:true};
}

const ownInclude = { categoryPolicy: { include: { queue: true } }, queue: true, linkedChildren: true, messages: { where: { messageType: "REQUESTER_VISIBLE" }, orderBy: { createdAt: "asc" } }, attachments: { where: { visibility: "REQUESTER_VISIBLE" }, orderBy: { createdAt: "asc" } }, assignments: { where: { status: "ACTIVE" }, select: { publicKey: true, assignedAt: true } }, escalations: { where: { status: "ACTIVE" }, select: { publicKey: true, escalatedAt: true } }, slaSnapshots: { orderBy: { createdAt: "desc" }, take: 1 }, resolutions: { orderBy: { resolutionVersion: "asc" } }, satisfactionResponses: true, events: { where: { eventType: { notIn: ["INTERNAL_NOTE_ADDED", "REQUEST_VIEW"] } }, orderBy: { occurredAt: "asc" } } } as const;
const managementInclude = { categoryPolicy: { include: { queue: true } }, queue: true, linkedChildren: true, messages: { orderBy: { createdAt: "asc" } }, attachments: { orderBy: { createdAt: "asc" } }, assignments: { orderBy: { assignedAt: "asc" } }, escalations: { orderBy: { escalatedAt: "asc" } }, slaSnapshots: { orderBy: { createdAt: "desc" }, take: 1 }, resolutions: { orderBy: { resolutionVersion: "asc" } }, satisfactionResponses: true, events: { orderBy: { occurredAt: "asc" } } } as const;

async function createRequest(tx: any, input: any) {
  const reference = supportReference(input.now), policy = input.categoryPolicy, targets = await supportServiceTargets(tx,input.now,policy);
  const request = await tx.supportRequest.create({ data: { reference, submissionKey: input.submissionKey, source: input.source, requesterUserId: input.requesterUserId ?? null, requesterRole: input.requesterRole ?? null, requesterStaffMemberId: input.requesterStaffMemberId ?? null, requesterGuardianId: input.requesterGuardianId ?? null, requesterName: input.requesterName, requesterType: input.requesterType, requesterIdentifier: input.requesterIdentifier ?? null, requesterContactChannel: input.requesterContactChannel ?? null, requesterContactValue: input.requesterContactValue ?? null, identityVerified: input.identityVerified ?? false, recordedByUserId: input.recordedByUserId ?? null, receivedAt: input.now, signedPaperReference: input.signedPaperReference ?? null, categoryPolicyId: policy.id, queueId: policy.queueId, priority: input.priority, confidentiality: input.confidentiality, subject: input.subject, originalStatement: input.originalStatement, status: "SUBMITTED", complainedAboutUserId: input.complainedAboutUserId ?? null, linkedReceiptReference: input.linkedReceiptReference ?? null, privacyNoticeVersion: input.privacyNoticeVersion, consentRecordedAt: input.consentRecordedAt ?? null, duplicateFingerprint: input.duplicateFingerprint ?? null, retentionReviewAt: input.now, createdAt: input.now } });
  await tx.supportRequestEvent.create({ data: { requestId: request.id, eventType: "REQUEST_SUBMITTED", actorUserId: input.requesterUserId ?? input.recordedByUserId ?? null, actorRole: input.requesterRole ?? null, previousStatus: "DRAFT", newStatus: "SUBMITTED", entityVersion: 1, safeMetadataJson: JSON.stringify({ source: input.source, category: policy.categoryCode }), occurredAt: input.now } });
  await tx.supportSlaSnapshot.create({ data: { requestId: request.id, categoryPolicyId: policy.id, policyVersion: policy.version, ...targets, workingHoursPolicyJson: policy.workingHoursPolicyJson, createdAt: input.now } });
  return request;
}

async function activePolicy(client: any, categoryCode: string, now: Date) {
  const policy = await client.supportCategoryPolicy.findUnique({ where: { categoryCode }, include: { queue: true } });
  if (!policy || policy.status !== "ACTIVE" || policy.effectiveFrom > now || policy.effectiveTo && policy.effectiveTo <= now || policy.queue.status !== "ACTIVE") throw new SupportError("The selected support category is not currently available.", 409);
  return policy;
}

async function resolveParentSupportChildren(client: any, actor: SupportActor, context: { sessionId: string; academicYear: string }, handles: string[], contextVersion: number | null) {
  const catalogue = await listChildContexts(client, { userId: actor.id, sessionId: context.sessionId }).catch(() => { throw new SupportError("The Parent linked-child context is unavailable.", 403); });
  if (contextVersion == null || catalogue.contextVersion !== contextVersion) throw new SupportError("The Parent child context changed. Refresh and try again.", 409, "STALE_CHILD_CONTEXT");
  const selected = handles.map((handle) => catalogue.children.find((child: any) => child.handle === handle)).filter(Boolean);
  if (selected.length !== handles.length || selected.length > 5) throw new SupportError("One or more selected child contexts are unavailable.", 404);
  const guardian = await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true } });
  const rows = [];
  for (const child of selected as any[]) {
    const link = await client.studentGuardian.findFirst({ where: { guardianId: guardian?.guardianId ?? "__none__", student: { admissionNo: child.admissionNo, deletedAt: null, academicYearEnrollments: { some: { academicYear: context.academicYear, status: "ACTIVE" } } } }, select: { student: { select: { id: true, admissionNo: true, studentName: true, className: true, section: true } } } });
    if (!link) throw new SupportError("The Parent-child link is no longer active.", 404);
    rows.push({ studentId: link.student.id, admissionNo: link.student.admissionNo, studentName: link.student.studentName, className: link.student.className, section: link.student.section });
  }
  return rows;
}

async function requesterObjectScopeValid(client: any, actor: SupportActor, request: any) {
  if (request.requesterUserId !== actor.id || request.requesterRole !== actor.role) return false;
  if (actor.role !== "PARENT" || !request.linkedChildren?.length) return true;
  const guardian = await client.user.findUnique({ where: { id: actor.id }, select: { guardianId: true, isActive: true, lifecycleStatus: true } });
  if (!guardian?.guardianId || !guardian.isActive || guardian.lifecycleStatus !== "ACTIVE") return false;
  const count = await client.studentGuardian.count({ where: { guardianId: guardian.guardianId, studentId: { in: request.linkedChildren.map((row: any) => row.studentId) }, student: { deletedAt: null } } });
  return count === request.linkedChildren.length;
}

function canManageRow(actor: SupportActor, row: any) {
  try { assertConfidentialityPermission(actor, row.confidentiality); } catch { return false; }
  if (["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) return true;
  const assigned = row.assignments?.some((item: any) => item.status === "ACTIVE" && item.assigneeUserId === actor.id);
  if (actor.role === "PRINCIPAL") return assigned || ["ACADEMIC_SUPPORT", "GENERAL_ADMIN", "ADMISSIONS_SUPPORT", "SAFETY_RESTRICTED"].includes(row.queue.queueCode);
  if (actor.role === "ADMIN") return assigned || row.confidentiality === "STANDARD" && ["GENERAL_ADMIN", "ADMISSIONS_SUPPORT"].includes(row.queue.queueCode);
  if (actor.role === "ACCOUNTANT") return assigned && row.queue.queueCode === "FINANCE_SUPPORT";
  if (actor.role === "COMPUTER_OPERATOR") return assigned && row.queue.queueCode === "TECHNICAL_SUPPORT";
  return Boolean(assigned);
}

function canReportRow(actor: SupportActor, row: any) {
  if (actor.role === "VIEWER") return row.confidentiality === "STANDARD";
  return canManageRow(actor, { ...row, assignments: row.assignments ?? [], queue: row.categoryPolicy?.queue ?? row.queue });
}

function assertConfidentialityPermission(actor: SupportActor, confidentiality: string) {
  if (confidentiality === "RESTRICTED" && !actor.permissions.has("VIEW_RESTRICTED_SUPPORT")) throw new SupportError("Restricted support access is not authorised.", 403);
  if (confidentiality === "SAFEGUARDING" && !actor.permissions.has("VIEW_SAFEGUARDING_SUPPORT")) throw new SupportError("Safeguarding support access is not authorised.", 403);
  if (confidentiality === "LEADERSHIP_ONLY" && !actor.permissions.has("VIEW_LEADERSHIP_ONLY_SUPPORT")) throw new SupportError("Leadership-only support access is not authorised.", 403);
}

async function scopedManagementRow(tx: any, actor: SupportActor, requestKey: string) { const row = await tx.supportRequest.findUnique({ where: { publicKey: safePublicKey(requestKey) }, include: managementInclude }); if (!row || !canManageRow(actor, row)) throw new SupportError("Support request not found.", 404); return row; }
async function scopedOwnRow(tx: any, actor: SupportActor, requestKey: string) { const row = await tx.supportRequest.findUnique({ where: { publicKey: safePublicKey(requestKey) }, include: managementInclude }); if (!row || !await requesterObjectScopeValid(tx, actor, row)) throw new SupportError("Support request not found.", 404); return row; }
async function endActiveAssignment(tx: any, requestId: string, now: Date) { await tx.supportAssignment.updateMany({ where: { requestId, status: "ACTIVE" }, data: { status: "ENDED", activeKey: null, endedAt: now } }); }
async function appendEvent(tx: any, requestId: string, eventType: string, actor: SupportActor, previousStatus: string | null, newStatus: string | null, entityVersion: number, reason?: string | null, metadata?: Record<string, unknown>) { return tx.supportRequestEvent.create({ data: { requestId, eventType, actorUserId: actor.id, actorRole: actor.role, previousStatus, newStatus, entityVersion, reason: reason ?? null, safeMetadataJson: metadata ? JSON.stringify(metadata) : null } }); }
async function createAttachmentRow(tx: any, requestId: string, messageId: string | null, file: StoredFile, visibility: string, intakeScope: string, createdByUserId: string | null, now: Date) { return tx.supportRequestAttachment.create({ data: { requestId, messageId, storageKey: file.storageKey, safeDisplayName: file.safeDisplayName, mediaType: file.mediaType, extension: file.extension, byteSize: file.byteSize, sha256: file.sha256, width: file.width, height: file.height, pageCount: file.pageCount, visibility, intakeScope, retentionReviewAt: now, createdByUserId, createdAt: now } }); }
async function resumeSupportSla(tx:any,requestId:string,now:Date){const snapshot=await tx.supportSlaSnapshot.findFirst({where:{requestId,pausedAt:{not:null}},orderBy:{createdAt:"desc"}});if(!snapshot?.pausedAt)return;const seconds=Math.max(0,Math.floor((now.getTime()-snapshot.pausedAt.getTime())/1000));await tx.supportSlaSnapshot.update({where:{id:snapshot.id},data:{pausedAt:null,pauseState:null,totalPausedSeconds:{increment:seconds},acknowledgmentTargetAt:new Date(snapshot.acknowledgmentTargetAt.getTime()+seconds*1000),firstResponseTargetAt:new Date(snapshot.firstResponseTargetAt.getTime()+seconds*1000),resolutionTargetAt:new Date(snapshot.resolutionTargetAt.getTime()+seconds*1000),escalationTargetAt:new Date(snapshot.escalationTargetAt.getTime()+seconds*1000)}});}

function serializeOwn(row: any) { return { publicKey: row.publicKey, reference: row.reference, source: row.source, category: row.categoryPolicy.categoryCode, categoryLabel: row.categoryPolicy.label, priority: row.priority, confidentiality: row.confidentiality, subject: row.subject, originalStatement: row.originalStatement, status: row.status, version: row.version, receivedAt: row.receivedAt, acknowledgedAt: row.acknowledgedAt, firstResponseAt: row.firstResponseAt, resolvedAt: row.resolvedAt, closedAt: row.closedAt, reopenedCount: row.reopenedCount, linkedChildren: row.linkedChildren.map((child: any) => ({ name: child.childDisplaySnapshot, className: child.classSnapshot, reference: child.admissionReferenceMasked })), messages: row.messages.filter((message: any) => message.messageType === "REQUESTER_VISIBLE").map((message: any) => ({ publicKey: message.publicKey, body: message.body, authorLabel: message.authorLabel, createdAt: message.createdAt, corrected: Boolean(message.correctsMessageId) })), attachments: row.attachments.filter((attachment: any) => attachment.visibility === "REQUESTER_VISIBLE").map(publicAttachment), timeline: row.events.filter((event: any) => !["INTERNAL_NOTE_ADDED", "REQUEST_VIEW"].includes(event.eventType)).map(publicEvent), resolutions: row.resolutions.map((resolution: any) => ({ publicKey: resolution.publicKey, version: resolution.resolutionVersion, category: resolution.resolutionCategory, summary: resolution.requesterVisibleSummary, linkedActionType: resolution.linkedActionType, linkedActionReference: resolution.linkedActionReference, resolvedAt: resolution.resolvedAt })), satisfactionSubmitted: row.satisfactionResponses.length > 0, serviceTargets: row.slaSnapshots[0] ? { acknowledgmentTargetAt: row.slaSnapshots[0].acknowledgmentTargetAt, firstResponseTargetAt: row.slaSnapshots[0].firstResponseTargetAt, resolutionTargetAt: row.slaSnapshots[0].resolutionTargetAt, policyTargetsNotLegalPromises: true } : null }; }
function serializeManaged(actor: SupportActor, row: any) { const includeInternal = actor.permissions.has("ADD_SUPPORT_INTERNAL_NOTES"); return { ...serializeOwn(row), requester: { name: row.requesterName, type: row.requesterType, suppliedIdentifier: row.requesterIdentifier, contactChannel: row.requesterContactChannel, contactValue: row.requesterContactValue, identityVerified: row.identityVerified }, queue: { code: row.queue.queueCode, name: row.queue.name }, messages: row.messages.filter((message: any) => message.messageType === "REQUESTER_VISIBLE" || includeInternal).map((message: any) => ({ publicKey: message.publicKey, type: message.messageType, body: message.body, authorLabel: message.authorLabel, createdAt: message.createdAt, restricted: message.restricted, corrected: Boolean(message.correctsMessageId) })), attachments: row.attachments.filter((attachment: any) => attachment.visibility === "REQUESTER_VISIBLE" || includeInternal).map(publicAttachment), assignments: row.assignments.map((assignment: any) => ({ publicKey: assignment.publicKey, status: assignment.status, assigneeUserId: assignment.assigneeUserId, assignedAt: assignment.assignedAt, endedAt: assignment.endedAt, reason: assignment.reason })), escalations: row.escalations.map((escalation: any) => ({ publicKey: escalation.publicKey, status: escalation.status, level: escalation.escalationLevel, reasonCode: escalation.reasonCode, reason: escalation.reason, escalatedAt: escalation.escalatedAt })), events: row.events.filter((event: any) => includeInternal || event.eventType !== "INTERNAL_NOTE_ADDED").map((event: any) => ({ publicKey: event.publicKey, type: event.eventType, previousStatus: event.previousStatus, newStatus: event.newStatus, reason: event.reason, occurredAt: event.occurredAt, entityVersion: event.entityVersion })), resolutions: row.resolutions.map((resolution: any) => ({ publicKey: resolution.publicKey, version: resolution.resolutionVersion, category: resolution.resolutionCategory, requesterSummary: resolution.requesterVisibleSummary, internalSummary: includeInternal ? resolution.internalActionSummary : undefined, linkedActionType: resolution.linkedActionType, linkedActionReference: resolution.linkedActionReference, resolvedAt: resolution.resolvedAt })) }; }
function publicAttachment(row: any) { return { publicKey: row.publicKey, name: row.safeDisplayName, mediaType: row.mediaType, byteSize: row.byteSize, sha256: row.sha256, visibility: row.visibility, createdAt: row.createdAt }; }
function publicEvent(row: any) { return { publicKey: row.publicKey, type: row.eventType, previousStatus: row.previousStatus, newStatus: row.newStatus, reason: row.reason, occurredAt: row.occurredAt, entityVersion: row.entityVersion }; }

function transition(status: string, action: string) { const allowed: Record<string, Record<string,string>> = { SUBMITTED: { ACKNOWLEDGE: "ACKNOWLEDGED", REJECT_AS_INVALID: "REJECTED_AS_INVALID", CANCEL: "CANCELLED" }, ACKNOWLEDGED: { START: "IN_PROGRESS", REJECT_AS_INVALID: "REJECTED_AS_INVALID", CANCEL: "CANCELLED", ESCALATE: "ESCALATED" }, TRIAGED: { START: "IN_PROGRESS", ESCALATE: "ESCALATED", REJECT_AS_INVALID: "REJECTED_AS_INVALID", CANCEL: "CANCELLED" }, ASSIGNED: { START: "IN_PROGRESS", WAIT_FOR_INTERNAL: "WAITING_FOR_INTERNAL_ACTION", ESCALATE: "ESCALATED", CANCEL: "CANCELLED" }, IN_PROGRESS: { WAIT_FOR_INTERNAL: "WAITING_FOR_INTERNAL_ACTION", ESCALATE: "ESCALATED", CANCEL: "CANCELLED" }, WAITING_FOR_REQUESTER: { START: "IN_PROGRESS", ESCALATE: "ESCALATED", CANCEL: "CANCELLED" }, WAITING_FOR_INTERNAL_ACTION: { START: "IN_PROGRESS", ESCALATE: "ESCALATED", CANCEL: "CANCELLED" }, ESCALATED: { START: "IN_PROGRESS", WAIT_FOR_INTERNAL: "WAITING_FOR_INTERNAL_ACTION", CANCEL: "CANCELLED" }, RESOLVED: { CLOSE: "CLOSED" }, REJECTED_AS_INVALID: { ARCHIVE: "ARCHIVED" }, CANCELLED: { ARCHIVE: "ARCHIVED" }, CLOSED: { ARCHIVE: "ARCHIVED" } }; const next = allowed[status]?.[action]; if (!next) throw new SupportError(`Transition ${action} is not allowed from ${status}.`, 409, "INVALID_TRANSITION"); return next; }
async function receiptBelongsToChildren(client: any, receipt: string, studentIds: string[]) { if (!studentIds.length) return false; const rows = await client.payment.findMany({ where: { receiptNo: receipt, studentId: { in: studentIds }, deletedAt: null, isCancelled: false }, select: { studentId: true }, take: 20 }); return rows.length > 0 && rows.every((row: any) => row.studentId && studentIds.includes(row.studentId)); }
async function notificationActor(client: any) { const now = new Date(); const row = await client.user.findFirst({ where: { isActive: true, lifecycleStatus: "ACTIVE", iamRoleAssignments: { some: { role: { in: ["SUPER_ADMIN","DIRECTOR"] }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } }, select: { id: true } }); return row?.id ?? null; }
function supportReference(now: Date) { return `NPS-SUP-${now.toISOString().slice(0,10).replaceAll("-","")}-${randomBytes(6).toString("hex").toUpperCase()}`; }
function opaqueNeutralReference(seed: string) { return `NPS-SUP-${privateHash(`neutral|${seed}`).slice(0,12).toUpperCase()}`; }
function privateHash(value: string) { const secret = process.env.SUPPORT_HASH_PEPPER?.trim() || process.env.SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim(); if (!secret || secret.length < 32) { if (process.env.NODE_ENV === "production") throw new SupportError("Support privacy hashing is unavailable.", 503); return createHmac("sha256", "nalanda-support-non-production-only-v1").update(value).digest("hex"); } return createHmac("sha256", secret).update(value).digest("hex"); }
function salaryDocumentRequest(category: string, content: string) { return category === "STAFF_HR" && /\b(?:payslip|pay\s*slip|salary\s+(?:slip|document|statement))\b/i.test(content); }
function supportCategoryLabel(value: string) { return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function maskReference(value: string) { const clean = value.trim(); return clean.length <= 4 ? "••••" : `${clean.slice(0,2)}••••${clean.slice(-2)}`; }
function durationSummary(values: number[]) { if (!values.length) return { count: 0, averageMinutes: null, medianMinutes: null }; const average = values.reduce((a,b)=>a+b,0)/values.length, middle = Math.floor(values.length/2), median = values.length%2 ? values[middle] : (values[middle-1]+values[middle])/2; return { count: values.length, averageMinutes: Math.round(average/60000), medianMinutes: Math.round(median/60000) }; }
function slaPausedMilliseconds(row:any,now:Date){const snapshot=row.slaSnapshots?.[0];return snapshot?Math.max(0,Number(snapshot.totalPausedSeconds??0)*1000+(snapshot.pausedAt?now.getTime()-snapshot.pausedAt.getTime():0)):0;}
async function supportServiceTargets(tx:any,start:Date,policy:any){let config:any={};try{config=JSON.parse(policy.workingHoursPolicyJson);}catch{}const minutes=[policy.acknowledgmentTargetMinutes,policy.firstResponseTargetMinutes,policy.resolutionTargetMinutes,policy.escalationTargetMinutes];if(config.basis!=="ACADEMIC_CALENDAR")return{acknowledgmentTargetAt:addMinutes(start,minutes[0]),firstResponseTargetAt:addMinutes(start,minutes[1]),resolutionTargetAt:addMinutes(start,minutes[2]),escalationTargetAt:addMinutes(start,minutes[3])};const horizon=new Date(start.getTime()+370*86_400_000),days:any[]=await tx.operationalCalendarDay.findMany({where:{dayDate:{gte:new Date(start.getTime()-86_400_000),lte:horizon},scopeKey:"SCHOOL_WIDE::",calendarVersion:{status:"PUBLISHED"}},select:{dayDate:true,dayType:true},orderBy:{dayDate:"asc"},take:400}).catch(()=>[]),dayMap=new Map<string,string>(days.map((row:any)=>[indiaDateKey(row.dayDate),String(row.dayType)]));const target=(value:number)=>addAcademicWorkingMinutes(start,value,dayMap);return{acknowledgmentTargetAt:target(minutes[0]),firstResponseTargetAt:target(minutes[1]),resolutionTargetAt:target(minutes[2]),escalationTargetAt:target(minutes[3])};}
function addAcademicWorkingMinutes(start:Date,minutes:number,days:Map<string,string>){let current=new Date(start),remaining=minutes,guard=0;while(remaining>0&&guard++<800){const key=indiaDateKey(current),type=days.get(key),weekday=indiaWeekday(current),working=type==="HALF_DAY"||["WORKING_DAY","SPECIAL_WORKING_DAY"].includes(type??"")||(!type&&weekday>=1&&weekday<=5);if(working&&!['NON_WORKING_DAY','VACATION_DAY','EMERGENCY_CLOSURE'].includes(type??"")){const officeStart=new Date(`${key}T09:00:00+05:30`),officeEnd=new Date(`${key}T${type==="HALF_DAY"?"13:00":"17:00"}:00+05:30`);if(current<officeStart)current=officeStart;if(current<officeEnd){const available=Math.floor((officeEnd.getTime()-current.getTime())/60_000),used=Math.min(remaining,available);remaining-=used;current=addMinutes(current,used);if(!remaining)return current;}}current=indiaNextOfficeStart(current);}return remaining>0?addMinutes(start,minutes):current;}
function indiaDateKey(value:Date){return new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kolkata",year:"numeric",month:"2-digit",day:"2-digit"}).format(value);}
function indiaWeekday(value:Date){const label=new Intl.DateTimeFormat("en-US",{timeZone:"Asia/Kolkata",weekday:"short"}).format(value);return["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].indexOf(label);}
function indiaNextOfficeStart(value:Date){const next=new Date(value.getTime()+86_400_000),key=indiaDateKey(next);return new Date(`${key}T09:00:00+05:30`);}
function addMinutes(date: Date, minutes: number) { return new Date(date.getTime() + minutes * 60_000); }
function round(value: number) { return Math.round(value * 100) / 100; }
function normalizeFingerprint(value: string) { return value.trim().toLowerCase().replace(/\s+/g, " "); }
function parseStringArray(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : []; } catch { return []; } }
function object(value: unknown): Record<string, any> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new SupportError("A valid request body is required."); return value as Record<string, any>; }
function text(value: unknown, label: string, minimum: number, maximum: number) { const result = String(value ?? "").trim().replace(/\r\n?/g,"\n"); if (result.length < minimum || result.length > maximum) throw new SupportError(`${label} must be between ${minimum} and ${maximum} characters.`); return result; }
function plainText(value: unknown, label: string, minimum: number, maximum: number) { const result = text(value,label,minimum,maximum); if (/[<>\u0000]/.test(result)) throw new SupportError(`${label} must be plain text without HTML.`); return result; }
function optionalText(value: unknown, label: string, maximum: number) { if (value == null || value === "") return null; return text(value,label,1,maximum); }
function optionalPlainText(value: unknown, label: string, maximum: number) { if (value == null || value === "") return null; return plainText(value,label,1,maximum); }
function oneOf<T extends readonly string[]>(value: unknown, values: T, label: string): T[number] { const result = String(value ?? "").trim().toUpperCase(); if (!(values as readonly string[]).includes(result)) throw new SupportError(`${label} is not supported.`); return result as T[number]; }
function integer(value: unknown, label: string, minimum: number, maximum?: number, optional?: false): number;
function integer(value: unknown, label: string, minimum: number, maximum: number, optional: true): number | null;
function integer(value: unknown, label: string, minimum: number, maximum = Number.MAX_SAFE_INTEGER, optional = false): number | null { if (optional && (value == null || value === "")) return null; const result = Number(value); if (!Number.isSafeInteger(result) || result < minimum || result > maximum) throw new SupportError(`${label} is invalid.`); return result; }
function boolean(value: unknown, label: string) { if (typeof value !== "boolean") throw new SupportError(`${label} is required.`); return value; }
function key(value: unknown, label: string) { const result = String(value ?? "").trim(); if (!/^[A-Za-z0-9._:-]{8,500}$/.test(result)) throw new SupportError(`${label} is invalid.`); return result; }
function safePublicKey(value: unknown) { const result = String(value ?? "").trim().toLowerCase(); if (!/^[a-f0-9-]{36}$/.test(result)) throw new SupportError("Support request not found.", 404); return result; }
function email(value: unknown) { const result = text(value,"Email",3,254).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new SupportError("Enter a valid email address."); return result; }
function mobile(value: unknown) { const result = text(value,"Mobile",8,20).replace(/[\s()-]/g,""); if (!/^\+?[1-9]\d{7,14}$/.test(result)) throw new SupportError("Enter a valid mobile number."); return result; }
