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
  searchParams: Promise<{ q?: string; className?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const user = await requirePermission("VIEW_STUDENTS");
  const permissions = await getCurrentUserEffectivePermissions();
  const q = sp.q?.trim();
  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      ...(sp.className ? { className: sp.className } : {}),
      ...studentStatusWhere(sp.status),
      ...(q
        ? {
            OR: [
              { admissionNo: { contains: q } },
              { studentName: { contains: q } },
              { fatherName: { contains: q } },
              { phone1: { contains: q } }
            ]
          }
        : {})
    },
    orderBy: [{ className: "asc" }, { section: "asc" }, { studentName: "asc" }]
  });
  return (
    <div className="page">
      <PageHeader
        title="Student Master"
        description="Search, verify, add, and edit student records."
        action={permissionSetCan(permissions, "CREATE_STUDENTS") ? <Link className="button" href="/students/new">Add Student</Link> : undefined}
      />
      <form className="card card-pad filters">
        <label>Search<input name="q" defaultValue={sp.q ?? ""} placeholder="Adm no, name, phone" /></label>
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
        {permissionSetCan(permissions, "EXPORT_STUDENTS") ? <Link className="button secondary" href="/api/export/students">Export CSV</Link> : null}
      </form>
      <section className="card">
        <div className="section-title"><h3>{students.length} Students</h3></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Adm No</th><th>Student</th><th>Father</th><th>Class</th><th>Phone</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id}>
                  <td>{student.admissionNo}</td>
                  <td>{student.studentName}</td>
                  <td>{student.fatherName}</td>
                  <td>{student.className}{student.section ? `-${student.section}` : ""}</td>
                  <td>{student.phone1}</td>
                  <td>{student.studentType} {student.discountPercent ? `${student.discountPercent}%` : ""}</td>
                  <td>{student.status}</td>
                  <td>{permissionSetCan(permissions, "EDIT_STUDENTS") ? <Link href={`/students/${student.id}/edit`}>Edit</Link> : null}</td>
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
