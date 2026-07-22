import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { filterUdiseStudents, loadUdiseChecklist, type ChecklistStatus } from "@/lib/udise-checklist";

function badge(status: ChecklistStatus) {
  return <span className={`badge ${status === "Complete" ? "success" : status === "Missing" ? "danger" : "warn"}`}>{status}</span>;
}

export default async function UdiseStudentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const [report, search] = await Promise.all([loadUdiseChecklist(prisma), searchParams]);
  const rows = filterUdiseStudents(report.students, { className: search.className, section: search.section, status: search.status, gapType: search.gapType });
  const classes = [...new Set(report.students.map((row) => row.className))].sort();
  const sections = [...new Set(report.students.map((row) => row.section).filter(Boolean))].sort();
  const statuses = [...new Set(report.students.map((row) => row.studentStatus))].sort();
  return <div className="page udise-page">
    <PageHeader title="Student Data-gap Report" description="Safe availability statuses for possible reporting fields. Contact, address, DOB, Aadhaar, and internal ID values are not displayed." />
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning}</span></div>
    <UdiseNav current="students" />
    <form className="card card-pad filters udise-filters">
      <label>Class<select name="className" defaultValue={search.className ?? ""}><option value="">All classes</option>{classes.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Section<select name="section" defaultValue={search.section ?? ""}><option value="">All sections</option>{sections.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={search.status ?? ""}><option value="">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Gap type<select name="gapType" defaultValue={search.gapType ?? ""}><option value="">All gap types</option><option value="missing-basics">Missing basics</option><option value="enrollment">Enrollment</option><option value="lifecycle">Lifecycle</option><option value="guardian-link">Guardian link</option><option value="guardian-contact">Guardian contact</option><option value="address">Address</option><option value="not-tracked">Not tracked</option><option value="privacy">Privacy caution</option></select></label>
      <button>Apply filters</button>
    </form>
    <section className="card"><div className="section-title"><h3>{rows.length} student records</h3><span className="muted">Academic year {report.academicYear}</span></div><div className="table-wrap udise-table-wrap"><table><thead><tr><th>Admission no.</th><th>Student</th><th>Class</th><th>Status</th><th>DOB</th><th>Gender</th><th>Enrollment</th><th>Lifecycle</th><th>Guardian</th><th>Contact</th><th>Address</th><th>Aadhaar/privacy</th><th>Gaps</th></tr></thead><tbody>
      {rows.map((row) => <tr key={row.admissionNo}><td>{row.admissionNo}</td><td>{row.studentName}</td><td>{row.classSection}</td><td>{row.studentStatus}</td><td>{badge(row.dateOfBirthStatus)}</td><td>{badge(row.genderStatus)}</td><td>{row.enrollmentStatus}</td><td>{row.lifecycleStatus}</td><td>{badge(row.guardianLinkStatus)}</td><td>{badge(row.guardianContactStatus)}</td><td>{badge(row.addressStatus)}</td><td><span className="badge warn">{row.aadhaarStatus}</span></td><td>{row.gapCount}</td></tr>)}
      {!rows.length ? <tr><td colSpan={13}>No student records match the selected filters.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}
