import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";
import { ACADEMIC_ENROLLMENT_STATUSES, lifecycleOverview } from "@/lib/student-lifecycle";
import { hasRolePermission } from "@/lib/role-permissions";

export default async function StudentLifecyclePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requirePermission("VIEW_STUDENT_LIFECYCLE");
  const sp = await searchParams;
  const settings = await getSchoolSettings(prisma);
  const academicYear = sp.academicYear?.trim() || settings.academicYear;
  const [data, classes, canViewProgression] = await Promise.all([
    lifecycleOverview(prisma, {
      academicYear,
      className: sp.className?.trim(),
      section: sp.section?.trim(),
      status: ACADEMIC_ENROLLMENT_STATUSES.includes(sp.status as never) ? sp.status : undefined
    }),
    prisma.academicYearEnrollment.findMany({ where: { academicYear }, select: { className: true, section: true }, distinct: ["className", "section"], orderBy: [{ className: "asc" }, { section: "asc" }] }),
    hasRolePermission(prisma, user.role, "VIEW_STUDENT_PROGRESSION")
  ]);

  return <div className="page">
    <PageHeader title="Student Lifecycle" description="Read-only academic-year enrollment coverage and append-only lifecycle history. Progression changes require a separate approved decision." action={canViewProgression ? <Link className="button secondary" href="/students/progression">Progression Decisions</Link> : undefined} />
    {data.missingEnrollmentCount > 0 ? <div className="notice notice-warning"><strong>{data.missingEnrollmentCount} current student{data.missingEnrollmentCount === 1 ? " is" : "s are"} missing an enrollment for {academicYear}.</strong><br />Run <code>pnpm.cmd lifecycle:backfill</code> for a dry-run before applying the backfill.</div> : <div className="notice success-notice">All current students have an academic-year enrollment for {academicYear}.</div>}
    <section className="stats-grid lifecycle-stats" aria-label="Enrollment counts by status">
      {ACADEMIC_ENROLLMENT_STATUSES.map((status) => <div className="stat-card" key={status}><span>{status.replaceAll("_", " ")}</span><strong>{data.counts[status]}</strong></div>)}
    </section>
    <form className="card card-pad filters">
      <label>Academic year<input name="academicYear" defaultValue={academicYear} /></label>
      <label>Class<select name="className" defaultValue={sp.className ?? ""}><option value="">All classes</option>{[...new Set(classes.map((row) => row.className))].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Section<select name="section" defaultValue={sp.section ?? ""}><option value="">All sections</option>{[...new Set(classes.map((row) => row.section).filter(Boolean))].map((value) => <option key={value!}>{value}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={sp.status ?? ""}><option value="">All statuses</option>{ACADEMIC_ENROLLMENT_STATUSES.map((value) => <option key={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
      <button>Apply filters</button>
    </form>
    <section className="card"><div className="section-title"><h3>{data.enrollments.length} Enrollments</h3></div><div className="table-wrap"><table><thead><tr><th>Adm No</th><th>Student</th><th>Year</th><th>Class</th><th>Roll No</th><th>Status</th><th>History</th></tr></thead><tbody>
      {data.enrollments.map((row) => <tr key={row.id}><td>{row.student.admissionNo}</td><td>{row.student.studentName}</td><td>{row.academicYear}</td><td>{row.className}{row.section ? `-${row.section}` : ""}</td><td>{row.rollNo || "-"}</td><td><span className="badge">{row.status.replaceAll("_", " ")}</span></td><td><Link href={`/students/${row.studentId}/lifecycle`}>View lifecycle</Link></td></tr>)}
      {!data.enrollments.length ? <tr><td colSpan={7}>No enrollments match the selected filters.</td></tr> : null}
    </tbody></table></div></section>
  </div>;
}
