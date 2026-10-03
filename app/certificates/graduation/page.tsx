import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { CertificateGraduationWorkspace } from "@/components/certificate-graduation-workspace";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CERTIFICATE_GRADUATION_FEATURE } from "@/lib/certificate-graduation-policy";
import { isOperationalReleaseFeatureEnabled } from "@/lib/release-feature-flag-runtime";

export default async function GraduationPage() {
  await requirePermission("VIEW_CERTIFICATES");
  if (!isOperationalReleaseFeatureEnabled(CERTIFICATE_GRADUATION_FEATURE)) notFound();
  const [permissions, students, templates, requests, certificates, batches] = await Promise.all([
    getCurrentUserEffectivePermissions(),
    prisma.student.findMany({ where: { deletedAt: null }, select: { id: true, studentName: true, admissionNo: true }, orderBy: { studentName: "asc" }, take: 500 }),
    prisma.certificateTemplate.findMany({ where: { certificateType: "GRADUATION" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.studentCertificateRequest.findMany({ where: { certificateType: "GRADUATION" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.studentCertificate.findMany({ where: { certificateType: "GRADUATION" }, orderBy: { createdAt: "desc" }, take: 100 }),
    prisma.certificateBulkBatch.findMany({ orderBy: { createdAt: "desc" }, take: 30, select: { id: true, status: true, createdAt: true } })
  ]);
  return <div className="page"><PageHeader title="Graduation Certificates" description="Review school completion, optional charges and institutional recognition. Board-pass claims are unavailable." />
    <CertificateGraduationWorkspace data={JSON.parse(JSON.stringify({ students, templates, requests, certificates, batches }))} permissions={[...permissions]} />
  </div>;
}
