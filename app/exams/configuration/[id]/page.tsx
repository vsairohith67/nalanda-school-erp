import { ExaminationConfigurationWorkspace } from "@/components/examination-configuration-workspace";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { getExaminationConfiguration, publicExaminationConfiguration } from "@/lib/exam-configurations";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_EXAM_CONFIGURATION");
  const id = (await params).id;
  const [row, permissions, timetableSubjects, teachers, reportCardTemplates] = await Promise.all([
    getExaminationConfiguration(prisma, id),
    getCurrentUserEffectivePermissions(),
    prisma.timetableSubject.findMany({
      where: { isActive: true },
      select: { id: true, name: true, shortName: true },
      orderBy: { name: "asc" }
    }),
    prisma.staffMember.findMany({
      where: {
        status: "ACTIVE",
        user: { isActive: true, role: "TEACHER" },
        timetableTeacher: { is: { isActive: true } }
      },
      select: { id: true, staffCode: true, fullName: true, displayName: true },
      orderBy: { fullName: "asc" }
    }),
    prisma.reportCardTemplate.findMany({
      where: { status: { in: ["DRAFT", "ACTIVE"] } },
      select: { id: true, templateCode: true, name: true, versionNumber: true },
      orderBy: { name: "asc" }
    })
  ]);
  const examination = JSON.parse(JSON.stringify(publicExaminationConfiguration(row)));
  return (
    <div className="page exam-configuration-page">
      <PageHeader
        title={`${examination.examCode} - ${examination.name}`}
        description="Principal-owned versioned examination configuration. Active versions are frozen; future corrections create a new version."
        action={<StatusBadge status={examination.status} />}
      />
      <ExaminationConfigurationWorkspace
        examination={examination}
        timetableSubjects={timetableSubjects.map((subject) => ({ id: subject.id, label: `${subject.name} (${subject.shortName})` }))}
        teachers={teachers.map((teacher) => ({ id: teacher.id, label: `${teacher.displayName ?? teacher.fullName}${teacher.staffCode ? ` - ${teacher.staffCode}` : ""}` }))}
        reportCardTemplates={reportCardTemplates.map((template) => ({ id: template.id, label: `${template.name} - ${template.templateCode} v${template.versionNumber}` }))}
        canManage={permissionSetCan(permissions, "MANAGE_EXAM_CONFIGURATION")}
        canActivate={permissionSetCan(permissions, "ACTIVATE_EXAM_SCHEMES")}
        canAssign={permissionSetCan(permissions, "ASSIGN_EXAM_TEACHERS")}
        requiresInterventionReason={user.role === "SUPER_ADMIN"}
      />
    </div>
  );
}
