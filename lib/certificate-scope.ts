import type { AuthUser } from "@/lib/auth";
import { CertificateWorkflowError } from "@/lib/certificate-requests";

export async function assertParentOwnsStudent(client: any, user: AuthUser, studentId: string) {
  if (user.role !== "PARENT" || !user.guardianId) throw new CertificateWorkflowError("Parent certificate access is unavailable.", 403);
  const link = await client.studentGuardian.findUnique({ where: { guardianId_studentId: { guardianId: user.guardianId, studentId } } });
  if (!link) throw new CertificateWorkflowError("This Student is not linked to the Parent account.", 403);
  return link;
}

export function publicCertificateRequest(row: any) {
  return { requestNumber: row.requestNumber, academicYear: row.academicYear, certificateType: row.certificateType, purpose: row.purpose, requestedCopies: row.requestedCopies, urgency: row.urgency, status: row.status, publicNotes: row.publicNotes, rejectionReason: row.rejectionReason, cancellationReason: row.cancellationReason, submittedAt: row.submittedAt, completedAt: row.completedAt };
}
