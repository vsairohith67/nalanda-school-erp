import { PageHeader } from "@/components/ui";
import { IdentityCardDraftForm } from "@/components/identity-card-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function NewIdentityCardPage() {
  await requirePermission("CREATE_ID_CARDS");
  const settings = await getSchoolSettings(prisma);
  const [enrollments, staff, templates] = await Promise.all([
    prisma.academicYearEnrollment.findMany({ where: { academicYear: settings.academicYear, status: "ACTIVE", student: { deletedAt: null } }, select: { studentId: true, className: true, section: true, student: { select: { studentName: true, admissionNo: true } } }, orderBy: { student: { studentName: "asc" } } }),
    prisma.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, fullName: true, staffCode: true, designation: true }, orderBy: { fullName: "asc" } }),
    prisma.identityCardTemplate.findMany({ where: { status: "ACTIVE", OR: [{ academicYear: settings.academicYear }, { academicYear: null }] }, orderBy: [{ cardType: "asc" }, { name: "asc" }] })
  ]);
  const students = enrollments.map((row) => ({ id: row.studentId, label: `${row.student.studentName} · ${row.student.admissionNo} · ${row.className}${row.section ? `-${row.section}` : ""}` }));
  const staffOptions = staff.map((row) => ({ id: row.id, label: `${row.fullName} · ${row.staffCode ?? "No staff code"} · ${row.designation}` }));
  return <div className="page identity-card-page"><PageHeader title="Create Individual ID Card" description="Preview authoritative identity data and the next number without consuming it, then create a draft."/><IdentityCardDraftForm students={students} staff={staffOptions} templates={templates} academicYear={settings.academicYear}/></div>;
}
