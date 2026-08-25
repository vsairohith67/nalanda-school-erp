import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { UdiseStatusBadge } from "@/components/udise-status-badge";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStaff, loadUdiseChecklist, UDISE_STAFF_ROW_LIMIT } from "@/lib/udise-checklist";

export default async function UdiseStaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_UDISE_MASKED_ROWS");
  const search = await searchParams;
  const report = await loadUdiseChecklist(prisma, { staff: { staffType: search.staffType, status: search.status } });
  const rows = filterUdiseStaff(report.staff, { staffType: search.staffType, status: search.status, gapType: search.gapType }).slice(0, UDISE_STAFF_ROW_LIMIT);
  const types = [...new Set(report.staff.map((row) => row.staffType))].sort();
  const statuses = [...new Set(report.staff.map((row) => row.recordStatus))].sort();
  return <div className="page udise-page">
    <PageHeader title="Masked Staff Data-gap Report" description="Bounded, read-only availability statuses. Names, contact values, addresses, identifiers and demographic values are not displayed." />
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning}</span></div>
    {report.limits.staffRowsTruncated ? <div className="notice-warning udise-warning"><strong>Bounded Staff result</strong><span>{report.limits.staffRowsLoaded} of {report.limits.staffRowsMatched} server-filtered candidates were reviewed. Refine the fixed filters before relying on this internal checklist.</span></div> : null}
    <UdiseNav current="staff" />
    <form className="card card-pad filters udise-filters"><label>Staff type<select name="staffType" defaultValue={search.staffType ?? ""}><option value="">All types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select name="status" defaultValue={search.status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>Gap type<select name="gapType" defaultValue={search.gapType ?? ""}><option value="">All gap types</option><option value="staff-code">Staff code</option><option value="mobile">Mobile</option><option value="email">Email</option><option value="qualification">Qualification</option><option value="not-tracked">Not tracked</option></select></label><button>Apply filters</button></form>
    <section className="card"><div className="section-title"><h3>{rows.length} masked Staff records</h3><span className="muted">Maximum {UDISE_STAFF_ROW_LIMIT}</span></div><div className="table-wrap udise-table-wrap"><table><thead><tr><th>Opaque row</th><th>Masked Staff ref.</th><th>Safe type</th><th>ERP status</th><th>Mobile</th><th>Email</th><th>Qualification</th><th>Demographics</th><th>Attendance foundation</th><th>Leave foundation</th><th>Gaps</th></tr></thead><tbody>{rows.map((row) => <tr key={row.rowReference}><td>{row.rowReference}</td><td>{row.maskedStaffReference}</td><td>{row.staffType}</td><td>{row.recordStatus}</td><td><UdiseStatusBadge status={row.mobileStatus} /></td><td><UdiseStatusBadge status={row.emailStatus} /></td><td><UdiseStatusBadge status={row.qualificationStatus} /></td><td><UdiseStatusBadge status={row.demographicStatus} /></td><td>Internal ERP foundation - not official UDISE completeness evidence</td><td>Internal ERP foundation - not official UDISE completeness evidence</td><td>{row.gapCount}</td></tr>)}{!rows.length ? <tr><td colSpan={11}>No masked Staff records match the selected filters.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
