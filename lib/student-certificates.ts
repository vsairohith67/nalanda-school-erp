import { isOperationalReleaseFeatureEnabled } from "@/lib/release-feature-flag-runtime";
import { CERTIFICATE_VERIFICATION_FEATURE } from "@/lib/certificate-graduation-policy";
import { withDatabaseRetry } from "@/lib/database-retry";
import { assertGraduationEnabled, requireGraduationReadiness } from "@/lib/certificate-graduation-policy";
import { certificateChargeProof } from "@/lib/certificate-charges";
import { getSchoolSettings } from "@/lib/school-settings";
import { newCertificateToken, renderCertificatePdf, sha256Bytes } from "@/lib/certificate-pdf";
import type { Prisma, PrismaClient } from "@prisma/client";
import { allocateCertificateNumber } from "@/lib/certificate-numbering";
import { buildCertificateSourceSnapshot, snapshotHash } from "@/lib/certificate-snapshots";
import { isCertificateType, validateCertificateTemplateDefinition } from "@/lib/certificate-templates";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { normalizeAcademicYear } from "@/lib/format";

type Client = PrismaClient | Prisma.TransactionClient;
function reviewedIssueDate(value: unknown) {
  const date = String(value ?? new Date().toISOString().slice(0, 10));
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new CertificateWorkflowError("Choose a valid reviewed issue date in YYYY-MM-DD format.");
  return date;
}


export async function createStudentCertificateDraft(client: Client, input: any, actorId: string): Promise<any> {
  input = { ...input, certificateType: String(input?.certificateType).toUpperCase() };
  assertGraduationEnabled(input.certificateType);
  if (input?.certificateType === "GRADUATION" && "$transaction" in client) return (client as PrismaClient).$transaction(tx => createStudentCertificateDraft(tx, input, actorId), { isolationLevel: "Serializable" });
  if (!isCertificateType(input?.certificateType)) throw new CertificateWorkflowError("Choose a supported certificate type.");
  const studentId = String(input.studentId ?? ""), templateId = String(input.templateId ?? ""), issuePurpose = String(input.issuePurpose ?? input.purpose ?? "").trim();
  let academicYear: string;
  try { academicYear = normalizeAcademicYear(input.academicYear ?? "2026-27"); }
  catch { throw new CertificateWorkflowError("Academic year must use consecutive YYYY-YY format."); }
  if (!studentId || !templateId || !issuePurpose) throw new CertificateWorkflowError("Student, active template, and purpose are required.");
  if (input.certificateType === "GRADUATION" && input.requestId) {
    const existing = await (client as any).studentCertificate.findUnique({where:{workflowKey:`graduation:${input.requestId}`}});
    if (existing) {
      if (existing.studentId !== studentId || existing.academicYear !== academicYear || existing.templateId !== templateId || existing.issuePurpose !== issuePurpose) throw new CertificateWorkflowError("Repeated request conflicts with the retained certificate.",409);
      return existing;
    }
  }
  const template = await (client as any).certificateTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.status !== "ACTIVE" || template.certificateType !== input.certificateType) throw new CertificateWorkflowError("Choose an active template for this certificate type.");
  validateCertificateTemplateDefinition(template.certificateType, JSON.parse(template.templateDefinitionJson));
  const snapshot = await buildCertificateSourceSnapshot(client, studentId, academicYear, input.certificateType, issuePurpose);
  const requestId = String(input.requestId ?? "") || null;
  if (requestId) {
    const request = await (client as any).studentCertificateRequest.findUnique({ where: { id: requestId } });
    if (!request || request.status !== "APPROVED" || request.studentId !== studentId || request.certificateType !== input.certificateType || request.academicYear !== academicYear) throw new CertificateWorkflowError("The approved request does not match this certificate draft.", 409);
  }
  if (input.certificateType === "GRADUATION" && (input.publicNotes || input.reviewedOverrides)) throw new CertificateWorkflowError("Correct authoritative records; Graduation public notes and factual overrides are unavailable.");
  const workflowKey = input.certificateType === "GRADUATION" ? `graduation:${requestId}` : null;
  if (input.certificateType === "GRADUATION" && !requestId) throw new CertificateWorkflowError("An approved exact-year Graduation request is required.", 409);
  if (workflowKey) {
    const prior = await (client as any).studentCertificate.findUnique({ where: { workflowKey } });
    if (prior) {
      if (prior.studentId !== studentId || prior.academicYear !== academicYear || prior.templateId !== templateId) throw new CertificateWorkflowError("Idempotency key is bound to different reviewed values.", 409);
      return prior;
    }
  }
  const readiness = input.certificateType === "GRADUATION" ? await requireGraduationReadiness(client, studentId, academicYear) : null;
  const settings = (client as any).schoolSettings ? await getSchoolSettings(client as any) : null;
  const pinned = { ...snapshot, documentIssueDate: reviewedIssueDate(input.issueDate), ...(readiness ? { graduation: { targetHash: readiness.targetHash, boardPassClaim: false, completionDecisionId: readiness.values.completion.id } } : {}), template: { code: template.templateCode, versionNumber: template.versionNumber, definition: validateCertificateTemplateDefinition(template.certificateType, JSON.parse(template.templateDefinitionJson)) }, school: settings ? { name: settings.schoolName, issuePlace: String(input.issuePlace ?? settings.city).trim().slice(0, 150) } : null };
  const row = await (client as any).studentCertificate.create({ data: { workflowKey, requestId, studentId, academicYear, certificateType: input.certificateType, templateId, draftDataJson: JSON.stringify(pinned), issuePurpose, internalNotes: String(input.internalNotes ?? "").trim() || null, publicNotes: String(input.publicNotes ?? "").trim() || null, createdByUserId: actorId } });
  await (client as any).studentCertificateEvent.create({ data: { requestId, certificateId: row.id, eventType: "CERTIFICATE_CREATED", newStatus: "DRAFT", recordedByUserId: actorId } });
  return row;
}

