import Link from "next/link";
import { Prisma } from "@prisma/client";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ClassXDocumentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_CLASS_X_PACKAGES"), q = await searchParams, permissions = await getEffectivePermissions(prisma, user.role);
  const where: Prisma.ClassXDocumentPackageWhereInput = {};
  if (q.academicYear) where.academicYear = q.academicYear;
  if (q.status) where.status = q.status;
  if (q.paymentStatus) where.charge = { is: { status: q.paymentStatus } };
  if (q.requestSource) where.requestSource = q.requestSource;
  if (q.readiness === "READY") where.readyItems = { gt: 0 };
  if (q.readiness === "PENDING") where.readyItems = 0;
  const rows = await prisma.classXDocumentPackage.findMany({ where, include: { student: { select: { studentName: true, admissionNo: true } }, charge: { select: { status: true } } }, orderBy: { createdAt: "desc" } });
  return <PageShell className="class-x-page"><PageHeader title="Class X Document Packages" description="School certificates, external Board-document custody, service charges, and physical handover. The ERP does not issue Board certificates." action={permissionSetCan(permissions, "MANAGE_CLASS_X_PACKAGES") ? <Link className="button" href="/class-x-documents/new">Create Package</Link> : undefined} />
    <div className="page-actions">{permissionSetCan(permissions, "CONFIGURE_CLASS_X_PACKAGE_TEMPLATES") || permissionSetCan(permissions, "CONFIGURE_CLASS_X_PACKAGE_CHARGES") ? <Link className="button secondary" href="/class-x-documents/templates">Templates & Charges</Link> : null}{permissionSetCan(permissions, "VIEW_CLASS_X_PACKAGE_REPORTS") ? <Link className="button secondary" href="/class-x-documents/reports">Reports</Link> : null}</div>
    <div className="stats"><div className="card stat"><span>Matching packages</span><strong>{rows.length}</strong></div><div className="card stat"><span>Ready for handover</span><strong>{rows.filter((r) => r.readyItems > 0).length}</strong></div><div className="card stat"><span>Payment pending</span><strong>{rows.filter((r) => ["PENDING", "APPROVED_FOR_COLLECTION"].includes(r.charge?.status ?? "")).length}</strong></div><div className="card stat"><span>Completed</span><strong>{rows.filter((r) => r.status === "COMPLETED").length}</strong></div></div>
    <form className="card filter-grid"><label>Academic year<input name="academicYear" defaultValue={q.academicYear ?? ""} /></label><label>Status<select name="status" defaultValue={q.status ?? ""}><option value="">All</option>{["DRAFT","SUBMITTED","UNDER_REVIEW","DOCUMENTS_PENDING","PAYMENT_PENDING","READY_FOR_APPROVAL","APPROVED","READY_FOR_HANDOVER","PARTIALLY_HANDED_OVER","COMPLETED","CANCELLED"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Payment<select name="paymentStatus" defaultValue={q.paymentStatus ?? ""}><option value="">All</option>{["NOT_REQUIRED","PENDING","APPROVED_FOR_COLLECTION","PAID","WAIVED","CANCELLED"].map((v) => <option key={v}>{v}</option>)}</select></label><label>Readiness<select name="readiness" defaultValue={q.readiness ?? ""}><option value="">All</option><option value="READY">Has ready items</option><option value="PENDING">No ready items</option></select></label><label>Source<select name="requestSource" defaultValue={q.requestSource ?? ""}><option value="">All</option><option>INTERNAL</option><option>PARENT_PORTAL</option></select></label><button>Apply Filters</button></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Package</th><th>Student</th><th>Year / Source</th><th>Status</th><th>Payment</th><th>Ready / Handed</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/class-x-documents/${row.id}`}>{row.packageNumber}</Link></td><td>{row.student.studentName}<br/><small>{row.student.admissionNo}</small></td><td>{row.academicYear}<br/><small>{row.requestSource.replaceAll("_", " ")}</small></td><td><StatusBadge status={row.status} /></td><td><StatusBadge status={row.charge?.status ?? "NOT_REQUIRED"} /></td><td>{row.readyItems} / {row.handedOverItems}</td></tr>)}{!rows.length ? <tr><td colSpan={6}>No Class X packages match these filters.</td></tr> : null}</tbody></table></div></section>
    <p className="notice">Nalanda Public School must verify current Board and education-authority procedures. Service charges are school-configured operational charges unless separately and legally verified.</p>
  </PageShell>;
}
