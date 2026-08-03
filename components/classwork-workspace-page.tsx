import { PageHeader } from "@/components/ui";
import { ClassworkWorkspace } from "@/components/classwork-workspace";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { loadClassworkWorkspace } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export async function ClassworkWorkspacePage() {
  const user = await requirePermission("VIEW_CLASSWORK");
  const [permissions, settings] = await Promise.all([getCurrentUserEffectivePermissions(), getSchoolSettings(prisma)]);
  const workspace = await loadClassworkWorkspace(prisma, user, settings.academicYear);
  return <div className="page classwork-page"><PageHeader title="Classwork and Secure Submissions" description={user.role === "VIEWER" ? "Suppressed completion aggregates only; Student and submission details are unavailable." : "Versioned instructions, private attachments, exact-scope submissions and append-only Teacher feedback."} />
    <ClassworkWorkspace initial={workspace as never} permissions={[...permissions]} />
  </div>;
}
