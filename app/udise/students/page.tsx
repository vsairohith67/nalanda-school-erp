import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { UdiseStatusBadge } from "@/components/udise-status-badge";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStudents, loadUdiseChecklist, UDISE_STUDENT_ROW_LIMIT } from "@/lib/udise-checklist";

export default async function UdiseStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_UDISE_MASKED_ROWS");
  const search = await searchParams;
  const report = await loadUdiseChecklist(prisma, { includeStaff: false, student: { className: search.className, section: search.section, status: search.status } });
  const rows = filterUdiseStudents(report.students, { className: search.className, section: search.section, status: search.status, gapType: search.gapType }).slice(0, UDISE_STUDENT_ROW_LIMIT);
  const classes = [...new Set(report.students.map((row) => row.className))].sort();
  const sections = [...new Set(report.students.map((row) => row.section).filter(Boolean))].sort();
  const statuses = [...new Set(report.students.map((row) => row.studentStatus))].sort();
  return <div className="page udise-page">
    <PageHeader title="Masked Student Data-gap Report" description="Bounded, read-only availability statuses. Names, contact values, addresses, dates, identifiers and Aadhaar values are not displayed." />
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning}</span></div>
    {report.limits.studentRowsTruncated ? <div className="notice-warning udise-warning"><strong>Bounded Student result</strong><span>{report.limits.studentRowsLoaded} of {report.limits.studentRowsMatched} server-filtered candidates were reviewed. Refine the fixed filters before relying on this internal checklist.</span></div> : null}
    <UdiseNav current="students" />
    <form className="card card-pad filters udise-filters">
      <label>Class<select name="className" defaultValue={search.className ?? ""}><option value="">All classes</option>{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Section<select name="section" defaultValue={search.section ?? ""}><option value="">All sections</option>{sections.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={search.status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Gap type<select name="gapType" defaultValue={search.gapType ?? ""}><option value="">All gap types</option><option value="missing-basics">Missing basics</option><option value="enrollment">Enrollment</option><option value="lifecycle">Lifecycle</option><option value="applicability">Applicability</option><option value="parent-source">Parent source</option><option value="contact-source">Contact source</option><option value="source-conflict">Source conflict</option><option value="address">Address/PIN</option><option value="admission-date">Admission date</option><option value="privacy">Privacy boundary</option></select></label>
      <button>Apply filters</button>
    </form>
    <section className="card"><div className="section-title"><h3>{rows.length} masked Student records</h3><span className="muted">Pinned evidence cycle {report.academicYear} · maximum {UDISE_STUDENT_ROW_LIMIT}</span></div><div className="table-wrap udise-table-wrap"><table><thead><tr><th>Opaque row</th><th>Masked admission ref.</th><th>Class</th><th>ERP status</th><th>DOB</th><th>Gender</th><th>Enrollment</th><th>Lifecycle</th><th>Progression</th><th>Parent source</th><th>Contact source</th><th>Address/PIN</th><th>Admission date</th><th>Aadhaar/privacy</th><th>Gaps</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.rowReference}><td>{row.rowReference}</td><td>{row.maskedAdmissionReference}</td><td>{row.classSection}</td><td>{row.studentStatus}</td><td><UdiseStatusBadge status={row.dateOfBirthStatus} /></td><td><UdiseStatusBadge status={row.genderStatus} /></td><td><UdiseStatusBadge status={row.enrollmentEvidenceStatus} title={row.enrollmentExplanation} /></td><td><UdiseStatusBadge status={row.lifecycleStatus} title={row.lifecycleExplanation} /></td><td><UdiseStatusBadge status={row.progressionStatus} title={row.progressionExplanation} /></td><td>{row.parentSourceStatus}</td><td>{row.contactSourceStatus}</td><td><UdiseStatusBadge status={row.addressStatus} title={row.addressExplanation} /></td><td><UdiseStatusBadge status={row.admissionDateStatus} title={row.admissionDateExplanation} /></td><td><UdiseStatusBadge status={row.aadhaarStatus} title={row.aadhaarExplanation} /></td><td>{row.gapCount}</td></tr>)}
      {!rows.length ? <tr><td colSpan={15}>No masked Student records match the selected filters.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}
