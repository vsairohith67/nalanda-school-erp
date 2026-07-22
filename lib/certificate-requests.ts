import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { isCertificateType } from "@/lib/certificate-templates";

type Client = PrismaClient | Prisma.TransactionClient;
export class CertificateWorkflowError extends Error { constructor(message: string, public status = 400) { super(message); } }

export function validateRequestInput(input: any) {
  const purpose = String(input?.purpose ?? "").trim();
  const requestedCopies = Number(input?.requestedCopies ?? 1);
  if (!isCertificateType(input?.certificateType)) throw new CertificateWorkflowError("Choose a supported certificate type.");
  if (!purpose || purpose.length > 500) throw new CertificateWorkflowError("Purpose is required and must be at most 500 characters.");
  if (!Number.isInteger(requestedCopies) || requestedCopies < 1 || requestedCopies > 3) throw new CertificateWorkflowError("Requested copies must be from 1 to 3.");
  return { studentId: String(input.studentId ?? ""), academicYear: String(input.academicYear ?? "2026-27"), certificateType: String(input.certificateType), purpose, requestedCopies, urgency: input.urgency === "URGENT" ? "URGENT" : "NORMAL" };
}

export async function createCertificateRequest(client: Client, input: any, actor: { id: string; guardianId?: string | null; source?: "INTERNAL" | "PARENT_PORTAL" }) {
  const data = validateRequestInput(input);
  if (!data.studentId) throw new CertificateWorkflowError("Student is required.");
  if (actor.source === "PARENT_PORTAL") {
    if (!actor.guardianId) throw new CertificateWorkflowError("Parent account is not linked to a Guardian.", 403);
    const owned = await (client as any).studentGuardian.findUnique({ where: { guardianId_studentId: { guardianId: actor.guardianId, studentId: data.studentId } } });
    if (!owned) throw new CertificateWorkflowError("The selected Student is not linked to this Parent account.", 403);
  }
  const requestNumber = `CR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const row = await (client as any).studentCertificateRequest.create({ data: { ...data, requestNumber, requestSource: actor.source ?? "INTERNAL", status: "SUBMITTED", applicantGuardianId: actor.source === "PARENT_PORTAL" ? actor.guardianId : null, createdByUserId: actor.id, submittedAt: new Date() } });
  await (client as any).studentCertificateEvent.create({ data: { requestId: row.id, eventType: "REQUEST_CREATED", newStatus: "SUBMITTED", recordedByUserId: actor.id } });
  return row;
}

const REQUEST_TRANSITIONS: Record<string, { from: string[]; to: string; event: string; reason?: boolean }> = {
  review: { from: ["SUBMITTED"], to: "UNDER_REVIEW", event: "REQUEST_REVIEWED" },
  approve: { from: ["UNDER_REVIEW"], to: "APPROVED", event: "REQUEST_APPROVED" },
  reject: { from: ["SUBMITTED", "UNDER_REVIEW"], to: "REJECTED", event: "REQUEST_REJECTED", reason: true },
  cancel: { from: ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED"], to: "CANCELLED", event: "REQUEST_CANCELLED", reason: true }
};

export async function transitionCertificateRequest(client: Client, id: string, action: string, actorId: string, expectedUpdatedAt?: string, reason?: string) {
  const rule = REQUEST_TRANSITIONS[action]; if (!rule) throw new CertificateWorkflowError("Unsupported request action.");
  if (rule.reason && !String(reason ?? "").trim()) throw new CertificateWorkflowError("A reason is required.");
  const row = await (client as any).studentCertificateRequest.findUnique({ where: { id } }); if (!row) throw new CertificateWorkflowError("Certificate request not found.", 404);
  if (!rule.from.includes(row.status)) throw new CertificateWorkflowError(`Request cannot ${action} from ${row.status}.`, 409);
  if (expectedUpdatedAt && row.updatedAt.toISOString() !== expectedUpdatedAt) throw new CertificateWorkflowError("Request changed since it was opened. Refresh and retry.", 409);
  const now = new Date(), actorField = action === "approve" ? "approvedByUserId" : action === "reject" ? "rejectedByUserId" : action === "cancel" ? "cancelledByUserId" : "reviewedByUserId";
  const timeField = action === "approve" ? "approvedAt" : action === "reject" ? "rejectedAt" : action === "cancel" ? "cancelledAt" : "reviewedAt";
  const reasonField = action === "reject" ? "rejectionReason" : action === "cancel" ? "cancellationReason" : "reviewNotes";
  const result = await (client as any).studentCertificateRequest.updateMany({ where: { id, status: row.status, updatedAt: row.updatedAt }, data: { status: rule.to, [actorField]: actorId, [timeField]: now, ...(reason ? { [reasonField]: String(reason).trim() } : {}) } });
  if (result.count !== 1) throw new CertificateWorkflowError("Request was changed by another user. Refresh and retry.", 409);
  await (client as any).studentCertificateEvent.create({ data: { requestId: id, eventType: rule.event, previousStatus: row.status, newStatus: rule.to, reason: reason || null, recordedByUserId: actorId } });
  return (client as any).studentCertificateRequest.findUnique({ where: { id } });
}