export function parseCertificateSnapshot(value: string) { try { return JSON.parse(value); } catch { throw new CertificateWorkflowError("Certificate snapshot is invalid.", 500); } }

export async function updateCertificateDraft(client: Client, id: string, input: any, actorId: string) {
  const row = await (client as any).studentCertificate.findUnique({ where: { id } }); if (!row) throw new CertificateWorkflowError("Certificate not found.", 404);
  assertGraduationEnabled(row.certificateType);
  if (row.status !== "DRAFT") throw new CertificateWorkflowError("Only a draft certificate can be edited.", 409);
  if (input.expectedUpdatedAt && row.updatedAt.toISOString() !== input.expectedUpdatedAt) throw new CertificateWorkflowError("Certificate changed since it was opened.", 409);
  const purpose = String(input.issuePurpose ?? row.issuePurpose).trim(); if (!purpose) throw new CertificateWorkflowError("Purpose is required.");
  const hasReviewedOverrides = input.reviewedOverrides && typeof input.reviewedOverrides === "object" && Object.keys(input.reviewedOverrides).length > 0;
  const overrideReason = String(input.overrideReason ?? "").trim();
  if (hasReviewedOverrides && !overrideReason) throw new CertificateWorkflowError("A reviewed manual override reason is required.");
  if (row.certificateType === "GRADUATION" && (hasReviewedOverrides || input.publicNotes)) throw new CertificateWorkflowError("Correct authoritative records before Graduation review; manual factual overrides and public notes are unavailable.");
  const priorSnapshot = parseCertificateSnapshot(row.draftDataJson);
  const readiness = row.certificateType === "GRADUATION" ? await requireGraduationReadiness(client, row.studentId, row.academicYear) : null;
  const fresh = await buildCertificateSourceSnapshot(client, row.studentId, row.academicYear, row.certificateType, purpose);
  const result = await (client as any).studentCertificate.updateMany({ where: { id, status: "DRAFT", updatedAt: row.updatedAt }, data: { issuePurpose: purpose, draftDataJson: JSON.stringify({ ...priorSnapshot, ...fresh, ...(input.issueDate ? { documentIssueDate: reviewedIssueDate(input.issueDate) } : {}), ...(input.issuePlace ? { school: { ...priorSnapshot.school, issuePlace: String(input.issuePlace).trim().slice(0, 150) } } : {}), ...(readiness ? { graduation: { ...priorSnapshot.graduation, targetHash: readiness.targetHash, completionDecisionId: readiness.values.completion.id } } : {}), ...(hasReviewedOverrides ? { reviewedOverrides: input.reviewedOverrides, overrideReason } : {}) }), publicNotes: String(input.publicNotes ?? "").trim() || null } });
  if (result.count !== 1) throw new CertificateWorkflowError("Certificate changed concurrently.", 409);
  await (client as any).studentCertificateEvent.create({ data: { certificateId: id, eventType: hasReviewedOverrides ? "CERTIFICATE_SOURCE_OVERRIDDEN" : "CERTIFICATE_UPDATED", reason: hasReviewedOverrides ? overrideReason : null, recordedByUserId: actorId } });
  return (client as any).studentCertificate.findUnique({ where: { id } });
}

