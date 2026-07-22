import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { StudentProgressionForm } from "@/components/student-progression-form";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewProgressionDecisionPage() {
  await requirePermission("MANAGE_STUDENT_PROGRESSION");
  const students = await prisma.student.findMany({ where: { deletedAt: null }, select: { id: true, admissionNo: true, studentName: true, academicYearEnrollments: { orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }], select: { id: true, academicYear: true, className: true, section: true, status: true } } }, orderBy: [{ studentName: "asc" }] });
  return <div className="page"><PageHeader title="New Progression Decision" description="Create a draft and preview the outcome. Saving or submitting does not change enrollment." action={<Link className="button secondary" href="/students/progression">Back to decisions</Link>} /><StudentProgressionForm students={students} permissions={{ manage: true, approve: false, finalize: false }} /></div>;
}
