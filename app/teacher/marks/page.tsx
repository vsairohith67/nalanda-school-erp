import { GovernedMarkEntryGrid } from "@/components/governed-mark-entry-grid";
import { PageHeader } from "@/components/ui";
import { requireRolePermission } from "@/lib/auth";
import { loadTeacherMarksWorkspace } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function TeacherMarksPage({
  searchParams
}: {
  searchParams: Promise<{ assignmentId?: string }>;
}) {
  const user = await requireRolePermission("VIEW_OWN_EXAM_MARKS", "TEACHER");
  const { assignmentId } = await searchParams;
  const initialData = await loadTeacherMarksWorkspace(prisma, user, assignmentId);
  return (
    <div className="page governed-marks-page">
      <PageHeader
        title="Marks Entry"
        description="Exact examination assignments only. Autosave creates drafts; final submission always requires a separate governed action."
      />
      <GovernedMarkEntryGrid initialData={initialData} />
    </div>
  );
}
