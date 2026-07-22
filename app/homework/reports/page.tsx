import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { homeworkAccess } from "@/lib/homework-api";
import { homeworkVisibleWhere } from "@/lib/homework-scope";
import { buildHomeworkReports } from "@/lib/homework-reports";

export default async function Page() {
  const user = await requirePermission("VIEW_HOMEWORK_REPORTS");
  const [scope, permissions] = await Promise.all([homeworkAccess(user), getEffectivePermissions(prisma, user.role)]);
  const rows = await prisma.homeworkAssignment.findMany({ where: homeworkVisibleWhere(scope, user), include: { createdBy: { select: { name: true } }, events: { where: { eventType: "CORRECTED" }, select: { eventType: true } } }, orderBy: [{ assignedDate: "desc" }] });
  const report = buildHomeworkReports(rows, new Date(), user.role === "VIEWER"); const due = Object.fromEntries(report.due.map((item) => [item.label, item.count]));
  return <div className="page homework-reports-page"><PageHeader title="Homework Reports" description="Privacy-safe class, section, subject, workflow, due-date, correction, and cancellation coverage." action={permissionSetCan(permissions, "EXPORT_HOMEWORK_REPORTS") ? <a className="button" href="/api/homework/reports/export">Export CSV</a> : undefined} />
    <div className="grid three"><StatCard label="Assignments" value={String(report.total)} /><StatCard label="Due Today" value={String(due.DUE_TODAY ?? 0)} /><StatCard label="Upcoming" value={String(due.UPCOMING ?? 0)} /><StatCard label="Overdue" value={String(due.OVERDUE ?? 0)} /><StatCard label="Without Due Date" value={String(due.NO_DUE_DATE ?? 0)} /><StatCard label="Recent Corrections" value={String(report.recentCorrections.length)} /></div>
    <ReportTable title="By Class" rows={report.class} /><ReportTable title="By Section" rows={report.section} /><ReportTable title="By Subject" rows={report.subject} /><ReportTable title="By Status" rows={report.status} />{report.creator.length ? <ReportTable title="By Creator" rows={report.creator} /> : <div className="notice">Creator details are masked for Viewer/Auditor access.</div>}<div className="page-actions">{permissionSetCan(permissions, "VIEW_HOMEWORK") ? <Link className="button secondary" href="/homework">Back to Homework</Link> : <Link className="button secondary" href="/">Back to Dashboard</Link>}</div>
  </div>;
}
function ReportTable({ title, rows }: { title: string; rows: Array<{ label: string; count: number }> }) { return <section className="card"><div className="section-title"><h3>{title}</h3></div><div className="table-wrap"><table><thead><tr><th>Group</th><th>Count</th></tr></thead><tbody>{rows.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.count}</td></tr>)}{!rows.length ? <tr><td colSpan={2}>No data.</td></tr> : null}</tbody></table></div></section>; }
