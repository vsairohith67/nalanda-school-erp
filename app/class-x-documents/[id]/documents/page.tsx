import { notFound } from "next/navigation";
import { DocumentItemActions } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function ClassXDocumentsCustodyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES"), id = (await params).id;
  const [row, canManage] = await Promise.all([prisma.classXDocumentPackage.findUnique({ where: { id }, include: { student: { select: { studentName: true, admissionNo: true } }, items: { orderBy: { displayOrder: "asc" } } } }), hasRolePermission(prisma, user.role, "MANAGE_CLASS_X_DOCUMENT_CUSTODY")]);
  if (!row) notFound();
  const certificates = await prisma.studentCertificate.findMany({ where: { studentId: row.studentId, status: "ISSUED" }, select: { id: true, certificateType: true, certificateNumber: true, currentVersionNumber: true }, orderBy: { issuedAt: "desc" } });
  return <PageShell className="class-x-page"><PageHeader title="Documents & Custody" description={`${row.packageNumber} · ${row.student.studentName}. Board documents are external physical records only.`} />
    <p className="notice"><strong>No Board document generation:</strong> this page cannot render, upload, imitate, or issue a Board Marks Memo, Pass Certificate, Migration Certificate, seal, emblem, hologram, signature, watermark, or security feature.</p>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Document</th><th>Issuer / Status</th><th>Reference policy</th><th>Action</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{item.displayName}<br/><small>{item.itemType}</small></td><td>{item.issuerType}<br/><StatusBadge status={item.status} /></td><td>{item.issuerType === "SCHOOL" ? "Prompt 18A immutable version" : item.serialNumberRequired ? "Configured reference required; staff-only" : "Reference optional; not Parent-visible"}</td><td><DocumentItemActions packageId={id} item={{ ...item, packageStudentId: row.studentId }} certificates={certificates} canManage={canManage} /></td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