export async function transitionCertificate(client: Client, id: string, action: "submit" | "approve", actorId: string, expectedUpdatedAt?: string): Promise<any> {
  if ("$transaction" in client) return (client as PrismaClient).$transaction(tx => transitionCertificate(tx, id, action, actorId, expectedUpdatedAt), { isolationLevel: "Serializable" });
  const row = await (client as any).studentCertificate.findUnique({ where: { id } }); if (!row) throw new CertificateWorkflowError("Certificate not found.", 404);
  assertGraduationEnabled(row.certificateType);
  if (row.certificateType === "GRADUATION") {
    if (action === "approve" && [row.createdByUserId, row.submittedByUserId].includes(actorId)) throw new CertificateWorkflowError("A different authorized reviewer must approve this certificate.", 403);
    const snapshot = parseCertificateSnapshot(row.draftDataJson);
    await requireGraduationReadiness(client, row.studentId, row.academicYear, snapshot.graduation?.targetHash);
    await certificateChargeProof(client, row.requestId, row.studentId, row.academicYear);
  }
  const rule = action === "submit" ? { from: "DRAFT", to: "READY_FOR_REVIEW", event: "CERTIFICATE_SUBMITTED", actor: "submittedByUserId", at: "submittedAt" } : { from: "READY_FOR_REVIEW", to: "APPROVED", event: "CERTIFICATE_APPROVED", actor: "approvedByUserId", at: "approvedAt" };
  if (row.status !== rule.from) throw new CertificateWorkflowError(`Certificate cannot ${action} from ${row.status}.`, 409);
  if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new CertificateWorkflowError("Certificate changed since it was opened.", 409);
  const result = await (client as any).studentCertificate.updateMany({ where: { id, status: rule.from, updatedAt: row.updatedAt }, data: { status: rule.to, [rule.actor]: actorId, [rule.at]: new Date() } });
  if (result.count !== 1) throw new CertificateWorkflowError("Certificate changed concurrently.", 409);
  await (client as any).studentCertificateEvent.create({ data: { certificateId: id, eventType: rule.event, previousStatus: rule.from, newStatus: rule.to, recordedByUserId: actorId } });
  return (client as any).studentCertificate.findUnique({ where: { id } });
}

