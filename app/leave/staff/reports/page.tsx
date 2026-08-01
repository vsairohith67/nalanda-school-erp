import Link from "next/link";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { leaveDate, leaveLabel, localLeaveDateText, staffLeaveReportData, STAFF_LEAVE_TYPES } from "@/lib/staff-leave";
import { permissionSetCan } from "@/lib/role-permissions";
import { PageHeader } from "@/components/ui";

export default async function StaffLeaveReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_STAFF_LEAVE_REPORTS");
  const [sp, permissions] = await Promise.all([searchParams, getCurrentUserEffectivePermissions()]);
  const canViewRequests = permissionSetCan(permissions, "VIEW_STAFF_LEAVE");
  const today = localLeaveDateText();
  const from = sp.from || `${today.slice(0, 8)}01`;
  const to = sp.to || today;
  const [data, staff] = await Promise.all([
    staffLeaveReportData(prisma, { from: leaveDate(from), to: leaveDate(to), staffMemberId: sp.staffMemberId }),
    prisma.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true, staffCode: true }, orderBy: { fullName: "asc" } })
  ]);
  const query = new URLSearchParams({ from, to, ...(sp.staffMemberId ? { staffMemberId: sp.staffMemberId } : {}) });
  return <div className="page">
    <PageHeader title="Staff Leave Reports" description="Review leave by date, staff, type, and approval status. These reports do not calculate payroll or salary deductions." action={<Link className="button" href={`/api/leave/staff/reports/export?${query}`}>Export CSV</Link>} />
    <div className="subnav">{canViewRequests ? <Link href="/leave/staff">Leave Requests</Link> : null}<Link className="active" href="/leave/staff/reports">Reports</Link></div>
    <form className="card card-pad leave-filters"><label>From<input name="from" type="date" defaultValue={from} /></label><label>To<input name="to" type="date" defaultValue={to} /></label><label>Staff<select name="staffMemberId" defaultValue={sp.staffMemberId ?? ""}><option value="">All staff</option>{staff.map(value => <option key={value.id} value={value.id}>{value.fullName}{value.staffCode ? ` (${value.staffCode})` : ""}</option>)}</select></label><button>Apply Filters</button></form>
    <div className="grid stats"><div className="stat card"><span>Requests</span><strong>{data.requests.length}</strong></div><div className="stat card"><span>Pending Approval</span><strong>{data.pending.length}</strong></div><div className="stat card"><span>Approved</span><strong>{data.approved.length}</strong></div><div className="stat card"><span>Approved Days</span><strong>{data.approved.reduce((sum, row) => sum + row.totalDays, 0)}</strong></div></div>
    <section className="card"><div className="section-title"><h3>Leave by Type</h3></div><div className="table-wrap"><table><thead><tr><th>Type</th><th>Requests</th></tr></thead><tbody>{STAFF_LEAVE_TYPES.map(type => <tr key={type}><td>{leaveLabel(type)}</td><td>{data.byType[type]}</td></tr>)}</tbody></table></div></section>
    <LeaveTable title="Pending Approvals" rows={data.pending} />
    <LeaveTable title="Approved Leave" rows={data.approved} />
  </div>;
}

function LeaveTable({ title, rows }: { title: string; rows: Array<{ id: string; startDate: Date; endDate: Date; leaveType: string; totalDays: number; staffMember: { fullName: string; staffCode: string | null } }> }) {
  return <section className="card"><div className="section-title"><h3>{title}</h3></div><div className="table-wrap"><table><thead><tr><th>Staff</th><th>Dates</th><th>Type</th><th>Days</th><th></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td>{row.staffMember.fullName} {row.staffMember.staffCode ? `(${row.staffMember.staffCode})` : ""}</td><td>{row.startDate.toISOString().slice(0, 10)} to {row.endDate.toISOString().slice(0, 10)}</td><td>{leaveLabel(row.leaveType)}</td><td>{row.totalDays}</td><td><Link href={`/leave/staff/${row.id}`}>View</Link></td></tr>)}{!rows.length ? <tr><td colSpan={5}>No {title.toLowerCase()} match this report range.</td></tr> : null}</tbody></table></div></section>;
}
