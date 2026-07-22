import Link from "next/link";
import { ParentClassXRequestForm } from "@/components/class-x-package-forms";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { displayDate } from "@/lib/format";
import { getParentClassXPackages } from "@/lib/class-x-package-portals";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function ParentClassXDocumentsPage({ searchParams }: { searchParams: Promise<{ student?: string }> }) {
  const user = await requireRolePermission("VIEW_OWN_CHILD_CLASS_X_PACKAGE", "PARENT"), q = await searchParams;
  let accessWarning = "";
  let data;
  try {
    data = await getParentClassXPackages(prisma, user.id, q.student);
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "Linked child was not found") throw error;
    accessWarning = "The requested child is not linked to this Parent account. No package or Student information was shown.";
    data = await getParentClassXPackages(prisma, user.id);
  }
  const [templates, settings] = await Promise.all([prisma.classXPackageTemplate.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true }, orderBy: { name: "asc" } }), getSchoolSettings(prisma)]);
  return <PageShell className="class-x-page parent-class-x-page"><PageHeader title="Class X Documents" description="Request and track Class X document packages for linked children only." />
    {accessWarning ? <p className="alert danger" role="alert">{accessWarning}</p> : null}
    <div className="page-actions">{data.children.map((child) => <Link key={child.admissionNo} className="button secondary" href={`/parent/class-x-documents?student=${encodeURIComponent(child.admissionNo)}`}>{child.studentName}</Link>)}</div>
    {data.selectedChild ? <section className="card"><h3>{data.selectedChild.studentName}</h3><p>{data.selectedChild.admissionNo} · {data.selectedChild.className}{data.selectedChild.section ? `-${data.selectedChild.section}` : ""}</p><p>{data.eligible ? "A Class X enrollment/history is available for school review." : "No Class X enrollment/history is currently available. Contact the school."}</p>{data.eligible && templates.length ? <ParentClassXRequestForm childAdmissionNo={data.selectedChild.admissionNo} templates={templates} academicYear={settings.academicYear} /> : null}</section> : <p className="notice">No linked children are available.</p>}
    {data.packages.map((pkg: any) => <section className="card" key={pkg.packageNumber}><div className="section-title"><div><h3>{pkg.packageNumber}</h3><p>{pkg.academicYear} · {pkg.requestSource.replaceAll("_", " ")}</p></div><StatusBadge status={pkg.status} /></div><div className="table-wrap"><table><thead><tr><th>Required item</th><th>Safe status</th></tr></thead><tbody>{pkg.items.map((item: any) => <tr key={item.displayName}><td>{item.displayName}{item.required ? " *" : ""}</td><td>{item.status}</td></tr>)}</tbody></table></div><dl className="detail-grid"><div><dt>Payment</dt><dd>{pkg.charge?.status.replaceAll("_", " ") ?? "Not required"}</dd></div><div><dt>Receipt</dt><dd>{pkg.charge?.receiptNumber ?? "Not shared / not available"}</dd></div><div><dt>Ready for collection</dt><dd>{pkg.readyItems > 0 ? "Yes" : "Not yet"}</dd></div><div><dt>Handed over</dt><dd>{pkg.handedOverItems}</dd></div></dl>{pkg.handovers.map((h: any) => <p key={h.handoverNumber}>Handover recorded {displayDate(h.handoverDate)} · {h.recipientType.replaceAll("_", " ")}</p>)}</section>)}
    <p className="notice">The ERP tracks school actions and externally received physical Board documents. It does not issue or provide downloads of Board Marks Memos, Pass Certificates, or Migration Certificates.</p>
  </PageShell>;
}