export async function issueCertificate(prisma: PrismaClient, id: string, actorId: string, options: { expectedUpdatedAt?: string; activeEnrollmentReason?: string } = {}) {
  return withDatabaseRetry(() => prisma.$transaction(async (tx) => {
    const row = await (tx as any).studentCertificate.findUnique({ where: { id } }); if (!row) throw new CertificateWorkflowError("Certificate not found.", 404);
    assertGraduationEnabled(row.certificateType);
    if (row.status === "ISSUED") return row;
    if (row.status !== "APPROVED") throw new CertificateWorkflowError("Only an approved certificate can be issued.", 409);
    if (options.expectedUpdatedAt && row.updatedAt.toISOString() !== options.expectedUpdatedAt) throw new CertificateWorkflowError("Certificate changed since it was opened.", 409);
    if (row.certificateType === "GRADUATION") {
      const request = await (tx as any).studentCertificateRequest.findUnique({ where: { id: row.requestId } });
      if (!request || request.studentId !== row.studentId || request.academicYear !== row.academicYear || request.certificateType !== row.certificateType || (request.status !== "APPROVED" && !(row.supersedesCertificateId && request.status === "COMPLETED"))) throw new CertificateWorkflowError("The request is no longer approved for this issue.", 409);
    }
    const source = parseCertificateSnapshot(row.draftDataJson);
    if (row.certificateType === "TRANSFER" && source.currentEnrollment?.status === "ACTIVE" && !String(options.activeEnrollmentReason ?? "").trim()) throw new CertificateWorkflowError("Director or Principal must record an explicit reason before issuing a TC while enrollment remains active.");
    const template = await (tx as any).certificateTemplate.findUnique({ where: { id: row.templateId } }); if (!template || template.status !== "ACTIVE") throw new CertificateWorkflowError("The certificate template is inactive.", 409);
    const templateSnapshot = validateCertificateTemplateDefinition(template.certificateType, JSON.parse(template.templateDefinitionJson));
    if (source.template && snapshotHash(source.template.definition) !== snapshotHash(templateSnapshot)) throw new CertificateWorkflowError("Template differs from reviewed content. Create a new draft.", 409);
    const charge = row.certificateType === "GRADUATION" ? await certificateChargeProof(tx, row.requestId, row.studentId, row.academicYear) : null;
    if (row.certificateType === "GRADUATION") {
      if (!row.approvedByUserId || row.approvedByUserId === row.createdByUserId) throw new CertificateWorkflowError("Independent approval is required.", 403);
      await requireGraduationReadiness(tx, row.studentId, row.academicYear, source.graduation?.targetHash);
    }
    const settings = source.school ? null : await getSchoolSettings(tx);
    const allocation = await allocateCertificateNumber(tx, row.certificateType, row.academicYear);
    const now = new Date();
    const snapshot = { ...source, school: source.school ?? { name: settings!.schoolName, issuePlace: settings!.city }, approval: { approvedBy: row.approvedByUserId, approvedAt: row.approvedAt, preparedBy: row.createdByUserId, issuedBy: actorId }, charge, certificateNumber: allocation.certificateNumber, issueDate: source.documentIssueDate ?? now, issueStatus: "ISSUED", versionLabel: "ORIGINAL", template: { code: template.templateCode, versionNumber: template.versionNumber, definition: templateSnapshot }, publicNotes: row.publicNotes, activeEnrollmentIssueReason: row.certificateType === "TRANSFER" ? String(options.activeEnrollmentReason ?? "").trim() || null : null, digitalSignature: false };
    const token = row.certificateType === "GRADUATION" || isOperationalReleaseFeatureEnabled(CERTIFICATE_VERIFICATION_FEATURE) ? newCertificateToken() : null;
    const artifact = token ? await renderCertificatePdf(snapshot, "ISSUED", token) : null;
    const parentVersion = row.supersedesCertificateId ? await (tx as any).studentCertificateVersion.findFirst({ where: { certificateId: row.supersedesCertificateId }, orderBy: { versionNumber: "desc" } }) : null;
    const version = await (tx as any).studentCertificateVersion.create({ data: { supersedesVersionId: parentVersion?.id ?? null, certificateId: id, versionNumber: 1, versionType: source.revisionKind ?? "ORIGINAL", certificateNumber: allocation.certificateNumber, snapshotJson: JSON.stringify(snapshot), issuedAt: now, issuedByUserId: actorId, snapshotHash: snapshotHash(snapshot) } });
    if (artifact && token) await (tx as any).certificateIssueArtifact.create({ data: { versionId: version.id, certificateId: id, tokenHash: sha256Bytes(token), pdfBase64: artifact.pdf.toString("base64"), pdfHash: artifact.pdfHash, snapshotHash: snapshotHash(snapshot), renderProvenanceJson: JSON.stringify({ fontFamily: "Georgia Bold", fontHash: artifact.fontHash, rendererVersion: artifact.rendererVersion, pages: artifact.pages }), expiresAt: new Date("9999-12-31T23:59:59.000Z") } });
    const changed = await (tx as any).studentCertificate.updateMany({ where: { id, status: "APPROVED", updatedAt: row.updatedAt }, data: { status: "ISSUED", certificateNumber: allocation.certificateNumber, currentVersionNumber: 1, issuedAt: now, issuedByUserId: actorId } });
    if (changed.count !== 1) throw new CertificateWorkflowError("Certificate changed concurrently.", 409);
    if (row.requestId) await (tx as any).studentCertificateRequest.updateMany({ where: { id: row.requestId, status: "APPROVED" }, data: { status: "COMPLETED", completedAt: now } });
    await (tx as any).studentCertificateEvent.create({ data: { requestId: row.requestId, certificateId: id, versionId: version.id, eventType: "CERTIFICATE_ISSUED", previousStatus: "APPROVED", newStatus: "ISSUED", reason: options.activeEnrollmentReason || null, recordedByUserId: actorId } });
    return (tx as any).studentCertificate.findUnique({ where: { id } });
  }, { timeout: 30000, isolationLevel: "Serializable" }));
}

