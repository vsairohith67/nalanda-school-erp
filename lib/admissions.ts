import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { hashPassword } from "@/lib/password";
import type { AuthUser } from "@/lib/auth";

export const ADMISSION_STATUSES = [
  "NEW", "CONTACTED", "VISIT_SCHEDULED", "APPLICATION_INVITED",
  "APPLICATION_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "WAITLISTED",
  "OFFERED", "ADMITTED", "DECLINED", "WITHDRAWN", "EXPIRED", "ARCHIVED"
] as const;
export const ADMISSION_DOCUMENT_TYPES = ["BIRTH_CERTIFICATE", "PREVIOUS_REPORT_CARD", "TRANSFER_CERTIFICATE"] as const;
const STAFF_INTAKE_ROLES = new Set(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN", "COMPUTER_OPERATOR"]);
const LEADERSHIP_ROLES = new Set(["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL"]);
const ACTIVE_APPLICATION = new Set(["APPLICATION_INVITED", "APPLICATION_IN_PROGRESS", "SUBMITTED", "UNDER_REVIEW", "WAITLISTED", "OFFERED"]);
const ENQUIRY_FIELDS = new Set(["guardianName", "contactMethod", "contactValue", "desiredAcademicYear", "desiredClass", "childName", "enquirySource", "message", "privacyNoticeVersion", "consentVersion", "consent", "honeypot", "requestKey"]);
const APPLICATION_FIELDS = new Set(["fullName", "dateOfBirth", "desiredAcademicYear", "desiredClass", "previousSchool", "previousClass", "guardians", "declarationVersion", "declarationAccepted", "expectedVersion"]);

export class AdmissionError extends Error {
  constructor(message: string, public status = 400, public code = "ADMISSION_REQUEST_INVALID") { super(message); }
}

export type PublicEnquiryInput = ReturnType<typeof validatePublicEnquiry>;

export async function publicAdmissionIntakeAvailable(client: PrismaClient, now = new Date()) {
  return await client.admissionEvent.count({ where: { eventType: "PUBLIC_ENQUIRY_ACCEPTED", eventDate: { gte: new Date(now.getTime() - 15 * 60_000) } } }) < 100;
}

export function validatePublicEnquiry(input: unknown) {
  const body = object(input);
  rejectUnknown(body, ENQUIRY_FIELDS);
  const contactMethod = oneOf(body.contactMethod, ["PHONE", "EMAIL"] as const, "Contact method");
  const contactValue = normalizedContact(contactMethod, body.contactValue);
  return {
    guardianName: text(body.guardianName, "Parent or Guardian name", 2, 100),
    contactMethod,
    contactValue,
    desiredAcademicYear: academicYear(body.desiredAcademicYear),
    desiredClass: text(body.desiredClass, "Desired class", 1, 40),
    childName: optionalText(body.childName, "Child name", 100),
    enquirySource: oneOf(body.enquirySource, ["WALK_IN", "PHONE", "WEBSITE", "REFERRAL", "OTHER"] as const, "Enquiry source"),
    boundedMessage: optionalText(body.message, "Message", 800),
    privacyNoticeVersion: text(body.privacyNoticeVersion, "Privacy notice version", 1, 40),
    consentVersion: text(body.consentVersion, "Consent version", 1, 40),
    consent: body.consent === true,
    honeypot: String(body.honeypot ?? "").trim(),
    requestKey: text(body.requestKey, "Request key", 12, 120)
  };
}

export async function createPublicEnquiry(client: PrismaClient, input: PublicEnquiryInput, requestEvidence: string) {
  if (input.honeypot || !input.consent) return { accepted: true };
  const requestHash = keyedHash(`public|${requestEvidence}`);
  const since = new Date(Date.now() - 15 * 60_000);
  const [recent, globalRecent] = await Promise.all([
    client.admissionEvent.count({ where: { requestHash, eventType: "PUBLIC_ENQUIRY_ACCEPTED", eventDate: { gte: since } } }),
    client.admissionEvent.count({ where: { eventType: "PUBLIC_ENQUIRY_ACCEPTED", eventDate: { gte: since } } })
  ]);
  if (recent >= 5 || globalRecent >= 100) return { accepted: true };
  const publicRequestHash = keyedHash([input.requestKey, input.contactMethod, input.contactValue, input.desiredAcademicYear, input.desiredClass].join("|"));
  const existing = await client.admissionEnquiry.findUnique({ where: { publicRequestHash }, select: { enquiryNumber: true } });
  if (existing) return { accepted: true };
  const now = new Date();
  const cycle = await client.admissionCycle.findFirst({ where: { academicYear: input.desiredAcademicYear, status: "OPEN", OR: [{ opensAt: null }, { opensAt: { lte: now } }], AND: [{ OR: [{ closesAt: null }, { closesAt: { gt: now } }] }] }, orderBy: { createdAt: "desc" } });
  await client.$transaction(async (tx) => {
    const enquiry = await tx.admissionEnquiry.create({ data: {
      enquiryNumber: admissionReference("ENQ"), cycleId: cycle?.id ?? null,
      guardianName: input.guardianName, contactMethod: input.contactMethod, contactValue: input.contactValue,
      contactHash: contactHash(input.contactMethod, input.contactValue), contactVerified: false,
      desiredAcademicYear: input.desiredAcademicYear, desiredClass: input.desiredClass, childName: input.childName,
      enquirySource: input.enquirySource, boundedMessage: input.boundedMessage,
      privacyNoticeVersion: input.privacyNoticeVersion, consentVersion: input.consentVersion, consentRecordedAt: now,
      intakeChannel: "PUBLIC_FORM", publicRequestHash,
      retentionReviewAt: addDays(now, cycle?.retentionReviewDays ?? 365)
    } });
    await tx.admissionEvent.create({ data: { enquiryId: enquiry.id, eventType: "PUBLIC_ENQUIRY_ACCEPTED", newStatus: "NEW", entityVersion: 1, safeMetadataJson: JSON.stringify({ source: input.enquirySource, academicYear: input.desiredAcademicYear, desiredClass: input.desiredClass }), requestHash } });
  });
  return { accepted: true };
}

export async function createStaffEnquiry(client: PrismaClient, body: unknown, actor: AuthUser) {
  if (!STAFF_INTAKE_ROLES.has(actor.role)) throw new AdmissionError("This role cannot create enquiries.", 403);
  const staffBody = object(body);
  const input = validatePublicEnquiry({ guardianName: staffBody.guardianName, contactMethod: staffBody.contactMethod, contactValue: staffBody.contactValue, desiredAcademicYear: staffBody.desiredAcademicYear, desiredClass: staffBody.desiredClass, childName: staffBody.childName, enquirySource: staffBody.enquirySource, message: staffBody.message, privacyNoticeVersion: staffBody.privacyNoticeVersion, consentVersion: staffBody.consentVersion, consent: true, honeypot: "", requestKey: staffBody.requestKey ?? randomUUID() });
  const now = new Date();
  const cycle = await cycleByKey(client, optionalText(staffBody.cycleKey, "Admission cycle", 80));
  return client.$transaction(async (tx) => {
    const enquiry = await tx.admissionEnquiry.create({ data: {
      enquiryNumber: admissionReference("ENQ"), cycleId: cycle?.id ?? null, guardianName: input.guardianName,
      contactMethod: input.contactMethod, contactValue: input.contactValue, contactHash: contactHash(input.contactMethod, input.contactValue),
      contactVerified: Boolean(staffBody.contactVerified), desiredAcademicYear: input.desiredAcademicYear, desiredClass: input.desiredClass,
      childName: input.childName, enquirySource: input.enquirySource, boundedMessage: input.boundedMessage,
      privacyNoticeVersion: input.privacyNoticeVersion, consentVersion: input.consentVersion, consentRecordedAt: now,
      intakeChannel: "STAFF", createdByUserId: actor.id, retentionReviewAt: addDays(now, cycle?.retentionReviewDays ?? 365)
    } });
    await event(tx, { enquiryId: enquiry.id, eventType: "ENQUIRY_CREATED", newStatus: "NEW", entityVersion: 1, actor });
    return safeEnquiry(enquiry, actor.role);
  });
}

export async function createAdmissionCycle(client: PrismaClient, body: unknown, actor: AuthUser) {
  if (!LEADERSHIP_ROLES.has(actor.role) && actor.role !== "ADMIN") throw new AdmissionError("This role cannot configure admission cycles.", 403);
  const input = object(body);
  const classes = stringList(input.enabledClasses, "Enabled classes", 40, 40);
  const documents = stringList(input.documentTypes, "Document types", 3, 40);
  for (const type of documents) if (!(ADMISSION_DOCUMENT_TYPES as readonly string[]).includes(type)) throw new AdmissionError("A document type is not approved.");
  const declarations = stringList(input.declarations, "Declarations", 20, 240);
  const padding = integer(input.admissionNumberPadding, "Admission number padding", 3, 10, 4);
  const applicationExpiryDays = integer(input.applicationExpiryDays, "Application expiry days", 1, 60, 14);
  const retentionReviewDays = integer(input.retentionReviewDays, "Retention review days", 30, 3650, 365);
  return client.admissionCycle.create({ data: {
    cycleCode: code(input.cycleCode, "Cycle code"), name: text(input.name, "Cycle name", 2, 120), academicYear: academicYear(input.academicYear),
    status: oneOf(input.status ?? "DRAFT", ["DRAFT", "OPEN", "CLOSED", "ARCHIVED"] as const, "Cycle status"),
    enabledClassesJson: JSON.stringify(classes), declarationsJson: JSON.stringify(declarations), documentTypesJson: JSON.stringify(documents),
    admissionNumberPrefix: code(input.admissionNumberPrefix, "Admission number prefix"), admissionNumberPadding: padding,
    applicationExpiryDays, retentionReviewDays, opensAt: optionalDate(input.opensAt, "Opening date"), closesAt: optionalDate(input.closesAt, "Closing date"), createdByUserId: actor.id
  }, select: { publicKey: true, cycleCode: true, name: true, academicYear: true, status: true, version: true } });
}

export async function listAdmissionsWorkspace(client: PrismaClient, actor: AuthUser, query: { status?: string; academicYear?: string } = {}) {
  if (actor.role === "VIEWER") throw new AdmissionError("Viewer access is aggregate-only.", 403);
  if (actor.role === "TEACHER") {
    const applications = await client.admissionApplication.findMany({ where: { reviews: { some: { reviewerUserId: actor.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } } }, ...(query.status ? { status: query.status } : {}) }, include: applicationSafeInclude, orderBy: { updatedAt: "desc" }, take: 100 });
    return { enquiries: [], applications: applications.map((row) => safeApplication({ ...row, reviews: row.reviews.filter((review) => review.reviewerUserId === actor.id) }, "TEACHER")), cycles: [] };
  }
  if (!STAFF_INTAKE_ROLES.has(actor.role)) throw new AdmissionError("This role cannot access admissions.", 403);
  const whereYear = query.academicYear ? { desiredAcademicYear: query.academicYear } : {};
  const [enquiries, applications, cycles] = await Promise.all([
    client.admissionEnquiry.findMany({ where: { ...whereYear, ...(query.status ? { status: query.status } : {}) }, include: { _count: { select: { followUps: true, visits: true, applications: true } } }, orderBy: [{ nextFollowUpAt: "asc" }, { createdAt: "desc" }], take: 200 }),
    actor.role === "COMPUTER_OPERATOR" ? [] : client.admissionApplication.findMany({ where: { ...(query.status ? { status: query.status } : {}), ...(query.academicYear ? { cycle: { academicYear: query.academicYear } } : {}) }, include: applicationSafeInclude, orderBy: { updatedAt: "desc" }, take: 200 }),
    client.admissionCycle.findMany({ where: query.academicYear ? { academicYear: query.academicYear } : {}, select: { publicKey: true, cycleCode: true, name: true, academicYear: true, status: true, enabledClassesJson: true, documentTypesJson: true, version: true }, orderBy: { createdAt: "desc" }, take: 50 })
  ]);
  return { enquiries: enquiries.map((row) => safeEnquiry(row, actor.role)), applications: applications.map((row) => safeApplication(row, actor.role)), cycles: cycles.map((row) => ({ ...row, enabledClasses: jsonArray(row.enabledClassesJson), documentTypes: jsonArray(row.documentTypesJson), enabledClassesJson: undefined, documentTypesJson: undefined })) };
}

