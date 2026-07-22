import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { StudentForm } from "@/components/student-form";
import { requirePermission } from "@/lib/auth";

export default async function EditStudentPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("EDIT_STUDENTS");
  const { id } = await params;
  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      guardians: {
        include: { guardian: true },
        orderBy: { createdAt: "asc" }
      }
    }
  });
  if (!student || student.deletedAt) notFound();
  return (
    <div className="page">
      <PageHeader title="Edit Student" description={`${student.studentName} - ${student.admissionNo}`} />
      <StudentForm student={student} />
      <section className="card">
        <div className="section-title">
          <div>
            <h3>Linked Guardians / Parents</h3>
            <p>Student phone fields are operational contact fields; guardian links are for parent login and sibling grouping.</p>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Guardian</th><th>Mobile</th><th>Email</th><th>Relationship</th><th>Primary</th><th>Fees</th><th>Reminders</th></tr></thead>
            <tbody>
              {student.guardians.map((link) => (
                <tr key={link.id}>
                  <td>{link.guardian.displayName}</td>
                  <td>{link.guardian.primaryMobile}</td>
                  <td>{link.guardian.email ?? "-"}</td>
                  <td>{link.relationshipToStudent}</td>
                  <td>{link.isPrimaryContact ? "Yes" : "No"}</td>
                  <td>{link.canViewFees ? "Yes" : "No"}</td>
                  <td>{link.canReceiveReminders ? "Yes" : "No"}</td>
                </tr>
              ))}
              {!student.guardians.length ? <tr><td colSpan={7}>No guardian links added yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
