import { EmptyState, PageHeader } from "@/components/ui";
import { ClassworkWorkspace } from "@/components/classwork-workspace";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { ClassworkAccessError } from "@/lib/classwork-access";
import { loadClassworkWorkspace } from "@/lib/classwork";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export async function ClassworkWorkspacePage() {
  const user = await requirePermission("VIEW_CLASSWORK");
  const [permissions, settings] = await Promise.all([getCurrentUserEffectivePermissions(), getSchoolSettings(prisma)]);
  let workspace: Awaited<ReturnType<typeof loadClassworkWorkspace>>;
  try {
    workspace = await loadClassworkWorkspace(prisma, user, settings.academicYear);
  } catch (error) {
    if (user.role === "TEACHER" && error instanceof ClassworkAccessError && ["TEACHER_SCOPE_MISSING", "TEACHER_SCOPE_EMPTY"].includes(error.code)) {
      return <div className="page classwork-page"><PageHeader title="Classwork and Secure Submissions" description="Versioned instructions, private attachments, exact-scope submissions and append-only Teacher feedback." />
        <section className="card card-pad" aria-label="No active classwork scope"><EmptyState title="No active classwork scope" description="An active Staff link and exact timetable class, section, and subject assignment are required. Permission alone never reveals another cohort." /></section>
      </div>;
    }
    throw error;
  }
  return <div className="page classwork-page"><PageHeader title="Classwork and Secure Submissions" description={user.role === "VIEWER" ? "Suppressed completion aggregates only; Student and submission details are unavailable." : "Versioned instructions, private attachments, exact-scope submissions and append-only Teacher feedback."} />
    <ClassworkWorkspace initial={workspace as never} permissions={[...permissions]} />
  </div>;
}
