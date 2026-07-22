import { PageHeader } from "@/components/ui";
import { StudentForm } from "@/components/student-form";
import { requirePermission } from "@/lib/auth";

export default async function NewStudentPage() {
  await requirePermission("CREATE_STUDENTS");
  return (
    <div className="page">
      <PageHeader title="Add Student" description="Create the Student Master record once. Payments will auto-fill from this record." />
      <StudentForm />
    </div>
  );
}
