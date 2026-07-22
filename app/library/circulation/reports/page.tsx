import { LibraryNav } from "@/components/library-nav";
import { PageHeader, PageShell, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadCirculationReports } from "@/lib/library-circulation-reports";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function LibraryCirculationReportsPage() {
  const user = await requirePermission("VIEW_LIBRARY_CIRCULATION_REPORTS");
  const [report, canExport, canCirculate] = await Promise.all([
    loadCirculationReports(prisma, user.role === "VIEWER"),
    hasRolePermission(prisma, user.role, "EXPORT_LIBRARY_CIRCULATION_REPORTS"),
    hasRolePermission(prisma, user.role, "VIEW_LIBRARY_CIRCULATION")
  ]);
  const cards = [["Active loans", report.summary.activeLoans], ["Overdue (derived)", report.summary.overdue], ["Due today", report.summary.dueToday], ["Due within 7 days", report.summary.dueWithinDays], ["Returns today", report.summary.returnsToday], ["Waiting reservations", report.summary.waitingReservations]];
  const exportTypes = ["active-loans", "overdue-loans", "due-today", "due-soon", "returned-loans", "renewals", "waiting-reservations", "all-reservations", "student-borrowing", "staff-borrowing", "class-wise", "title-wise", "member-limit-usage", "members-open-loans", "copy-availability"];
  return <PageShell className="library-page">
    <PageHeader title="Library Circulation Reports" description={user.role === "VIEWER" ? "Masked, read-only operational reports. Export is disabled for Viewer/Auditor." : "Operational borrowing, overdue, renewal, reservation, member-usage, and copy-availability reports. No fine or payment fields."} />
    <LibraryNav current="circulation-reports" canCirculate={canCirculate} canCirculationReports />
    <div className="stats library-stats">{cards.map(([label, value]) => <div className="card stat" key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
    {canExport ? <section className="card card-pad"><h3>Formula-safe CSV exports</h3><div className="page-actions">{exportTypes.map((type) => <a className="button secondary" key={type} href={`/api/library/circulation/reports/export?type=${type}`}>{type === "due-soon" ? "due soon (next 7 days)" : type.replaceAll("-", " ")}</a>)}</div></section> : null}
    <section className="card"><div className="section-title"><h3>Active and recent loans</h3></div><div className="table-wrap"><table><thead><tr><th>Loan</th><th>Borrower</th><th>Type / class</th><th>Title / copy</th><th>Status</th><th>Issue</th><th>Due</th><th>Return</th></tr></thead><tbody>{report.loans.slice(0, 100).map((row) => <tr key={row.loanNumber}><td>{row.loanNumber}</td><td>{row.borrower}</td><td>{row.memberType} / {row.classOrStaffType}</td><td>{row.titleCode} - {row.title}<br/><small>{row.accessionNumber}</small></td><td><StatusBadge status={row.overdue ? "OVERDUE (DERIVED)" : row.status} /></td><td>{row.issueDate}</td><td>{row.dueDate}{row.overdue ? ` (${row.overdueDays} days)` : ""}</td><td>{row.returnedDate || "—"}</td></tr>)}</tbody></table></div></section>
    <section className="card"><div className="section-title"><h3>Copy availability</h3></div><div className="table-wrap"><table><thead><tr><th>Accession</th><th>Title</th><th>Physical status</th><th>Circulation status</th></tr></thead><tbody>{report.copyAvailability.slice(0, 100).map((row) => <tr key={row.accessionNumber}><td>{row.accessionNumber}</td><td>{row.titleCode} - {row.title}</td><td>{row.physicalStatus}</td><td>{row.circulationStatus}</td></tr>)}</tbody></table></div></section>
  </PageShell>;
}
