import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import { withTimetableMutation, TimetableMutationError } from "@/lib/timetable-mutation-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const authContext = await getCurrentAuthContext();
  if (!authContext) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
  return await withTimetableMutation(prisma, { userId: authContext.user.id, sessionId: authContext.sessionId, roleAssignmentId: authContext.user.roleAssignmentId }, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id }, async tx => {
  const draft = await tx.timetableDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status === "ARCHIVED") return NextResponse.json({ error: "Archived drafts are read-only." }, { status: 409 });
  const fixedPeriods = await tx.timetableFixedPeriod.findMany({ where: { academicYear: draft.academicYear, classSectionId: { not: null } } });
  let applied = 0;
  let skipped = 0;
  for (const fixed of fixedPeriods) {
    const existing = await tx.timetableEntry.findUnique({
      where: {
        draftId_classSectionId_dayOfWeek_periodNumber: {
          draftId: id,
          classSectionId: fixed.classSectionId!,
          dayOfWeek: fixed.dayOfWeek,
          periodNumber: fixed.periodNumber
        }
      }
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const assignment = fixed.teacherId && fixed.subjectId
      ? await tx.timetableAssignment.findFirst({
          where: {
            academicYear: draft.academicYear,
            classSectionId: fixed.classSectionId!,
            teacherId: fixed.teacherId,
            subjectId: fixed.subjectId
          }
        })
      : null;
    await tx.timetableEntry.create({
      data: {
        draftId: id,
        academicYear: draft.academicYear,
        classSectionId: fixed.classSectionId!,
        dayOfWeek: fixed.dayOfWeek,
        periodNumber: fixed.periodNumber,
        assignmentId: assignment?.id ?? null,
        teacherId: fixed.teacherId,
        subjectId: fixed.subjectId,
        label: fixed.label,
        entryType: "FIXED",
        isLocked: true,
        notes: fixed.reason
      }
    });
    applied += 1;
  }
  const entries = await tx.timetableEntry.findMany({ where: { draftId: id } });
  return NextResponse.json({ applied, skipped, entries });
  });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to apply fixed periods") }, { status: error instanceof TimetableMutationError ? error.status : 400 });
  }
}