export async function appendEnquiryInteraction(client: PrismaClient, enquiryKey: string, body: unknown, actor: AuthUser) {
  if (!STAFF_INTAKE_ROLES.has(actor.role)) throw new AdmissionError("This role cannot update enquiries.", 403);
  const input = object(body); const expectedVersion = integer(input.expectedVersion, "Expected version", 1, 1_000_000);
  const enquiry = await client.admissionEnquiry.findUnique({ where: { publicKey: safeKey(enquiryKey) } });
  if (!enquiry) throw new AdmissionError("Enquiry not found.", 404);
  const action = oneOf(input.action, ["FOLLOW_UP", "SCHEDULE_VISIT", "COMPLETE_VISIT", "ARCHIVE"] as const, "Action");
  const now = new Date();
  return client.$transaction(async (tx) => {
    const nextStatus = action === "SCHEDULE_VISIT" ? "VISIT_SCHEDULED" : action === "ARCHIVE" ? "ARCHIVED" : enquiry.status === "NEW" ? "CONTACTED" : enquiry.status;
    const changed = await tx.admissionEnquiry.updateMany({ where: { id: enquiry.id, rowVersion: expectedVersion }, data: { status: nextStatus, rowVersion: { increment: 1 }, nextFollowUpAt: optionalDate(input.nextFollowUpAt, "Next follow-up"), ...(action === "ARCHIVE" ? { archivedAt: now } : {}) } });
    if (changed.count !== 1) throw new AdmissionError("The enquiry changed. Refresh and review it.", 409, "STALE_VERSION");
    if (action === "FOLLOW_UP") await tx.enquiryFollowUp.create({ data: { enquiryId: enquiry.id, interactionType: oneOf(input.interactionType, ["PHONE", "EMAIL", "IN_PERSON", "OTHER"] as const, "Interaction type"), outcome: text(input.outcome, "Outcome", 2, 120), note: optionalText(input.note, "Follow-up note", 800), occurredAt: optionalDate(input.occurredAt, "Occurred at") ?? now, nextFollowUpAt: optionalDate(input.nextFollowUpAt, "Next follow-up"), recordedByUserId: actor.id } });
    if (action === "SCHEDULE_VISIT") await tx.schoolVisit.create({ data: { enquiryId: enquiry.id, scheduledAt: requiredDate(input.scheduledAt, "Visit time"), purpose: text(input.purpose, "Visit purpose", 2, 160), note: optionalText(input.note, "Visit note", 800), recordedByUserId: actor.id } });
    if (action === "COMPLETE_VISIT") { const visit = await tx.schoolVisit.findUnique({ where: { publicKey: safeKey(input.visitKey) } }); if (!visit || visit.enquiryId !== enquiry.id) throw new AdmissionError("Visit not found.", 404); const visitChanged = await tx.schoolVisit.updateMany({ where: { id: visit.id, rowVersion: integer(input.visitVersion, "Visit version", 1, 1_000_000), status: "SCHEDULED" }, data: { status: "COMPLETED", completedAt: now, rowVersion: { increment: 1 }, note: optionalText(input.note, "Visit note", 800) } }); if (visitChanged.count !== 1) throw new AdmissionError("The visit changed. Refresh and review it.", 409, "STALE_VERSION"); }
    await event(tx, { enquiryId: enquiry.id, eventType: action, previousStatus: enquiry.status, newStatus: nextStatus, entityVersion: expectedVersion + 1, actor, safeReason: optionalText(input.reason, "Reason", 400) });
    return { status: nextStatus, version: expectedVersion + 1 };
  });
}

