import Link from "next/link";
import { PageHeader, StatCard } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildReportCardReport, maskReportCardReportForViewer } from "@/lib/report-card-reports";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function ReportCardReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_REPORT_CARD_REPORTS");
  const q = await searchParams;
  const [unmaskedReport, permissions] = await Promise.all([
    buildReportCardReport(prisma, { academicYear: q.academicYear, className: q.className, section: q.section, status: q.status }),
    getEffectivePermissions(prisma, user.role)
  ]);
  const report = user.role === "VIEWER" ? maskReportCardReportForViewer(unmaskedReport) : unmaskedReport;
  const s = report.summary;
  const query = new URLSearchParams(Object.entries(q).filter((x): x is [string, string] => Boolean(x[1]))).toString();
  return <div className="page report-cards-page">
    <PageHeader title="Report-card Operational Reports" description="Completeness, issue, correction, KG, grade, result, and attendance snapshot status. No rankings or Teacher scoring." action={permissionSetCan(permissions, "EXPORT_REPORT_CARD_REPORTS") ? <Link className="button" href={`/api/report-cards/reports/export?${query}`}>Export Safe CSV</Link> : undefined} />
    <div className="grid four">
      <StatCard label="Total Cards" value={String(s.total)}/><StatCard label="Pending Entry" value={String(s.pendingEntry)}/><StatCard label="Pending Submission" value={String(s.pendingSubmission)}/><StatCard label="Pending Approval" value={String(s.pendingApproval)}/>
      <StatCard label="Pending Issue" value={String(s.pendingIssue)}/><StatCard label="Issued" value={String(s.issued)}/><StatCard label="Corrected" value={String(s.corrected)}/><StatCard label="Superseded Versions" value={String(s.supersededVersions)}/>
      <StatCard label="Missing Marks Blocks" value={String(s.missingMarksBlockingIssue)}/><StatCard label="KG Incomplete" value={String(s.kgIncomplete)}/><StatCard label="Attendance Gaps" value={String(s.attendanceSnapshotGaps)}/><StatCard label="Growth Gaps" value={String(s.growthSnapshotGaps)}/>
    </div>
    <form className="card filter-grid">
      <label>Academic year<input name="academicYear" defaultValue={q.academicYear ?? ""}/></label><label>Class<input name="className" defaultValue={q.className ?? ""}/></label>
      <label>Section<input name="section" defaultValue={q.section ?? ""}/></label><label>Status<input name="status" defaultValue={q.status ?? ""}/></label>
      <button>Apply Filters</button><Link className="button secondary" href="/report-cards/reports">Clear</Link>
    </form>
    {user.role === "VIEWER" ? <p className="notice">Viewer/Auditor mode masks Student names and admission numbers. Export is disabled.</p> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Student</th><th>Scope</th><th>Type</th><th>Status</th><th>Version</th><th>Grade / Result</th><th>Gaps</th></tr></thead><tbody>
      {report.rows.map((r, index) => <tr key={`${r.batchNumber}-${r.admissionNumber}-${index}`}><td>{r.batchNumber}</td><td>{r.studentName}<br/><small>{r.admissionNumber}</small></td><td>{r.className}{r.section ? `-${r.section}` : ""}</td><td>{r.reportType.replaceAll("_", " ")}</td><td>{r.cardStatus}</td><td>{r.version}</td><td>{r.finalGrade || "-"} / {r.result || "-"}</td><td>{r.validationGapCount}</td></tr>)}
    </tbody></table></div></section>
  </div>;
}
