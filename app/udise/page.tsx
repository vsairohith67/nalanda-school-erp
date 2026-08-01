import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { loadUdiseChecklist } from "@/lib/udise-checklist";

export default async function UdisePage() {
  const user = await requirePermission("VIEW_UDISE_CHECKLIST");
  const [report, permissions] = await Promise.all([loadUdiseChecklist(prisma), getCurrentUserEffectivePermissions()]);
  const cards = [
    ["Active students checked", report.summary.activeStudentsChecked],
    ["Enrollments checked", report.summary.enrollmentsChecked],
    ["Lifecycle records checked", report.summary.lifecycleRecordsChecked],
    ["Students with missing basics", report.summary.studentsWithMissingBasics],
    ["Guardian / contact gaps", report.summary.guardianContactGaps],
    ["Staff records checked", report.summary.staffRecordsChecked],
    ["Fields not tracked in ERP", report.summary.fieldsNotTrackedInErp],
    ["Items needing school verification", report.summary.itemsNeedingSchoolVerification]
  ] as const;
  return <div className="page udise-page">
    <PageHeader title="UDISE+ Planning Checklist" description="Review possible reporting fields and ERP data gaps without changing school records." action={permissionSetCan(permissions, "EXPORT_UDISE_CHECKLIST") ? <a className="button" href="/api/udise/export">Export checklist CSV</a> : undefined} />
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning} No compliance or legal requirement is inferred by this dashboard.</span></div>
    <UdiseNav current="overview" />
    <section className="lifecycle-stats" aria-label="Checklist summary">
      {cards.map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    <section className="responsive-grid">
      {Object.entries(report.categoryCounts).map(([category, counts]) => <article className="card card-pad udise-category" key={category}>
        <h3>{category}</h3>
        <dl><div><dt>Complete</dt><dd>{counts.Complete}</dd></div><div><dt>Missing</dt><dd>{counts.Missing}</dd></div><div><dt>Not tracked</dt><dd>{counts["Not tracked in ERP"]}</dd></div><div><dt>Verify</dt><dd>{counts["Needs school verification"]}</dd></div><div><dt>Privacy caution</dt><dd>{counts["Sensitive/privacy caution"]}</dd></div></dl>
      </article>)}
    </section>
    <section className="card card-pad">
      <h3>Detailed reviews</h3>
      <div className="udise-quick-links"><Link href="/udise/students">Review student data gaps</Link><Link href="/udise/staff">Review staff data gaps</Link><Link href="/udise/summary">Open compact checklist summary</Link></div>
    </section>
  </div>;
}
