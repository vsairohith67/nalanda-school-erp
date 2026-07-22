import type { PrismaClient } from "@prisma/client";
import type { AuthUser } from "@/lib/auth";
import { assertParentOwnsStudent, publicCertificateRequest } from "@/lib/certificate-scope";
import { parseCertificateSnapshot } from "@/lib/student-certificates";

export async function getParentCertificatePortal(client: PrismaClient, user: AuthUser, selectedStudentId?: string) {
  if (user.role !== "PARENT" || !user.guardianId) return { children: [], selectedChild: null, requests: [], certificates: [] };
  const links = await client.studentGuardian.findMany({ where: { guardianId: user.guardianId, student: { deletedAt: null } }, select: { student: { select: { id: true, studentName: true, admissionNo: true, className: true, section: true } } }, orderBy: { createdAt: "asc" } });
  const children = links.map(row => row.student), selectedChild = children.find(row => row.id === selectedStudentId) ?? children[0] ?? null;
  if (selectedStudentId && !children.some(row => row.id === selectedStudentId)) await assertParentOwnsStudent(client, user, selectedStudentId);
  if (!selectedChild) return { children, selectedChild, requests: [], certificates: [] };
  const [requests, certificates] = await Promise.all([
    (client as any).studentCertificateRequest.findMany({ where: { studentId: selectedChild.id, requestSource: "PARENT_PORTAL", applicantGuardianId: user.guardianId }, orderBy: { createdAt: "desc" } }),
    (client as any).studentCertificate.findMany({ where: { studentId: selectedChild.id, status: { in: ["ISSUED", "CANCELLED"] } }, orderBy: { issuedAt: "desc" } })
  ]);
  const safeCertificates = await Promise.all(certificates.map(async (row: any) => {
    const version = await (client as any).studentCertificateVersion.findFirst({ where: { certificateId: row.id, versionNumber: row.currentVersionNumber } });
    return version ? { certificateNumber: row.certificateNumber, certificateType: row.certificateType, status: row.status, issuedAt: row.issuedAt, versionNumber: version.versionNumber, snapshot: parseCertificateSnapshot(version.snapshotJson) } : null;
  }));
  return { children, selectedChild, requests: requests.map(publicCertificateRequest), certificates: safeCertificates.filter(Boolean) };
}
