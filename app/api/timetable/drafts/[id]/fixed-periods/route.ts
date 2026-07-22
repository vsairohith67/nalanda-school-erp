import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const draft = await prisma.timetableDraft.findUnique({ where: { id } });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  if (draft.status === "ARCHIVED") return NextResponse.json({ error: "Archived drafts are read-only." }, { status: 409 });
  const fixedPeriods = await prisma.timetableFixedPeriod.findMany({ where: { academicYear: draft.academicYear, classSectionId: { not: null } } });
  let applied = 0;
  let skipped = 0;
  for (const fixed of fixedPeriods) {
    const existing = await prisma.timetableEntry.findUnique({
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
      ? await prisma.timetableAssignment.findFirst({
          where: {
            academicYear: draft.academicYear,
            classSectionId: fixed.classSectionId!,
            teacherId: fixed.teacherId,
            subjectId: fixed.subjectId
          }
        })
      : null;
    await prisma.timetableEntry.create({
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
  const entries = await prisma.timetableEntry.findMany({ where: { draftId: id } });
  return NextResponse.json({ applied, skipped, entries });
}
