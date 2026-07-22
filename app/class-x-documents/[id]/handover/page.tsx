import Link from "next/link";
import { notFound } from "next/navigation";
import { HandoverForm } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function ClassXHandoverPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES"), id = (await params).id;
  const [row, canHandover] = await Promise.all([prisma.classXDocumentPackage.findUnique({ where: { id }, include: { student: { select: { studentName: true, admissionNo: true } }, items: { orderBy: { displayOrder: "asc" } }, charge: true, handovers: { orderBy: { handoverDate: "desc" } } } }), hasRolePermission(prisma, user.role, "HANDOVER_CLASS_X_DOCUMENTS")]);
  if (!row) notFound();
  const ready = row.items.filter((item) => item.status === "READY_FOR_HANDOVER").map((item) => ({ id: item.id, displayName: item.displayName, issuerType: item.issuerType }));
  return <PageShell className="class-x-page"><PageHeader title="Physical Document Handover" description={`${row.packageNumber} · ${row.student.studentName}`} action={<StatusBadge status={row.status} />} />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Document</th><th>Issuer</th><th>Status</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{item.displayName}</td><td>{item.issuerType}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></section>
    {canHandover ? <HandoverForm packageId={id} items={ready} /> : <p className="notice">Your role can view handover history but cannot record custody release.</p>}
    <section className="card"><h3>Immutable handovers</h3><div className="table-wrap"><table><thead><tr><th>Number</th><th>Date</th><th>Recipient</th><th>Acknowledgment</th></tr></thead><tbody>{row.handovers.map((h) => <tr key={h.id}><td><Link href={`/class-x-documents/${id}/handover/${h.id}/print`}>{h.handoverNumber}</Link></td><td>{displayDate(h.handoverDate)}</td><td>{h.recipientType.replaceAll("_", " ")}</td><td>Operational record; physical signature print available</td></tr>)}{!row.handovers.length ? <tr><td colSpan={4}>No handover recorded.</td></tr> : null}</tbody></table></div></section>
  </PageShell>;
}
