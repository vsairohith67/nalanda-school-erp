import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui";
import { FeeStructureEditor } from "@/components/settings-fees";
import { requirePermission } from "@/lib/auth";
import { getSchoolSettings } from "@/lib/school-settings";
import { SchoolSettingsForm } from "@/components/school-settings-form";
import { getSystemHealth } from "@/lib/system-health";
import { getAppInfo } from "@/lib/app-info";
import { SystemHealthPanel } from "@/components/system-health-panel";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";

export default async function SettingsPage() {
  const user = await requirePermission("VIEW_SETTINGS");
  const permissions = await getEffectivePermissions(prisma, user.role);
  const [rows, settings, health] = await Promise.all([
    prisma.feeStructure.findMany({ where: { active: true }, orderBy: { className: "asc" } }),
    getSchoolSettings(prisma),
    permissionSetCan(permissions, "VIEW_SYSTEM_HEALTH") ? getSystemHealth(prisma) : Promise.resolve(null)
  ]);
  const canManageSchoolSettings = permissionSetCan(permissions, "MANAGE_SCHOOL_SETTINGS");
  const canManageFeeStructures = permissionSetCan(permissions, "MANAGE_FEE_STRUCTURES");
  return (
    <div className="page">
      <PageHeader title="School / Fee Settings" description="Manage the school profile, receipt printing, reminders, and fee structure." />
      {health ? <SystemHealthPanel health={health} appInfo={getAppInfo()} /> : null}
      {canManageSchoolSettings ? <SchoolSettingsForm settings={settings} /> : (
        <section className="card card-pad">
          <h3>School Profile</h3>
          <p>{settings.schoolName}, {settings.city}</p>
          <p className="muted-text">Your role can view settings but cannot edit school profile values.</p>
        </section>
      )}
      {canManageFeeStructures ? <FeeStructureEditor rows={rows} defaultAcademicYear={settings.academicYear} /> : null}
    </div>
  );
}