export async function createCertificateVersion(prisma: PrismaClient, id: string, kind: "CORRECTION" | "REISSUE", actorId: string, reason: string) {
  if (!String(reason).trim()) throw new CertificateWorkflowError(`${kind === "CORRECTION" ? "Correction" : "Reissue"} reason is required.`);
  return prisma.$transaction(async tx => {
    const row = await (tx as any).studentCertificate.findUnique({ where: { id } }); if (!row || row.status !== "ISSUED" || !row.certificateNumber) throw new CertificateWorkflowError("Only an issued certificate can be corrected or reissued.", 409);
    assertGraduationEnabled(row.certificateType);
    if (row.certificateType === "GRADUATION" || isOperationalReleaseFeatureEnabled(CERTIFICATE_VERIFICATION_FEATURE)) {
      const workflowKey = `graduation-revision:${id}`;
      const existing = await (tx as any).studentCertificate.findUnique({ where: { workflowKey } });
      if (existing) { const prior = parseCertificateSnapshot(existing.draftDataJson); if (prior.revisionKind !== kind || prior.revisionReason !== reason.trim()) throw new CertificateWorkflowError("Existing revision has a different purpose; inspect its history.", 409); return existing; }
      const priorSnapshot = parseCertificateSnapshot(row.draftDataJson);
      const readiness = row.certificateType === "GRADUATION" ? await requireGraduationReadiness(tx, row.studentId, row.academicYear) : null;
      const source = await buildCertificateSourceSnapshot(tx, row.studentId, row.academicYear, row.certificateType, row.issuePurpose);
      const draftDataJson = JSON.stringify({ ...priorSnapshot, ...source, ...(readiness ? { graduation: { ...priorSnapshot.graduation, targetHash: readiness.targetHash, completionDecisionId: readiness.values.completion.id } } : {}), revisionKind: kind, revisionReason: reason.trim(), supersedesCertificateId: id });
      return (tx as any).studentCertificate.create({ data: { workflowKey, supersedesCertificateId: id, requestId: row.requestId, studentId: row.studentId, academicYear: row.academicYear, certificateType: row.certificateType, templateId: row.templateId, draftDataJson, issuePurpose: row.issuePurpose, createdByUserId: actorId } });
    }
    const prior = await (tx as any).studentCertificateVersion.findFirst({ where: { certificateId: id }, orderBy: { versionNumber: "desc" } }); if (!prior) throw new CertificateWorkflowError("Issued version history is missing.", 409);
    const next = prior.versionNumber + 1, base = parseCertificateSnapshot(prior.snapshotJson);
    const snapshot = { ...base, versionLabel: kind === "CORRECTION" ? "CORRECTED VERSION" : "REISSUED", issueStatus: "ISSUED", revision: next, revisionReason: String(reason).trim() };
    const version = await (tx as any).studentCertificateVersion.create({ data: { certificateId: id, versionNumber: next, versionType: kind, certificateNumber: row.certificateNumber, snapshotJson: JSON.stringify(snapshot), [kind === "CORRECTION" ? "correctionReason" : "reissueReason"]: String(reason).trim(), issuedAt: new Date(), issuedByUserId: actorId, supersedesVersionId: prior.id, snapshotHash: snapshotHash(snapshot) } });
    await (tx as any).studentCertificate.update({ where: { id }, data: { currentVersionNumber: next } });
    await (tx as any).studentCertificateEvent.create({ data: { certificateId: id, versionId: version.id, eventType: kind === "CORRECTION" ? "CERTIFICATE_CORRECTED" : "CERTIFICATE_REISSUED", reason: String(reason).trim(), recordedByUserId: actorId } });
    return version;
  });
}

export async function cancelIssuedCertificate(client: Client, id: string, actorId: string, reason: string) {
  if (!String(reason).trim()) throw new CertificateWorkflowError("Cancellation reason is required.");
  const row = await (client as any).studentCertificate.findUnique({ where: { id } }); if (!row || row.status !== "ISSUED") throw new CertificateWorkflowError("Only an issued certificate can be cancelled.", 409);
  assertGraduationEnabled(row.certificateType);
  const result = await (client as any).studentCertificate.updateMany({ where: { id, status: "ISSUED", updatedAt: row.updatedAt }, data: { status: "CANCELLED", cancellationReason: String(reason).trim(), cancelledAt: new Date(), cancelledByUserId: actorId } });
  if (result.count !== 1) throw new CertificateWorkflowError("Certificate changed concurrently.", 409);
  await (client as any).studentCertificateEvent.create({ data: { certificateId: id, eventType: "CERTIFICATE_CANCELLED", previousStatus: "ISSUED", newStatus: "CANCELLED", reason: String(reason).trim(), recordedByUserId: actorId } });
  return (client as any).studentCertificate.findUnique({ where: { id } });
}
