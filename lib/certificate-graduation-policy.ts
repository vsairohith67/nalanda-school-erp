import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { snapshotHash } from "@/lib/certificate-snapshots";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";

export const CERTIFICATE_GRADUATION_FEATURE = { key: "certificate-graduation-exit-1a", environment: "PRODUCTION", expectedVersion: 1, activationRole: "SUPER_ADMIN" } as const;
export const CERTIFICATE_BULK_FEATURE = { ...CERTIFICATE_GRADUATION_FEATURE, key: "certificate-bulk-issue-1a" } as const;
export const CERTIFICATE_VERIFICATION_FEATURE = { ...CERTIFICATE_GRADUATION_FEATURE, key: "certificate-verification-1a" } as const;
export { GRADUATION_DISCLAIMER } from "@/lib/certificate-templates";
export function assertGraduationEnabled(type: string) {
  if (String(type).toUpperCase() === "GRADUATION") assertOperationalReleaseFeature(CERTIFICATE_GRADUATION_FEATURE);
}

// Board-pass wording is deliberately unavailable until an approved result-evidence
// adapter is commissioned. Enrollment, PASSED_OUT and marks never imply Board success.
export async function graduationReadiness(client: any, studentId: string, academicYear: string) {
  const [student, enrollment, decisions] = await Promise.all([
    client.student.findFirst({ where: { id: studentId, deletedAt: null }, select: { id: true, studentName: true, admissionNo: true, updatedAt: true } }),
    client.academicYearEnrollment.findUnique({ where: { studentId_academicYear: { studentId, academicYear } } }),
    client.studentProgressionDecision.findMany({ where: { studentId, academicYear, status: "FINALIZED" }, orderBy: { finalizedAt: "desc" }, take: 3 })
  ]);
  const errors: string[] = [];
  if (!student) errors.push("Exact Student record is unavailable.");
  if (!enrollment || !["X", "10", "CLASS X", "CLASS 10", "10TH", "TENTH"].includes(enrollment.className.trim().toUpperCase())) errors.push("An exact Class X enrollment for the selected year is required.");
  const completion = decisions[0];
  if (!completion || completion.decisionType !== "PASSED_OUT" || !completion.finalizedByUserId || !completion.evidenceNotes?.trim() || completion.sourceEnrollmentId !== enrollment?.id) errors.push("A finalized, evidenced school-completion decision linked to this enrollment is required.");
  const values = { student, enrollment, completion: completion ?? null };
  return { ready: errors.length === 0, errors, targetHash: snapshotHash(values), values, boardPassClaim: false as const, boardEvidenceState: "BOARD_PASS_WORDING_UNAVAILABLE" };
}

export async function requireGraduationReadiness(client: any, studentId: string, academicYear: string, expectedHash?: string) {
  const readiness = await graduationReadiness(client, studentId, academicYear);
  if (!readiness.ready) throw new CertificateWorkflowError(readiness.errors.join(" "), 409);
  if (expectedHash && expectedHash !== readiness.targetHash) throw new CertificateWorkflowError("Reviewed Student/year evidence changed. Correct and review again.", 409);
  return readiness;
}

export function assertCertificateDocumentEnabled(type: string) {
  assertOperationalReleaseFeature(type === "GRADUATION" ? CERTIFICATE_GRADUATION_FEATURE : CERTIFICATE_VERIFICATION_FEATURE);
}
