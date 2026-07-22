import { ClassXPackageCreateForm } from "@/components/class-x-package-forms";
import { PageHeader, PageShell } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export default async function NewClassXPackagePage() {
  await requirePermission("MANAGE_CLASS_X_PACKAGES");
  const [students, templates, settings] = await Promise.all([
    prisma.student.findMany({ where: { deletedAt: null }, select: { id: true, admissionNo: true, studentName: true, className: true, section: true }, orderBy: { studentName: "asc" } }),
    prisma.classXPackageTemplate.findMany({ where: { status: "ACTIVE" }, select: { id: true, name: true, templateCode: true, paymentRequired: true }, orderBy: { name: "asc" } }),
    getSchoolSettings(prisma)
  ]);
  return <PageShell className="class-x-page"><PageHeader title="Create Class X Package" description="Preview the reviewed Class X source and configured school service charge before creating a snapshotted package." /><ClassXPackageCreateForm students={students} templates={templates} academicYear={settings.academicYear} /><p className="notice">No Board eligibility, pass status, lifecycle change, progression decision, enrollment change, or fee-dues clearance is inferred or written.</p></PageShell>;
}
