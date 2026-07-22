import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExamReports } from "@/lib/exam-reports";
import { resolveMarksScope } from "@/lib/marks-scope";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_EXAM_REPORTS");
  const params = await searchParams;
  const scope = await resolveMarksScope(prisma, user, params.academicYear);
  const [report, canExport] = await Promise.all([
    buildExamReports(prisma, scope, { academicYear: params.academicYear, examCode: params.examCode }, user.role === "VIEWER"),
    hasRolePermission(prisma, user.role, "EXPORT_EXAM_REPORTS")
  ]);
  const query = new URLSearchParams(Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString();

  return <div className="page marks-page">
    <PageHeader
      title="Exam and Marks Reports"
      description="Internal completeness and raw-mark analytics. Averages, extremes, and pass/fail are derived; no rank or report card is created."
      action={canExport && !["TEACHER", "VIEWER"].includes(user.role) ? <a className="button" href={`/api/marks/reports/export${query ? `?${query}` : ""}`}>Export Formula-Safe CSV</a> : undefined}
    />
    <form className="card filter-grid">
      <label>Academic year<input name="academicYear" defaultValue={params.academicYear ?? ""} /></label>
      <label>Exam code<input name="examCode" defaultValue={params.examCode ?? ""} /></label>
      <button type="submit">Apply Filters</button>
      <Link className="button secondary" href="/marks/reports">Clear</Link>
    </form>
    <div className="grid three">
      <StatCard label="Exam Cycles" value={String(report.totals.exams)} />
      <StatCard label="Assessment Sheets" value={String(report.totals.assessments)} />
      <StatCard label="Configuration Gaps" value={String(report.configuration.incomplete)} />
      <StatCard label="Eligible Entries" value={String(report.totals.eligibleEntries)} />
      <StatCard label="Entered" value={String(report.totals.entered)} />
      <StatCard label="Missing" value={String(report.totals.missing)} />
      <StatCard label="Absent / Exempt" value={String(report.totals.absent + report.totals.exempt)} />
    </div>
    {user.role === "VIEWER" ? <div className="notice">Viewer/Auditor mode is masked and read-only. Export is unavailable.</div> : null}

    <section className="card card-pad">
      <h3>Exam Configuration Completeness</h3>
      <p className="muted-text">{report.configuration.complete} configured · {report.configuration.incomplete} missing assessment sheets</p>
      <div className="report-list">
        {report.configuration.rows.map((row, index) => <div key={`${row.examCode}-${index}`}>
          <span>{row.examCode} · {row.examName}</span>
          <strong>{row.assessmentCount > 0 ? `${row.assessmentCount} assessment sheet(s)` : "No assessment configured"}</strong>
        </div>)}
        {!report.configuration.rows.length ? <p>No authorised exam cycles match these filters.</p> : null}
      </div>
    </section>

    <section className="card">
      <div className="table-wrap exam-report-wrap">
        <table>
          <thead><tr><th>Exam</th><th>Target</th><th>Status</th><th>Complete</th><th>Absent / exempt</th><th>Average</th><th>High / low</th><th>Pass / fail</th><th>Corrections</th></tr></thead>
          <tbody>
            {report.rows.map((row) => <tr key={`${row.examCode}|${row.className}|${row.section}|${row.subjectName}|${row.componentName}`}>
              <td>{user.role === "VIEWER" ? "Masked" : row.examCode}<br /><small>{row.examName}</small></td>
              <td>{row.className}-{row.section}<br />{row.subjectName} · {row.componentName}</td>
              <td><StatusBadge status={row.assessmentStatus} /></td>
              <td>{row.entered}/{row.eligible}<br /><small>{row.missing} missing</small></td>
              <td>{row.absent} / {row.exempt}</td>
              <td>{row.average ?? "—"}</td>
              <td>{row.highest ?? "—"} / {row.lowest ?? "—"}</td>
              <td>{row.passed ?? "—"} / {row.failed ?? "—"}</td>
              <td>{row.correctionCount}</td>
            </tr>)}
            {!report.rows.length ? <tr><td colSpan={9}>No authorised assessment data matches these filters.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </section>

    <section className="card card-pad">
      <h3>Result Distribution</h3>
      <div className="grid three">
        <StatCard label="Derived Pass" value={String(report.resultDistribution.passed)} />
        <StatCard label="Derived Fail" value={String(report.resultDistribution.failed)} />
        <StatCard label="Pass Marks Not Set" value={String(report.resultDistribution.presentWithoutPassMarks)} />
        <StatCard label="Absent" value={String(report.resultDistribution.absent)} />
        <StatCard label="Exempt" value={String(report.resultDistribution.exempt)} />
        <StatCard label="Not Applicable" value={String(report.resultDistribution.notApplicable)} />
      </div>
    </section>

    <section className="card card-pad">
      <h3>Teacher Submission Status</h3>
      <div className="report-list">
        {report.teacherSubmissionStatus.map((row, index) => <div key={`${row.target}-${index}`}>
          <span>{row.examCode} · {row.target}</span>
          <strong>{row.status} · {row.missing} missing</strong>
        </div>)}
      </div>
    </section>

    <section className="card card-pad">
      <h3>Cancelled Exams and Assessments</h3>
      <div className="report-list">
        {report.cancelled.map((row, index) => <div key={`${row.examCode}-${row.subjectName}-${index}`}>
          <span>{user.role === "VIEWER" ? "Masked" : row.examCode} · {row.className}-{row.section} {row.subjectName}</span>
          <strong>{row.examStatus} / {row.assessmentStatus}</strong>
        </div>)}
        {!report.cancelled.length ? <p>No cancelled exam or assessment records match these filters.</p> : null}
      </div>
    </section>
  </div>;
}
