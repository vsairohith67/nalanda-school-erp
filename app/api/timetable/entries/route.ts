import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { withTimetableMutation, TimetableMutationError } from "@/lib/timetable-mutation-service";
import {
  boolValue,
  optionalText,
  positiveInt,
  requiredText,
  TIMETABLE_ENTRY_TYPES
} from "@/lib/timetable";

export async function PUT(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const draftId = requiredText(body.draftId, "Draft");
    const classSectionId = requiredText(body.classSectionId, "Class section");
    const dayOfWeek = requiredText(body.dayOfWeek, "Day");
    const periodNumber = positiveInt(body.periodNumber, "Period")!;
    const context = await getCurrentAuthContext();
    if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return await withTimetableMutation(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId }, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: draftId }, async tx => {
    const draft = await tx.timetableDraft.findUnique({ where: { id: draftId } });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    if (draft.status === "ARCHIVED") return NextResponse.json({ error: "Archived drafts are read-only. Restore the draft first." }, { status: 409 });
    const existing = await tx.timetableEntry.findUnique({
      where: { draftId_classSectionId_dayOfWeek_periodNumber: { draftId, classSectionId, dayOfWeek, periodNumber } }
    });
    if (existing?.isLocked && body.isLocked !== false && body.isLocked !== "false") {
      return NextResponse.json({ error: "This is a locked period. Unlock it before changing it." }, { status: 409 });
    }
    const entryType = requiredText(body.entryType ?? "EMPTY", "Entry type");
    if (!(TIMETABLE_ENTRY_TYPES as readonly string[]).includes(entryType)) throw new Error("Invalid entry type");
    const assignmentId = optionalText(body.assignmentId);
    const assignment = assignmentId ? await tx.timetableAssignment.findUnique({ where: { id: assignmentId } }) : null;
    if (assignment && assignment.classSectionId !== classSectionId) {
      return NextResponse.json({ error: "The selected assignment does not belong to this class section." }, { status: 409 });
    }
    const teacherId = assignment?.teacherId ?? optionalText(body.teacherId);
    const subjectId = assignment?.subjectId ?? optionalText(body.subjectId);
    if (teacherId && ["TEACHING", "FIXED", "SUBSTITUTION"].includes(entryType)) {
      const teacherConflict = await tx.timetableEntry.findFirst({
        where: {
          draftId, teacherId, dayOfWeek, periodNumber,
          classSectionId: { not: classSectionId },
          entryType: { in: ["TEACHING", "FIXED", "SUBSTITUTION"] }
        },
        include: { classSection: true }
      });
      if (teacherConflict) {
        return NextResponse.json({ error: `Teacher is already assigned to ${teacherConflict.classSection.displayName} in this period.` }, { status: 409 });
      }
    }
    const data = {
      academicYear: draft.academicYear,
      assignmentId,
      teacherId,
      subjectId,
      label: optionalText(body.label),
      entryType,
      isLocked: boolValue(body.isLocked),
      notes: optionalText(body.notes)
    };
    const entry = await tx.timetableEntry.upsert({
      where: { draftId_classSectionId_dayOfWeek_periodNumber: { draftId, classSectionId, dayOfWeek, periodNumber } },
      update: data,
      create: { draftId, classSectionId, dayOfWeek, periodNumber, ...data }
    });
    return NextResponse.json(entry);
    });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to save timetable entry") }, { status: error instanceof TimetableMutationError ? error.status : 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const draftId = requiredText(body.draftId, "Draft");
    const classSectionId = requiredText(body.classSectionId, "Class section");
    const dayOfWeek = requiredText(body.dayOfWeek, "Day");
    const periodNumber = positiveInt(body.periodNumber, "Period")!;
    const context = await getCurrentAuthContext();
    if (!context) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return await withTimetableMutation(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId }, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id: draftId }, async tx => {
    const draft = await tx.timetableDraft.findUnique({ where: { id: draftId } });
    if (draft?.status === "ARCHIVED") return NextResponse.json({ error: "Archived drafts are read-only." }, { status: 409 });
    const existing = await tx.timetableEntry.findUnique({
      where: { draftId_classSectionId_dayOfWeek_periodNumber: { draftId, classSectionId, dayOfWeek, periodNumber } }
    });
    if (existing?.isLocked) return NextResponse.json({ error: "Unlock this period before clearing it." }, { status: 409 });
    if (existing) await tx.timetableEntry.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to clear timetable entry") }, { status: error instanceof TimetableMutationError ? error.status : 400 });
  }
}
