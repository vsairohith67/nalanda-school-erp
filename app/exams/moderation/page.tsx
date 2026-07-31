import { ExamModerationDashboard } from "@/components/exam-moderation-dashboard";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { loadMarksModerationDashboard } from "@/lib/exam-calculations-v2";
import { prisma } from "@/lib/prisma";
import { hasRolePermission } from "@/lib/role-permissions";

export const dynamic = "force-dynamic";

export default async function ExamModerationPage({
  searchParams
}: {
  searchParams: Promise<{ examinationId?: string; classScopeId?: string }>;
}) {
  const user = await requirePermission("VIEW_EXAM_MODERATION");
  const selection = await searchParams;
  const [initialData, canModerate, canReopen, canCalculate, canLock] = await Promise.all([
    loadMarksModerationDashboard(prisma, selection),
    hasRolePermission(prisma, user.role, "MODERATE_EXAM_MARKS"),
    hasRolePermission(prisma, user.role, "REOPEN_EXAM_MARK_SHEETS"),
    hasRolePermission(prisma, user.role, "RUN_EXAM_CALCULATIONS"),
    hasRolePermission(prisma, user.role, "LOCK_EXAM_CALCULATIONS")
  ]);
  return (
    <div className="page exam-moderation-page">
      <PageHeader
        title="Marks Moderation"
        description="Review exact submission scope, governed corrections, deterministic calculations and lock evidence. Publication is not part of this workflow."
      />
      <ExamModerationDashboard
        initialData={initialData}
        actorRole={user.role}
        permissions={{ canModerate, canReopen, canCalculate, canLock }}
      />
    </div>
  );
}
