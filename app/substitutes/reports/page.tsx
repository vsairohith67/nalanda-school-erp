import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { permissionSetCan } from "@/lib/role-permissions";
import { localSubstituteDateText, substituteDate, substituteLabel, substituteReportData } from "@/lib/substitutes";

export default async function SubstituteReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_SUBSTITUTE_REPORTS");
  const [permissions, sp] = await Promise.all([getCurrentUserEffectivePermissions(), searchParams]);
  const today = localSubstituteDateText();
  const fromText = sp.from ?? `${today.slice(0, 8)}01`;
  const toText = sp.to ?? today;
  const report = await substituteReportData(prisma, { from: substituteDate(fromText, "From date"), to: substituteDate(toText, "To date") });
  const canView = permissionSetCan(permissions, "VIEW_SUBSTITUTES");
  const canManage = permissionSetCan(permissions, "MANAGE_SUBSTITUTES");

  return <div className="page">
    <PageHeader title="Substitute Reports" description="Coverage and workload reporting only. These figures are not payroll or performance analytics." action={<a className="button" href={`/api/substitutes/reports/export?from=${fromText}&to=${toText}`}>Export CSV</a>} />
    <div className="subnav">{canView ? <Link href="/substitutes">Assignments</Link> : null}{canManage ? <Link href="/substitutes/planner">Planner</Link> : null}<Link className="active" href="/substitutes/reports">Reports</Link></div>
    <form className="card card-pad substitute-filters"><label>From<input name="from" type="date" defaultValue={fromText} /></label><label>To<input name="to" type="date" defaultValue={toText} /></label><button>Apply</button></form>
    <section className="stats substitute-report-stats"><article><span>Total coverage rows</span><strong>{report.assignments.length}</strong></article><article><span>Active coverage</span><strong>{report.active.length}</strong></article><article><span>Pending / unassigned</span><strong>{report.pending.length}</strong></article><article><span>Completed</span><strong>{report.assignments.filter((row) => row.status === "COMPLETED").length}</strong></article></section>
    <div className="grid two">
      <section className="card"><div className="section-title"><h3>Duties by Substitute Teacher</h3></div><div className="table-wrap"><table><thead><tr><th>Teacher</th><th>Duties</th></tr></thead><tbody>{report.bySubstitute.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td></tr>)}{!report.bySubstitute.length ? <tr><td colSpan={2}>No assigned substitute duties.</td></tr> : null}</tbody></table></div></section>
      <section className="card"><div className="section-title"><h3>Most Substituted Staff</h3></div><div className="table-wrap"><table><thead><tr><th>Absent Staff</th><th>Coverage Rows</th></tr></thead><tbody>{report.byAbsent.map((row) => <tr key={row.id}><td>{row.name}</td><td>{row.count}</td></tr>)}{!report.byAbsent.length ? <tr><td colSpan={2}>No absent staff coverage.</td></tr> : null}</tbody></table></div></section>
    </div>
    <section className="card"><div className="section-title"><h3>Date-wise Coverage and Pending List</h3></div><div className="table-wrap"><table><thead><tr><th>Date</th><th>Absent</th><th>Substitute</th><th>Class / Period</th><th>Status</th></tr></thead><tbody>{report.assignments.map((row) => <tr key={row.id}><td>{row.assignmentDate.toISOString().slice(0, 10)}</td><td>{row.absentStaffMember.displayName || row.absentStaffMember.fullName}</td><td>{row.substituteStaffMember ? row.substituteStaffMember.displayName || row.substituteStaffMember.fullName : <span className="badge warn">Unassigned</span>}</td><td>{[row.className, row.section, row.periodLabel].filter(Boolean).join(" · ") || "Not recorded"}</td><td>{substituteLabel(row.status)}</td></tr>)}{!report.assignments.length ? <tr><td colSpan={5}>No substitute data in this date range.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
