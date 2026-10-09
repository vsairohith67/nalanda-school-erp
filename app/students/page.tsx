import { studentExchangeScope, scopedStudentRow } from "@/lib/student-export-scope";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { CLASS_NAMES } from "@/lib/constants";
import { STUDENT_STATUS_FILTERS, studentStatusWhere } from "@/lib/student-filters";

export default async function StudentsPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; className?: string; status?: string; academicYear?: string; section?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePermission("VIEW_STUDENTS");
  const permissions = await getCurrentUserEffectivePermissions();
  const query = new URLSearchParams(Object.entries(sp).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const scope = studentExchangeScope(query);
  const records = await prisma.student.findMany({ where: scope.where, include: { academicYearEnrollments: scope.academicYear ? { where: { academicYear: scope.academicYear } } : false }, orderBy: [{ studentName: "asc" }, { admissionNo: "asc" }] });
  const students = records.map(student => scopedStudentRow(student, scope.academicYear));
  const years = await prisma.academicYearEnrollment.findMany({ distinct: ["academicYear"], select: { academicYear: true }, orderBy: { academicYear: "desc" } });
  return (
    <div className="page">
      <PageHeader
        title="Student Master"
        description="Search, verify, add, and edit student records."
        action={permissionSetCan(permissions, "CREATE_STUDENTS") ? <Link className="button" href="/students/new">Add Student</Link> : undefined}
      />
      <form className="card card-pad filters">
        <label>Search<input name="q" defaultValue={sp.q ?? ""} placeholder="Adm no, name, phone" /></label>
        <label>Academic year<select name="academicYear" defaultValue={sp.academicYear ?? ""}><option value="">All master records</option>{years.map(y => <option key={y.academicYear}>{y.academicYear}</option>)}</select></label>
        <label>Section<input name="section" defaultValue={sp.section ?? ""} maxLength={20} /></label>
        <label>Class
          <select name="className" defaultValue={sp.className ?? ""}>
            <option value="">All classes</option>
            {CLASS_NAMES.map((className) => <option key={className}>{className}</option>)}
          </select>
        </label>
        <label>Status
          <select name="status" defaultValue={sp.status ?? ""}>
            {STUDENT_STATUS_FILTERS.map(([value, label]) => <option value={value} key={value || "all"}>{label}</option>)}
          </select>
        </label>
        <button>Apply</button>
        {permissionSetCan(permissions, "EXPORT_STUDENTS") ? <Link className="button secondary" href={`/api/export/students?${query.toString()}`}>Export CSV — all results matching these filters</Link> : null}
      </form>
      <section className="card">
        <div className="section-title"><h3>{students.length} Students</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Adm No</th><th>Student</th><th>Father</th><th>Class</th><th>Phone</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.admissionNo}</td>
                  <td><Link href={`/students/${student.id}`}>{student.studentName}</Link></td>
                  <td>{student.fatherName}</td>
                  <td>{student.className}{student.section ? `-${student.section}` : ""}</td>
                  <td>{student.phone1}</td>
                  <td>{student.studentType} {student.discountPercent ? `${student.discountPercent}%` : ""}</td>
                  <td>{student.status}</td>
                  <td><div className="row-actions"><Link href={`/students/${student.id}`}>Open 360</Link>{permissionSetCan(permissions, "EDIT_STUDENTS") ? <Link href={`/students/${student.id}/edit`}>Edit</Link> : null}</div></td>
                </tr>
              ))}
              {!students.length ? <tr><td colSpan={8}>No students match the selected filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
