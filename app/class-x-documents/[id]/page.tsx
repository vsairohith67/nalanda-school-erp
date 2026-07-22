import Link from "next/link";
import { notFound } from "next/navigation";
import { PackageWorkflowActions } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { parseClassXSnapshot } from "@/lib/class-x-document-packages";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ClassXPackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES"), id = (await params).id;
  const [row, permissions] = await Promise.all([prisma.classXDocumentPackage.findUnique({ where: { id }, include: { student: { select: { studentName: true, admissionNo: true, className: true, section: true, status: true } }, items: { orderBy: { displayOrder: "asc" } }, charge: { include: { linkedMiscIncomeReceipt: { select: { receiptNumber: true, status: true } } } }, handovers: { orderBy: { handoverDate: "desc" } }, events: { orderBy: { eventDate: "desc" } } } }), getEffectivePermissions(prisma, user.role)]);
  if (!row) notFound();
  const eligibility = parseClassXSnapshot(row.eligibilitySnapshotJson), template = parseClassXSnapshot(row.templateSnapshotJson);
  const flags = { manage: permissionSetCan(permissions, "MANAGE_CLASS_X_PACKAGES"), review: permissionSetCan(permissions, "REVIEW_CLASS_X_PACKAGES"), approve: permissionSetCan(permissions, "APPROVE_CLASS_X_PACKAGES"), handover: permissionSetCan(permissions, "HANDOVER_CLASS_X_DOCUMENTS") };
  return <PageShell className="class-x-page"><PageHeader title={row.packageNumber} description={`${row.student.studentName} · ${row.student.admissionNo} · Class X package`} action={<StatusBadge status={row.status} />} />
    <div className="page-actions"><Link className="button secondary" href={`/class-x-documents/${id}/documents`}>Documents & Custody</Link><Link className="button secondary" href={`/class-x-documents/${id}/payment`}>Payment</Link><Link className="button secondary" href={`/class-x-documents/${id}/handover`}>Handover</Link></div>
    <div className="stats"><div className="card stat"><span>Required items</span><strong>{row.totalRequiredItems}</strong></div><div className="card stat"><span>Ready</span><strong>{row.readyItems}</strong></div><div className="card stat"><span>Handed over</span><strong>{row.handedOverItems}</strong></div><div className="card stat"><span>Payment</span><strong>{row.charge?.status.replaceAll("_", " ") ?? "Not required"}</strong></div></div>
    <section className="card"><h3>Student eligibility/source snapshot</h3><dl className="detail-grid"><div><dt>Student</dt><dd>{eligibility.student?.studentName}</dd></div><div><dt>Admission number</dt><dd>{eligibility.student?.admissionNo}</dd></div><div><dt>Class X source</dt><dd>{eligibility.classXEnrollment?.className} · {eligibility.classXEnrollment?.academicYear} · {eligibility.classXEnrollment?.status}</dd></div><div><dt>Current lifecycle</dt><dd>{eligibility.student?.lifecycleStatus}</dd></div><div><dt>Source basis</dt><dd>Exact academic-year Class X enrollment</dd></div><div><dt>Board eligibility claimed</dt><dd>{String(eligibility.boardEligibilityClaimed)}</dd></div></dl>{eligibility.warnings?.map((warning: string) => <p className="notice" key={warning}>{warning}</p>)}</section>
    <section className="card"><h3>Snapshotted template</h3><p>{template.name} · version {template.versionNumber} · {template.schoolBoard || "Board not hard-coded"}</p><p>{template.instructions || "No additional configured instructions."}</p></section>
    <PackageWorkflowActions id={id} status={row.status} updatedAt={row.updatedAt.toISOString()} permissions={flags} />
    <section className="card"><h3>Checklist</h3><div className="table-wrap"><table><thead><tr><th>Document</th><th>Issuer</th><th>Required</th><th>Status</th></tr></thead><tbody>{row.items.map((item) => <tr key={item.id}><td>{item.displayName}</td><td>{item.issuerType}</td><td>{item.required ? "Yes" : "Optional"}</td><td><StatusBadge status={item.status} /></td></tr>)}</tbody></table></div></section>
    <section className="card"><h3>Physical handover history</h3><div className="table-wrap"><table><thead><tr><th>Number</th><th>Date</th><th>Recipient type</th><th>Print</th></tr></thead><tbody>{row.handovers.map((h) => <tr key={h.id}><td>{h.handoverNumber}</td><td>{displayDate(h.handoverDate)}</td><td>{h.recipientType.replaceAll("_", " ")}</td><td><Link href={`/class-x-documents/${id}/handover/${h.id}/print`}>A4 acknowledgment</Link></td></tr>)}{!row.handovers.length ? <tr><td colSpan={4}>No handover recorded.</td></tr> : null}</tbody></table></div></section>
    <section className="card"><h3>Append-only package events</h3><div className="table-wrap"><table><thead><tr><th>Date</th><th>Event</th><th>Status</th><th>Reason / note</th></tr></thead><tbody>{row.events.map((e) => <tr key={e.id}><td>{displayDate(e.eventDate)}</td><td>{e.eventType.replaceAll("_", " ")}</td><td>{e.previousStatus ?? "—"} → {e.newStatus ?? "—"}</td><td>{e.reason ?? e.notes ?? "—"}</td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
