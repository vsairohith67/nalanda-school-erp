import { ExamModerationDashboard } from "@/components/exam-moderation-dashboard";
import { PageHeader } from "@/components/ui";
import { requirePermission, hasUserPermission } from "@/lib/auth";
import { loadMarksModerationDashboard } from "@/lib/exam-calculations-v2";
import { prisma } from "@/lib/prisma";


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
    hasUserPermission(user, "MODERATE_EXAM_MARKS"),
    hasUserPermission(user, "REOPEN_EXAM_MARK_SHEETS"),
    hasUserPermission(user, "RUN_EXAM_CALCULATIONS"),
    hasUserPermission(user, "LOCK_EXAM_CALCULATIONS")
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