export async function issueApplicationInvitation(client: PrismaClient, enquiryKey: string, body: unknown, actor: AuthUser) {
  if (!["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(actor.role)) throw new AdmissionError("This role cannot invite applications.", 403);
  const input = object(body); const enquiry = await client.admissionEnquiry.findUnique({ where: { publicKey: safeKey(enquiryKey) }, include: { cycle: true, applications: { where: { status: { in: [...ACTIVE_APPLICATION] } }, orderBy: { createdAt: "desc" }, take: 1 } } });
  if (!enquiry?.cycle || enquiry.cycle.status !== "OPEN") throw new AdmissionError("An open admission cycle is required.", 409);
  const token = randomBytes(32).toString("base64url"); const tokenHash = sha256(token); const now = new Date(); const expiresAt = addDays(now, enquiry.cycle.applicationExpiryDays);
  const row = await client.$transaction(async (tx) => {
    const application = enquiry.applications[0] ?? await tx.admissionApplication.create({ data: { applicationNumber: admissionReference("APP"), cycleId: enquiry.cycle!.id, enquiryId: enquiry.id, retentionReviewAt: addDays(now, enquiry.cycle!.retentionReviewDays), createdByUserId: actor.id } });
    const updated = await tx.admissionApplication.update({ where: { id: application.id }, data: { status: "APPLICATION_INVITED", invitationVersion: { increment: 1 }, invitationTokenHash: tokenHash, invitationExpiresAt: expiresAt, invitationUsedAt: null, invitationAttemptCount: 0, invitationResendCount: { increment: application.invitationVersion > 0 ? 1 : 0 }, invitationLastIssuedAt: now, rowVersion: { increment: 1 } } });
    await tx.admissionEnquiry.update({ where: { id: enquiry.id }, data: { status: "APPLICATION_INVITED", rowVersion: { increment: 1 } } });
    await event(tx, { applicationId: updated.id, enquiryId: enquiry.id, eventType: "APPLICATION_INVITATION_ISSUED", previousStatus: application.status, newStatus: "APPLICATION_INVITED", entityVersion: updated.rowVersion, actor, safeMetadata: { invitationVersion: updated.invitationVersion, expiresAt: expiresAt.toISOString(), delivery: "MANUAL_COPY_OR_LOCAL_QA_SINK" } });
    return updated;
  });
  return { applicationKey: row.publicKey, applicationNumber: row.applicationNumber, invitationToken: token, expiresAt: expiresAt.toISOString(), delivery: "Manual copy only; no message was sent." };
}

export async function loadInvitedApplication(client: PrismaClient, token: string) {
  const application = await invitedApplication(client, token, true);
  return applicantApplication(application);
}

export async function saveInvitedApplication(client: PrismaClient, token: string, body: unknown, submit = false) {
  const input = object(body); rejectUnknown(input, APPLICATION_FIELDS);
  const application = await invitedApplication(client, token, false);
  const expectedVersion = integer(input.expectedVersion, "Expected version", 1, 1_000_000);
  if (application.rowVersion !== expectedVersion) throw new AdmissionError("The application changed. Refresh it safely.", 409, "STALE_VERSION");
  const fullName = text(input.fullName, "Child full name", 2, 120); const dob = optionalDate(input.dateOfBirth, "Date of birth");
  if (dob && (dob > new Date() || dob < new Date("2000-01-01"))) throw new AdmissionError("Date of birth is outside the supported admission range.");
  const desiredAcademicYear = academicYear(input.desiredAcademicYear); const desiredClass = text(input.desiredClass, "Desired class", 1, 40);
  const enabledClasses = jsonArray(application.cycle.enabledClassesJson); if (!enabledClasses.includes(desiredClass)) throw new AdmissionError("The selected class is not enabled for this cycle.");
  const guardiansInput = Array.isArray(input.guardians) ? input.guardians : [];
  if (guardiansInput.length < 1 || guardiansInput.length > 4) throw new AdmissionError("Provide between one and four Guardian contacts.");
  const guardians = guardiansInput.map((raw, index) => { const row = object(raw); const method = oneOf(row.contactMethod, ["PHONE", "EMAIL"] as const, `Guardian ${index + 1} contact method`); return { displayName: text(row.displayName, `Guardian ${index + 1} name`, 2, 100), relationshipToChild: text(row.relationshipToChild, `Guardian ${index + 1} relationship`, 2, 60), contactMethod: method, contactValue: normalizedContact(method, row.contactValue), isPrimary: row.isPrimary === true }; });
  if (guardians.filter((row) => row.isPrimary).length !== 1) throw new AdmissionError("Select exactly one primary Guardian.");
  const declarationVersion = text(input.declarationVersion, "Declaration version", 1, 40); if (submit && input.declarationAccepted !== true) throw new AdmissionError("Accept the approved declarations before submission.");
  const now = new Date();
  return client.$transaction(async (tx) => {
    await tx.applicantChild.upsert({ where: { applicationId: application.id }, create: { applicationId: application.id, fullName, dateOfBirth: dob, desiredAcademicYear, desiredClass, previousSchool: optionalText(input.previousSchool, "Previous school", 120), previousClass: optionalText(input.previousClass, "Previous class", 40) }, update: { fullName, dateOfBirth: dob, desiredAcademicYear, desiredClass, previousSchool: optionalText(input.previousSchool, "Previous school", 120), previousClass: optionalText(input.previousClass, "Previous class", 40), version: { increment: 1 } } });
    await tx.prospectiveGuardian.deleteMany({ where: { applicationId: application.id } });
    await tx.prospectiveGuardian.createMany({ data: guardians.map((row) => ({ applicationId: application.id, ...row, contactHash: contactHash(row.contactMethod, row.contactValue) })) });
    const nextStatus = submit ? "SUBMITTED" : "APPLICATION_IN_PROGRESS";
    const changed = await tx.admissionApplication.updateMany({ where: { id: application.id, rowVersion: expectedVersion, invitationTokenHash: sha256(token), invitationUsedAt: null }, data: { status: nextStatus, rowVersion: { increment: 1 }, declarationVersion, declarationAcceptedAt: input.declarationAccepted === true ? now : null, ...(submit ? { submittedAt: now, invitationUsedAt: now, invitationTokenHash: null } : {}) } });
    if (changed.count !== 1) throw new AdmissionError("The application changed. Refresh it safely.", 409, "STALE_VERSION");
    const snapshot = JSON.stringify({ fullName, dateOfBirth: dob?.toISOString().slice(0, 10) ?? null, desiredAcademicYear, desiredClass, previousSchool: optionalText(input.previousSchool, "Previous school", 120), previousClass: optionalText(input.previousClass, "Previous class", 40), guardians, declarationVersion, declarationAccepted: input.declarationAccepted === true, status: nextStatus });
    await tx.admissionApplicationVersion.create({ data: { applicationId: application.id, versionNumber: expectedVersion + 1, source: submit ? "APPLICANT_SUBMISSION" : "APPLICANT_DRAFT", snapshotJson: snapshot, snapshotSha256: sha256(snapshot) } });
    await event(tx, { applicationId: application.id, enquiryId: application.enquiryId, eventType: submit ? "APPLICATION_SUBMITTED" : "APPLICATION_DRAFT_SAVED", previousStatus: application.status, newStatus: nextStatus, entityVersion: expectedVersion + 1, safeMetadata: { childFields: ["fullName", "dateOfBirth", "desiredAcademicYear", "desiredClass", "previousSchool", "previousClass"], guardianCount: guardians.length } });
    return { accepted: true, status: nextStatus, version: expectedVersion + 1 };
  });
}

export async function admissionCompleteness(client: PrismaClient, applicationKey: string) {
  const application = await client.admissionApplication.findUnique({ where: { publicKey: safeKey(applicationKey) }, include: { cycle: true, child: true, guardians: true, documents: { where: { status: { not: "REJECTED" } } } } });
  if (!application) throw new AdmissionError("Application not found.", 404);
  const requiredTypes = jsonArray(application.cycle.documentTypesJson); const uploaded = new Set(application.documents.map((row) => row.documentType));
  const checks = { child: Boolean(application.child?.fullName), desiredPlacement: Boolean(application.child?.desiredAcademicYear && application.child.desiredClass), guardian: application.guardians.length > 0 && application.guardians.some((row) => row.isPrimary), declarations: Boolean(application.declarationAcceptedAt), documents: requiredTypes.every((type) => uploaded.has(type)), recovery: application.documents.every((row) => row.recoveryStatus === "VERIFIED") };
  return { complete: Object.values(checks).every(Boolean), checks, requiredDocumentTypes: requiredTypes, uploadedDocumentTypes: [...uploaded] };
}

export async function reviewOrDecideApplication(client: PrismaClient, applicationKey: string, body: unknown, actor: AuthUser) {
  const input = object(body); const action = oneOf(input.action, ["ASSIGN_REVIEW", "SUBMIT_REVIEW", "REQUEST_INFORMATION", "START_REVIEW", "WAITLIST", "OFFER", "DECLINE", "WITHDRAW", "EXPIRE_OFFER", "FINAL_APPROVE"] as const, "Workflow action");
  const application = await client.admissionApplication.findUnique({ where: { publicKey: safeKey(applicationKey) }, include: { reviews: { orderBy: { reviewVersion: "desc" }, take: 1 }, offers: { orderBy: { offerVersion: "desc" }, take: 1 } } });
  if (!application) throw new AdmissionError("Application not found.", 404);
  const expectedVersion = integer(input.expectedVersion, "Expected version", 1, 1_000_000); if (application.rowVersion !== expectedVersion) throw new AdmissionError("The application changed. Refresh and review it.", 409, "STALE_VERSION");
  if (actor.role === "TEACHER") { const assigned = application.reviews[0]; if (action !== "SUBMIT_REVIEW" || !assigned || assigned.reviewerUserId !== actor.id || !["ASSIGNED", "IN_PROGRESS"].includes(assigned.status)) throw new AdmissionError("Teachers may submit only their exact assigned review.", 403); }
  if (["WAITLIST", "OFFER", "DECLINE", "EXPIRE_OFFER", "FINAL_APPROVE"].includes(action) && !LEADERSHIP_ROLES.has(actor.role)) throw new AdmissionError("Only authorised leadership may record this decision.", 403);
  const reason = text(input.reason, "Reason", 3, 800); const now = new Date();
  return client.$transaction(async (tx) => {
    let nextStatus = application.status;
    if (action === "ASSIGN_REVIEW") { if (!LEADERSHIP_ROLES.has(actor.role) && actor.role !== "ADMIN") throw new AdmissionError("This role cannot assign reviews.", 403); const reviewer = await tx.user.findUnique({ where: { iamPublicKey: safeKey(input.reviewerKey) }, select: { id: true, role: true, isActive: true } }); if (!reviewer?.isActive || !["TEACHER", "PRINCIPAL", "DIRECTOR", "ADMIN"].includes(reviewer.role)) throw new AdmissionError("Reviewer is unavailable."); await tx.applicationReview.create({ data: { applicationId: application.id, reviewVersion: (application.reviews[0]?.reviewVersion ?? 0) + 1, reviewerUserId: reviewer.id, assignmentType: text(input.assignmentType ?? "INTERVIEW", "Assignment type", 2, 60), visibility: oneOf(input.visibility ?? "ADMISSIONS_TEAM", ["LEADERSHIP", "ADMISSIONS_TEAM"] as const, "Visibility"), boundedNote: optionalText(input.note, "Review note", 1200) } }); nextStatus = "UNDER_REVIEW"; }
    else if (action === "SUBMIT_REVIEW") { const review = application.reviews[0]; if (!review) throw new AdmissionError("No review assignment exists.", 409); const updated = await tx.applicationReview.updateMany({ where: { id: review.id, reviewerUserId: actor.id, status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, data: { status: "SUBMITTED", boundedNote: optionalText(input.note, "Review note", 1200), completenessJson: JSON.stringify(object(input.completeness ?? {})), submittedAt: now } }); if (updated.count !== 1) throw new AdmissionError("The review assignment is unavailable.", 409); }
    else if (action === "REQUEST_INFORMATION") { nextStatus = "APPLICATION_IN_PROGRESS"; }
    else if (action === "START_REVIEW") { nextStatus = "UNDER_REVIEW"; }
    else if (action === "WAITLIST") { nextStatus = "WAITLISTED"; await decision(tx, application.id, "WAITLISTED", reason, actor.id, now); }
    else if (action === "OFFER") { const completeness = await admissionCompleteness(tx as unknown as PrismaClient, application.publicKey); if (!completeness.complete) throw new AdmissionError("Complete the application and secure-document recovery checks before offer.", 409); nextStatus = "OFFERED"; const expiry = requiredDate(input.expiresAt, "Offer expiry"); if (expiry <= now) throw new AdmissionError("Offer expiry must be in the future."); await tx.admissionOffer.create({ data: { applicationId: application.id, offerVersion: (application.offers[0]?.offerVersion ?? 0) + 1, offeredClass: text(input.offeredClass, "Offered class", 1, 40), academicYear: academicYear(input.academicYear), expiresAt: expiry, reason, actorUserId: actor.id, issuedAt: now } }); await decision(tx, application.id, "OFFERED", reason, actor.id, now); }
    else if (action === "DECLINE") { nextStatus = "DECLINED"; await decision(tx, application.id, "DECLINED", reason, actor.id, now); }
    else if (action === "WITHDRAW") { nextStatus = "WITHDRAWN"; await decision(tx, application.id, "WITHDRAWN", reason, actor.id, now); }
    else if (action === "EXPIRE_OFFER") { nextStatus = "EXPIRED"; await decision(tx, application.id, "OFFER_EXPIRED", reason, actor.id, now); }
    else if (action === "FINAL_APPROVE") { if (application.status !== "OFFERED") throw new AdmissionError("Only an offered application may receive final approval.", 409); nextStatus = "ADMITTED"; await decision(tx, application.id, "ADMIT", reason, actor.id, now); }
    const changed = await tx.admissionApplication.updateMany({ where: { id: application.id, rowVersion: expectedVersion }, data: { status: nextStatus, rowVersion: { increment: 1 }, ...(action === "REQUEST_INFORMATION" ? { requestedInfo: reason, requestedInfoAt: now } : {}), ...(action === "WITHDRAW" ? { withdrawnAt: now } : {}) } });
    if (changed.count !== 1) throw new AdmissionError("The application changed. Refresh and review it.", 409, "STALE_VERSION");
    await event(tx, { applicationId: application.id, enquiryId: application.enquiryId, eventType: action, previousStatus: application.status, newStatus: nextStatus, entityVersion: expectedVersion + 1, actor, safeReason: reason });
    return { status: nextStatus, version: expectedVersion + 1 };
  });
}

export async function duplicateSuggestions(client: PrismaClient, applicationKey: string) {
  const application = await client.admissionApplication.findUnique({ where: { publicKey: safeKey(applicationKey) }, include: { child: true, guardians: true, duplicateResolutions: true } });
  if (!application?.child) throw new AdmissionError("Application child details are incomplete.", 409);
  const guardianContacts = application.guardians.map((row) => row.contactValue);
  const guardians = await client.guardian.findMany({ where: { OR: [{ primaryMobile: { in: guardianContacts } }, { email: { in: guardianContacts } }] }, select: { id: true, displayName: true, primaryMobile: true, email: true, students: { select: { student: { select: { studentName: true, className: true, academicYear: true } } } } }, take: 20 });
  const students = await client.student.findMany({ where: { studentName: application.child.fullName, ...(application.child.dateOfBirth ? { dateOfBirth: application.child.dateOfBirth } : {}), deletedAt: null }, select: { id: true, studentName: true, dateOfBirth: true, className: true, academicYear: true, guardians: { select: { guardian: { select: { displayName: true } } } } }, take: 20 });
  const resolved = new Map(application.duplicateResolutions.map((row) => [`${row.candidateType}|${row.candidatePublicReference}`, row.resolution]));
  return {
    suggestions: [
      ...guardians.map((row) => ({ type: "GUARDIAN", reference: candidateReference("GUARDIAN", row.id), evidence: { name: row.displayName, contact: maskContact(row.primaryMobile || row.email || ""), linkedStudents: row.students.map((link) => ({ name: link.student.studentName, class: link.student.className, academicYear: link.student.academicYear })) }, resolution: resolved.get(`GUARDIAN|${candidateReference("GUARDIAN", row.id)}`) ?? null })),
      ...students.map((row) => ({ type: "STUDENT", reference: candidateReference("STUDENT", row.id), evidence: { name: row.studentName, dateOfBirth: row.dateOfBirth?.toISOString().slice(0, 10) ?? null, class: row.className, academicYear: row.academicYear, guardians: row.guardians.map((link) => link.guardian.displayName) }, resolution: resolved.get(`STUDENT|${candidateReference("STUDENT", row.id)}`) ?? null }))
    ], automaticMerge: false
  };
}

export async function resolveDuplicate(client: PrismaClient, applicationKey: string, body: unknown, actor: AuthUser) {
  if (!["SUPER_ADMIN", "DIRECTOR", "PRINCIPAL", "ADMIN"].includes(actor.role)) throw new AdmissionError("This role cannot resolve duplicates.", 403);
  const input = object(body); const application = await client.admissionApplication.findUnique({ where: { publicKey: safeKey(applicationKey) } }); if (!application) throw new AdmissionError("Application not found.", 404);
  const type = oneOf(input.candidateType, ["GUARDIAN", "STUDENT"] as const, "Candidate type"); const reference = text(input.candidateReference, "Candidate reference", 20, 100); const resolution = oneOf(input.resolution, ["LINK", "NOT_DUPLICATE", "BLOCK"] as const, "Resolution"); if (type === "STUDENT" && resolution === "LINK") throw new AdmissionError("Existing Students are never auto-linked by the admission conversion workflow.");
  const suggestions = await duplicateSuggestions(client, applicationKey); const candidate = suggestions.suggestions.find((row) => row.type === type && row.reference === reference); if (!candidate) throw new AdmissionError("Duplicate candidate is unavailable.", 404);
  return client.admissionDuplicateResolution.create({ data: { applicationId: application.id, candidateType: type, candidatePublicReference: reference, evidenceJson: JSON.stringify(candidate.evidence), resolution, reason: text(input.reason, "Resolution reason", 5, 800), actorUserId: actor.id, resolvedAt: new Date() }, select: { publicKey: true, candidateType: true, candidatePublicReference: true, resolution: true, reason: true, resolvedAt: true } });
}

export async function convertAdmission(client: PrismaClient, applicationKey: string, body: unknown, actor: AuthUser) {
  if (!LEADERSHIP_ROLES.has(actor.role)) throw new AdmissionError("Only authorised leadership may convert an admission.", 403);
  const input = object(body); const requestKey = text(input.requestKey, "Request key", 12, 120); const expectedVersion = integer(input.expectedVersion, "Expected version", 1, 1_000_000);
  const existing = await client.admissionConversion.findFirst({ where: { OR: [{ application: { publicKey: safeKey(applicationKey) } }, { requestKey }] } }); if (existing) return safeConversion(existing, true);
  try {
    return await client.$transaction(async (tx) => {
      const application = await tx.admissionApplication.findUnique({ where: { publicKey: safeKey(applicationKey) }, include: { cycle: true, child: true, guardians: true, decisions: { orderBy: { decisionVersion: "desc" }, take: 1 }, conversion: true, duplicateResolutions: true } });
      if (!application?.child || !application.guardians.length) throw new AdmissionError("Application details are incomplete.", 409);
      if (application.conversion) return safeConversion(application.conversion, true);
      if (application.status !== "ADMITTED" || application.decisions[0]?.decisionType !== "ADMIT") throw new AdmissionError("Only a final-approved application may convert.", 409);
      if (application.rowVersion !== expectedVersion) throw new AdmissionError("The application changed. Refresh and review it.", 409, "STALE_VERSION");
      const duplicates = await duplicateSuggestions(tx as unknown as PrismaClient, application.publicKey); const unresolved = duplicates.suggestions.filter((row) => !row.resolution); if (unresolved.length) throw new AdmissionError("Resolve every duplicate suggestion before conversion.", 409, "DUPLICATE_REVIEW_REQUIRED"); if (duplicates.suggestions.some((row) => row.type === "STUDENT" && row.resolution === "BLOCK")) throw new AdmissionError("A possible existing Student blocks conversion.", 409);
      const primary = application.guardians.find((row) => row.isPrimary)!; if (primary.contactMethod !== "PHONE") throw new AdmissionError("A verified primary phone contact is required before Student conversion.", 409);
      const cycleVersion = application.cycle.version; const serial = application.cycle.nextAdmissionNumber; const admissionNo = `${application.cycle.admissionNumberPrefix}${String(serial).padStart(application.cycle.admissionNumberPadding, "0")}`;
      const allocated = await tx.admissionCycle.updateMany({ where: { id: application.cycle.id, version: cycleVersion, nextAdmissionNumber: serial }, data: { nextAdmissionNumber: { increment: 1 }, version: { increment: 1 } } }); if (allocated.count !== 1) throw new AdmissionError("Admission number allocation changed. Retry after refresh.", 409, "ALLOCATION_CONFLICT");
      const guardianIds: string[] = []; const linkIds: string[] = [];
      for (const prospective of application.guardians) {
        const exact = await tx.guardian.findMany({ where: prospective.contactMethod === "PHONE" ? { primaryMobile: prospective.contactValue } : { email: prospective.contactValue }, take: 2 });
        let guardian = exact[0];
        if (guardian) { const ref = candidateReference("GUARDIAN", guardian.id); const resolution = application.duplicateResolutions.find((row) => row.candidateType === "GUARDIAN" && row.candidatePublicReference === ref); if (resolution?.resolution !== "LINK") throw new AdmissionError("Existing Guardian link requires an explicit LINK resolution.", 409); }
        else guardian = await tx.guardian.create({ data: { iamPublicKey: randomUUID(), displayName: prospective.displayName, primaryMobile: prospective.contactMethod === "PHONE" ? prospective.contactValue : "NOT_PROVIDED", email: prospective.contactMethod === "EMAIL" ? prospective.contactValue : null, relationship: prospective.relationshipToChild, status: "Active" } });
        guardianIds.push(guardian.id);
      }
      const student = await tx.student.create({ data: { academicYear: application.child.desiredAcademicYear, admissionNo, studentName: application.child.fullName, fatherName: primary.displayName, className: application.child.desiredClass, phone1: primary.contactValue, dateOfBirth: application.child.dateOfBirth, status: "Active" } });
      const enrollment = await tx.academicYearEnrollment.create({ data: { studentId: student.id, academicYear: application.child.desiredAcademicYear, className: application.child.desiredClass, status: "ACTIVE", enrollmentDate: new Date() } });
      for (let index = 0; index < guardianIds.length; index++) { const guardian = application.guardians[index]; const link = await tx.studentGuardian.create({ data: { guardianId: guardianIds[index], studentId: student.id, relationshipToStudent: guardian.relationshipToChild, isPrimaryContact: guardian.isPrimary, canViewFees: false, canReceiveReminders: false } }); linkIds.push(link.id); }
      let parentUserId: string | null = null;
      if (input.createParentAccount === true) { const username = await availableParentUsername(tx, admissionNo); const user = await tx.user.create({ data: { iamPublicKey: randomUUID(), name: primary.displayName, username, passwordHash: await hashPassword(randomBytes(48).toString("base64url")), role: "PARENT", guardianId: guardianIds[application.guardians.indexOf(primary)], isActive: false, lifecycleStatus: "PENDING_ACTIVATION", mustChangePassword: false } }); await tx.userRoleAssignment.create({ data: { publicKey: randomUUID(), userId: user.id, role: "PARENT", reason: "Admission conversion pending activation; activation requires a separate IAM workflow", assignedByUserId: actor.id, activeKey: `${user.id}:PARENT` } }); parentUserId = user.id; }
      const convertedAt = new Date(); const lineageHash = keyedHash([application.id, student.id, enrollment.id, admissionNo, ...guardianIds].join("|"));
      const conversion = await tx.admissionConversion.create({ data: { applicationId: application.id, requestKey, studentId: student.id, enrollmentId: enrollment.id, admissionNumber: admissionNo, guardianIdsJson: JSON.stringify(guardianIds), guardianLinkIdsJson: JSON.stringify(linkIds), parentUserId, actorUserId: actor.id, convertedAt, lineageHash } });
      const changed = await tx.admissionApplication.updateMany({ where: { id: application.id, rowVersion: expectedVersion }, data: { rowVersion: { increment: 1 } } }); if (changed.count !== 1) throw new AdmissionError("The application changed during conversion.", 409, "STALE_VERSION");
      await event(tx, { applicationId: application.id, enquiryId: application.enquiryId, eventType: "ADMISSION_CONVERTED", previousStatus: "ADMITTED", newStatus: "ADMITTED", entityVersion: expectedVersion + 1, actor, safeMetadata: { admissionNumber: maskAdmission(admissionNo), guardians: guardianIds.length, parentAccount: parentUserId ? "PENDING_ACTIVATION" : "NOT_CREATED", created: ["Student", "Guardian links", "Academic-year enrollment"], excluded: ["Payment", "Receipt", "Fee", "Address", "Location", "Transport"] } });
      return safeConversion(conversion, false);
    }, { timeout: 20_000 });
  } catch (error) {
    const found = await client.admissionConversion.findFirst({ where: { OR: [{ application: { publicKey: safeKey(applicationKey) } }, { requestKey }] } }); if (found) return safeConversion(found, true); throw error;
  }
}

export async function admissionReports(client: PrismaClient, actor: AuthUser) {
  const [enquiries, applications, events] = await Promise.all([client.admissionEnquiry.findMany({ select: { desiredAcademicYear: true, desiredClass: true, enquirySource: true, status: true, createdAt: true } }), client.admissionApplication.findMany({ select: { status: true, createdAt: true, conversion: { select: { convertedAt: true } } } }), client.admissionEvent.findMany({ where: { applicationId: { not: null }, previousStatus: { not: null }, newStatus: { not: null } }, select: { applicationId: true, previousStatus: true, newStatus: true, eventDate: true }, orderBy: { eventDate: "asc" } })]);
  const minimum = actor.role === "VIEWER" ? 3 : 1;
  return { suppressedMinimumGroupSize: minimum, classDemand: suppressedCounts(enquiries.map((row) => `${row.desiredAcademicYear} · ${row.desiredClass}`), minimum), sourceFunnel: suppressedCounts(enquiries.map((row) => row.enquirySource), minimum), enquiryStages: suppressedCounts(enquiries.map((row) => row.status), minimum), applicationStages: suppressedCounts(applications.map((row) => row.status), minimum), conversionTotal: applications.filter((row) => row.conversion).length, averageStageDurationHours: averageStageDurations(events, minimum), staffRanking: null };
}

export function admissionReportCsv(report: Awaited<ReturnType<typeof admissionReports>>) {
  const rows = [["Section", "Label", "Count"], ...report.classDemand.map((row) => ["Class demand", row.label, row.count]), ...report.sourceFunnel.map((row) => ["Source funnel", row.label, row.count]), ...report.enquiryStages.map((row) => ["Enquiry stage", row.label, row.count]), ...report.applicationStages.map((row) => ["Application stage", row.label, row.count]), ["Conversions", "Total", report.conversionTotal]];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export async function retentionPreview(client: PrismaClient, now = new Date()) {
  const [enquiries, applications, documents] = await Promise.all([client.admissionEnquiry.findMany({ where: { retentionReviewAt: { lte: now }, archivedAt: null }, select: { publicKey: true, enquiryNumber: true, status: true, retentionReviewAt: true }, take: 500 }), client.admissionApplication.findMany({ where: { retentionReviewAt: { lte: now }, archivedAt: null }, select: { publicKey: true, applicationNumber: true, status: true, retentionReviewAt: true }, take: 500 }), client.applicationDocument.findMany({ where: { retentionReviewAt: { lte: now } }, select: { publicKey: true, documentType: true, status: true, retentionReviewAt: true }, take: 500 })]);
  return { mode: "PREVIEW_ONLY", legalDurationConfigured: false, productionRequirements: ["Approved admissions privacy notice", "Approved retention policy", "Complaint route"], enquiries, applications, documents, actions: ["ARCHIVE_REVIEW", "ANONYMISATION_REVIEW", "DOCUMENT_DELETION_REVIEW"], hardDelete: false };
}

export function maskContact(value: string) { const text = String(value ?? ""); if (text.includes("@")) { const [name, domain] = text.split("@"); return `${name.slice(0, 1)}***@${domain}`; } const digits = text.replace(/\D/g, ""); return digits ? `******${digits.slice(-4)}` : "Not available"; }
export function maskAdmission(value: string) { return value.length <= 4 ? "****" : `${value.slice(0, 2)}***${value.slice(-2)}`; }
export function contactHash(method: string, value: string) { return keyedHash(`${method}|${normalizedContact(method, value)}`); }
export function candidateReference(type: string, id: string) { return keyedHash(`candidate|${type}|${id}`).slice(0, 32).toUpperCase(); }
export function safeKey(value: unknown) { const key = String(value ?? "").trim(); if (!/^[A-Za-z0-9_-]{8,100}$/.test(key)) throw new AdmissionError("The requested record is unavailable.", 404); return key; }

const applicationSafeInclude = { cycle: { select: { publicKey: true, name: true, academicYear: true } }, child: true, guardians: true, documents: { select: { publicKey: true, documentType: true, status: true, recoveryStatus: true, byteSize: true, reviewedAt: true } }, reviews: { select: { publicKey: true, reviewerUserId: true, assignmentType: true, visibility: true, status: true, submittedAt: true }, orderBy: { reviewVersion: "desc" as const }, take: 5 }, decisions: { select: { publicKey: true, decisionType: true, reasonCode: true, reason: true, decidedAt: true }, orderBy: { decisionVersion: "desc" as const }, take: 10 }, offers: { select: { publicKey: true, status: true, offeredClass: true, academicYear: true, expiresAt: true, issuedAt: true }, orderBy: { offerVersion: "desc" as const }, take: 5 }, conversion: { select: { publicKey: true, admissionNumber: true, convertedAt: true, parentUserId: true } }, _count: { select: { duplicateResolutions: true } } } as const;

async function invitedApplication(client: PrismaClient, token: string, incrementAttempt: boolean) {
  const raw = String(token ?? "").trim(); if (!/^[A-Za-z0-9_-]{40,100}$/.test(raw)) throw new AdmissionError("This invitation is unavailable or expired.", 404, "INVITATION_UNAVAILABLE");
  const hash = sha256(raw); const application = await client.admissionApplication.findUnique({ where: { invitationTokenHash: hash }, include: { cycle: true, child: true, guardians: true, documents: { select: { publicKey: true, documentType: true, status: true, recoveryStatus: true } } } });
  if (!application || application.invitationUsedAt || !application.invitationExpiresAt || application.invitationExpiresAt <= new Date() || application.invitationAttemptCount >= application.invitationAttemptLimit || !["APPLICATION_INVITED", "APPLICATION_IN_PROGRESS"].includes(application.status)) throw new AdmissionError("This invitation is unavailable or expired.", 404, "INVITATION_UNAVAILABLE");
  if (incrementAttempt) await client.admissionApplication.updateMany({ where: { id: application.id, invitationTokenHash: hash }, data: { invitationAttemptCount: { increment: 1 } } });
  return application;
}

function applicantApplication(row: Awaited<ReturnType<typeof invitedApplication>>) { return { applicationNumber: row.applicationNumber, status: row.status, version: row.rowVersion, expiresAt: row.invitationExpiresAt?.toISOString(), cycle: { name: row.cycle.name, academicYear: row.cycle.academicYear, enabledClasses: jsonArray(row.cycle.enabledClassesJson), declarations: jsonArray(row.cycle.declarationsJson), documentTypes: jsonArray(row.cycle.documentTypesJson) }, child: row.child ? { fullName: row.child.fullName, dateOfBirth: row.child.dateOfBirth?.toISOString().slice(0, 10) ?? null, desiredAcademicYear: row.child.desiredAcademicYear, desiredClass: row.child.desiredClass, previousSchool: row.child.previousSchool, previousClass: row.child.previousClass } : null, guardians: row.guardians.map((guardian) => ({ displayName: guardian.displayName, relationshipToChild: guardian.relationshipToChild, contactMethod: guardian.contactMethod, contactValue: guardian.contactValue, isPrimary: guardian.isPrimary })), documents: row.documents } }
function safeEnquiry(row: any, role: string) { return { key: row.publicKey, number: row.enquiryNumber, guardianName: role === "VIEWER" ? "Suppressed" : row.guardianName, contact: role === "COMPUTER_OPERATOR" || role === "ADMIN" || LEADERSHIP_ROLES.has(role) ? maskContact(row.contactValue) : "Suppressed", contactMethod: row.contactMethod, contactVerified: row.contactVerified, desiredAcademicYear: row.desiredAcademicYear, desiredClass: row.desiredClass, childName: role === "COMPUTER_OPERATOR" ? row.childName : row.childName, source: row.enquirySource, message: role === "COMPUTER_OPERATOR" ? null : row.boundedMessage, status: row.status, version: row.rowVersion, nextFollowUpAt: row.nextFollowUpAt?.toISOString() ?? null, createdAt: row.createdAt.toISOString(), counts: row._count ?? undefined } }
function safeApplication(row: any, role: string) { const teacher = role === "TEACHER"; return { key: row.publicKey, number: row.applicationNumber, status: row.status, version: row.rowVersion, cycle: row.cycle, child: row.child ? { name: row.child.fullName, dateOfBirth: teacher ? null : row.child.dateOfBirth?.toISOString().slice(0, 10) ?? null, academicYear: row.child.desiredAcademicYear, desiredClass: row.child.desiredClass, previousSchool: teacher ? null : row.child.previousSchool, previousClass: teacher ? null : row.child.previousClass } : null, guardians: teacher ? [] : row.guardians?.map((guardian: any) => ({ name: guardian.displayName, relationship: guardian.relationshipToChild, contact: maskContact(guardian.contactValue), primary: guardian.isPrimary })) ?? [], documents: row.documents ?? [], reviews: (row.reviews ?? []).map((review: any) => ({ key: review.publicKey, assignmentType: review.assignmentType, visibility: review.visibility, status: review.status, assignedToCurrentTeacher: teacher ? true : undefined })), decisions: teacher ? [] : row.decisions ?? [], offers: teacher ? [] : row.offers ?? [], converted: row.conversion ? { key: row.conversion.publicKey, admissionNumber: maskAdmission(row.conversion.admissionNumber), convertedAt: row.conversion.convertedAt } : null, duplicateResolutionCount: row._count?.duplicateResolutions ?? 0, updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt } }
function safeConversion(row: any, idempotent: boolean) { return { conversionKey: row.publicKey, admissionNumber: maskAdmission(row.admissionNumber), convertedAt: row.convertedAt.toISOString(), parentAccount: row.parentUserId ? "PENDING_ACTIVATION" : "NOT_CREATED", idempotent, created: ["Student", "Guardian relationship", "Academic-year enrollment"], excluded: ["Payment", "Receipt", "Fee", "Address", "Location", "Transport"] } }

async function decision(tx: Prisma.TransactionClient, applicationId: string, type: string, reason: string, actorUserId: string, now: Date) { const version = await tx.admissionDecision.count({ where: { applicationId } }) + 1; await tx.admissionDecision.create({ data: { applicationId, decisionVersion: version, decisionType: type, reasonCode: type, reason, actorUserId, decidedAt: now } }); }
async function event(tx: Prisma.TransactionClient, input: { applicationId?: string | null; enquiryId?: string | null; eventType: string; previousStatus?: string | null; newStatus?: string | null; entityVersion?: number; actor?: Pick<AuthUser, "id" | "role">; safeReason?: string | null; safeMetadata?: Record<string, unknown> }) { await tx.admissionEvent.create({ data: { applicationId: input.applicationId ?? null, enquiryId: input.enquiryId ?? null, eventType: input.eventType, previousStatus: input.previousStatus ?? null, newStatus: input.newStatus ?? null, entityVersion: input.entityVersion, actorUserId: input.actor?.id ?? null, actorRole: input.actor?.role ?? null, safeReason: input.safeReason ?? null, safeMetadataJson: input.safeMetadata ? JSON.stringify(input.safeMetadata) : null } }); }
async function cycleByKey(client: PrismaClient, key: string | null) { return key ? client.admissionCycle.findUnique({ where: { publicKey: safeKey(key) } }) : null; }
async function availableParentUsername(tx: Prisma.TransactionClient, admissionNo: string) { const base = `parent-${admissionNo}`.toLowerCase().replace(/[^a-z0-9._-]/g, "-").slice(0, 40); for (let index = 0; index < 20; index++) { const candidate = index ? `${base}-${index + 1}` : base; if (!await tx.user.findUnique({ where: { username: candidate }, select: { id: true } })) return candidate; } throw new AdmissionError("A pending Parent username could not be allocated.", 409); }

function averageStageDurations(events: Array<{ applicationId: string | null; previousStatus: string | null; newStatus: string | null; eventDate: Date }>, minimum: number) { const groups = new Map<string, number[]>(); const last = new Map<string, Date>(); for (const row of events) { if (!row.applicationId || !row.previousStatus || !row.newStatus) continue; const prior = last.get(row.applicationId); if (prior) { const key = `${row.previousStatus} → ${row.newStatus}`; const list = groups.get(key) ?? []; list.push((row.eventDate.getTime() - prior.getTime()) / 3_600_000); groups.set(key, list); } last.set(row.applicationId, row.eventDate); } return [...groups].map(([label, values]) => values.length < minimum ? { label, count: "Suppressed", averageHours: null } : { label, count: values.length, averageHours: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 }); }
function suppressedCounts(values: string[], minimum: number) { const map = new Map<string, number>(); for (const value of values) map.set(value, (map.get(value) ?? 0) + 1); return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, count]) => count < minimum ? { label, count: "Suppressed" as const } : { label, count }); }
function admissionReference(prefix: string) { return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(6).toString("hex").toUpperCase()}`; }
function admissionSecret() { const configured = process.env.ADMISSIONS_HASH_PEPPER?.trim() || process.env.SESSION_SECRET?.trim() || process.env.AUTH_SECRET?.trim(); if (configured && configured.length >= 32) return configured; if (process.env.NODE_ENV === "production") throw new AdmissionError("Admissions privacy hashing is not configured.", 503, "ADMISSIONS_SECRET_REQUIRED"); return sha256("nalanda-admissions-non-production-only-v1"); }
function keyedHash(value: string) { return createHmac("sha256", admissionSecret()).update(value).digest("hex"); }
function sha256(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }
function addDays(date: Date, days: number) { return new Date(date.getTime() + days * 86_400_000); }
function normalizedContact(method: string, value: unknown) { const raw = String(value ?? "").trim(); if (method === "PHONE") { const digits = raw.replace(/\D/g, ""); if (digits.length < 8 || digits.length > 15) throw new AdmissionError("Enter a valid phone number."); return digits; } const email = raw.toLowerCase(); if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdmissionError("Enter a valid email address."); return email; }
function academicYear(value: unknown) { const year = String(value ?? "").trim(); if (!/^20\d{2}-\d{2}$/.test(year)) throw new AdmissionError("Academic year must use YYYY-YY format."); return year; }
function code(value: unknown, label: string) { const result = String(value ?? "").trim().toUpperCase(); if (!/^[A-Z0-9][A-Z0-9_-]{1,39}$/.test(result)) throw new AdmissionError(`${label} is invalid.`); return result; }
function object(value: unknown): Record<string, any> { if (!value || typeof value !== "object" || Array.isArray(value)) throw new AdmissionError("A JSON object is required."); return value as Record<string, any>; }
function rejectUnknown(body: Record<string, unknown>, allowed: Set<string>) { const unknown = Object.keys(body).filter((key) => !allowed.has(key)); if (unknown.length) throw new AdmissionError(`Unsupported field: ${unknown[0]}.`); }
function text(value: unknown, label: string, min: number, max: number) { const result = String(value ?? "").trim(); if (result.length < min || result.length > max || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(result)) throw new AdmissionError(`${label} must contain ${min}-${max} safe characters.`); return result; }
function optionalText(value: unknown, label: string, max: number) { const result = String(value ?? "").trim(); return result ? text(result, label, 1, max) : null; }
function integer(value: unknown, label: string, min: number, max: number, fallback?: number) { if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback; const number = Number(value); if (!Number.isInteger(number) || number < min || number > max) throw new AdmissionError(`${label} must be between ${min} and ${max}.`); return number; }
function oneOf<const T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] { const result = String(value ?? "").trim().toUpperCase(); if (!allowed.includes(result as T[number])) throw new AdmissionError(`${label} is invalid.`); return result as T[number]; }
function optionalDate(value: unknown, label: string) { if (value === null || value === undefined || value === "") return null; return requiredDate(value, label); }
function requiredDate(value: unknown, label: string) { const date = new Date(String(value ?? "")); if (!Number.isFinite(date.getTime())) throw new AdmissionError(`${label} is invalid.`); return date; }
function stringList(value: unknown, label: string, maximum: number, itemMax: number) { if (!Array.isArray(value) || value.length > maximum) throw new AdmissionError(`${label} must contain no more than ${maximum} items.`); return [...new Set(value.map((item) => text(item, label, 1, itemMax).toUpperCase()))]; }
function jsonArray(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
function csvCell(value: unknown) { let text = String(value ?? ""); if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`; return `"${text.replaceAll('"', '""')}"`; }
