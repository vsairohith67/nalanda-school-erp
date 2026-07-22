import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStaff, loadUdiseChecklist, type ChecklistStatus } from "@/lib/udise-checklist";

function badge(status: ChecklistStatus) {
  return <span className={`badge ${status === "Complete" ? "success" : status === "Missing" ? "danger" : "warn"}`}>{status}</span>;
}

export default async function UdiseStaffPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const [report, search] = await Promise.all([loadUdiseChecklist(prisma), searchParams]);
  const rows = filterUdiseStaff(report.staff, { staffType: search.staffType, status: search.status, gapType: search.gapType });
  const types = [...new Set(report.staff.map((row) => row.staffType))].sort();
  const statuses = [...new Set(report.staff.map((row) => row.status))].sort();
  return <div className="page udise-page">
    <PageHeader title="Staff Data-gap Report" description="Read-only availability checks from StaffMember fields. Contact values and internal IDs are not displayed." />
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning}</span></div>
    <UdiseNav current="staff" />
    <form className="card card-pad filters udise-filters"><label>Staff type<select name="staffType" defaultValue={search.staffType ?? ""}><option value="">All types</option>{types.map((value) => <option key={value}>{value}</option>)}</select></label><label>Status<select name="status" defaultValue={search.status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label>Gap type<select name="gapType" defaultValue={search.gapType ?? ""}><option value="">All gap types</option><option value="staff-code">Staff code</option><option value="mobile">Mobile</option><option value="email">Email</option><option value="qualification">Qualification</option><option value="not-tracked">Not tracked</option></select></label><button>Apply filters</button></form>
    <section className="card"><div className="section-title"><h3>{rows.length} staff records</h3></div><div className="table-wrap udise-table-wrap"><table><thead><tr><th>Staff code</th><th>Name</th><th>Type</th><th>Designation</th><th>Status</th><th>Mobile</th><th>Email</th><th>Qualification</th><th>Demographics</th><th>Attendance foundation</th><th>Leave foundation</th><th>Gaps</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.staffCode}-${row.staffName}-${index}`}><td>{row.staffCode}</td><td>{row.staffName}</td><td>{row.staffType}</td><td>{row.designation}</td><td>{row.status}</td><td>{badge(row.mobileStatus)}</td><td>{badge(row.emailStatus)}</td><td>{badge(row.qualificationStatus)}</td><td>{badge(row.demographicStatus)}</td><td>{row.attendanceFoundation}</td><td>{row.leaveFoundation}</td><td>{row.gapCount}</td></tr>)}{!rows.length ? <tr><td colSpan={12}>No staff records match the selected filters.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
