import { HomeworkEditor } from "@/components/homework-editor";
import { PageHeader } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { getSchoolSettings } from "@/lib/school-settings";
import { resolveHomeworkScope, scopeOptions } from "@/lib/homework-scope";

export default async function Page() {
  const user = await requirePermission("MANAGE_HOMEWORK");
  const [settings, permissions] = await Promise.all([getSchoolSettings(prisma), getCurrentUserEffectivePermissions()]);
  const scope = await resolveHomeworkScope(prisma, user, settings.academicYear);
  let options = scopeOptions(scope);
  if (scope.broad) {
    const assignments = await prisma.timetableAssignment.findMany({ where: { academicYear: settings.academicYear, classSection: { isActive: true }, subject: { isActive: true } }, include: { classSection: true, subject: true }, orderBy: [{ classSection: { className: "asc" } }, { subject: { name: "asc" } }] });
    options = assignments.map((item) => ({ academicYear: item.academicYear, className: item.classSection.className, section: item.classSection.section || null, subjectName: item.subject.name }));
  }
  return <div className="page homework-editor-page"><PageHeader title="Create Homework" description="Save a draft, validate a Parent preview, or publish after an explicit in-app confirmation." /><HomeworkEditor targetOptions={options} academicYear={settings.academicYear} canManage canPublish={permissionSetCan(permissions, "PUBLISH_HOMEWORK")} canArchive={false} /></div>;
}
