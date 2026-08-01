import Link from "next/link";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { attendanceDay, localDateText, staffAttendanceReportData } from "@/lib/staff-attendance";
import { PageHeader } from "@/components/ui";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function StaffAttendanceReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_STAFF_ATTENDANCE_REPORTS");
  const permissions = await getCurrentUserEffectivePermissions();
  const canViewEntry = permissionSetCan(permissions, "VIEW_STAFF_ATTENDANCE");
  const sp = await searchParams;
  const today = localDateText();
  const from = sp.from || `${today.slice(0, 8)}01`;
  const to = sp.to || today;
  const data = await staffAttendanceReportData(prisma, { from: attendanceDay(from), to: attendanceDay(to) });
  const query = new URLSearchParams({ from, to });
  return <div className="page">
    <PageHeader title="Staff Attendance Reports" description="Review official submitted and locked staff attendance." action={<Link className="button" href={`/api/attendance/staff/reports/export?${query}`}>Export CSV</Link>} />
    <div className="subnav">{canViewEntry ? <Link href="/attendance/staff">Take Attendance</Link> : null}<Link className="active" href="/attendance/staff/reports">Reports</Link></div>
    <form className="card card-pad attendance-report-filters"><label>From<input name="from" type="date" defaultValue={from} /></label><label>To<input name="to" type="date" defaultValue={to} /></label><button>Apply Filters</button></form>
    <p className="notice">Official totals include submitted and locked attendance only. Draft work is excluded.</p>
    <div className="grid stats"><Stat label="Marked" value={data.totals.total} /><Stat label="Present" value={data.totals.PRESENT} /><Stat label="Absent" value={data.totals.ABSENT} /><Stat label="Late" value={data.totals.LATE} /><Stat label="On Leave" value={data.totals.ON_LEAVE} /></div>
    <section className="card"><div className="section-title"><h3>Date-wise Report</h3></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Status</th><th>Staff</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>On Leave</th><th>Excused</th></tr></thead><tbody>{data.sessions.map((session) => {
      const totals = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, ON_LEAVE: 0, EXCUSED: 0 };
      session.records.forEach((record) => { if (record.status in totals) totals[record.status as keyof typeof totals] += 1; });
      return <tr key={session.id}><td>{session.attendanceDate.toISOString().slice(0, 10)}</td><td>{session.status}</td><td>{session.records.length}</td><td>{totals.PRESENT}</td><td>{totals.ABSENT}</td><td>{totals.LATE}</td><td>{totals.HALF_DAY}</td><td>{totals.ON_LEAVE}</td><td>{totals.EXCUSED}</td></tr>;
    })}{!data.sessions.length ? <tr><td colSpan={9}>No official staff attendance sessions match these dates.</td></tr> : null}</tbody></table></div></section>
    <div className="grid two"><ReportList title="Absent List" rows={data.rows.filter((row) => row.status === "ABSENT")} /><ReportList title="Late List" rows={data.rows.filter((row) => row.status === "LATE")} /><ReportList title="On-leave List" rows={data.rows.filter((row) => row.status === "ON_LEAVE")} /></div>
    <section className="card"><div className="section-title"><h3>Monthly Summary by Staff</h3></div><div className="table-wrap"><table><thead><tr><th>Staff</th><th>Designation</th><th>Marked Days</th><th>Present</th><th>Absent</th><th>Late</th><th>Half Day</th><th>On Leave</th><th>Excused</th></tr></thead><tbody>{data.byStaff.map((row, index) => <tr key={`${row.staffCode ?? row.fullName}-${index}`}><td>{row.fullName}<small className="muted-text"> {row.staffCode ?? ""}</small></td><td>{row.designation}</td><td>{row.total}</td><td>{row.present}</td><td>{row.absent}</td><td>{row.late}</td><td>{row.halfDay}</td><td>{row.onLeave}</td><td>{row.excused}</td></tr>)}{!data.byStaff.length ? <tr><td colSpan={9}>No staff attendance records match these dates.</td></tr> : null}</tbody></table></div></section>
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) { return <div className="stat"><span>{label}</span><strong>{value}</strong></div>; }

function ReportList({ title, rows }: { title: string; rows: Array<{ attendanceDate: Date; fullName: string; staffCode: string | null; designation: string; remarks: string | null }> }) {
  return <section className="card"><div className="section-title"><h3>{title}</h3></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Staff</th><th>Designation</th><th>Remarks</th></tr></thead><tbody>{rows.map((row, index) => <tr key={`${row.staffCode ?? row.fullName}-${row.attendanceDate.toISOString()}-${index}`}><td>{row.attendanceDate.toISOString().slice(0, 10)}</td><td>{row.fullName}<small className="muted-text"> {row.staffCode ?? ""}</small></td><td>{row.designation}</td><td>{row.remarks ?? "-"}</td></tr>)}{!rows.length ? <tr><td colSpan={4}>No staff in this list.</td></tr> : null}</tbody></table></div></section>;
}
