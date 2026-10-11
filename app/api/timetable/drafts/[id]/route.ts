import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { withTimetableMutation, TimetableMutationError } from "@/lib/timetable-mutation-service";
import { optionalText, requiredText, TIMETABLE_DRAFT_STATUSES } from "@/lib/timetable";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const authContext = await getCurrentAuthContext();
    if (!authContext) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    return await withTimetableMutation(prisma, { userId: authContext.user.id, sessionId: authContext.sessionId, roleAssignmentId: authContext.user.roleAssignmentId }, "MANAGE_TIMETABLE_BUILDER", { kind: "draft", id }, async tx => {
    const draft = await tx.timetableDraft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    const action = String(body.action ?? "update");
    if (action === "activate" || (action === "update" && body.status === "ACTIVE")) {
        await tx.timetableDraft.updateMany({
          where: { academicYear: draft.academicYear, status: "ACTIVE", id: { not: id } },
          data: { status: "DRAFT" }
        });
      const updated = await tx.timetableDraft.update({ where: { id }, data: {
        status: "ACTIVE",
        ...(action === "update" && body.name !== undefined ? { name: requiredText(body.name, "Draft name") } : {}),
        ...(action === "update" && body.notes !== undefined ? { notes: optionalText(body.notes) } : {})
      }, include: { entries: true } });
      return NextResponse.json(updated);
    }
    const status = action === "archive" ? "ARCHIVED"
      : action === "restore" ? "DRAFT"
      : body.status === undefined ? draft.status : requiredText(body.status, "Status");
    if (!(TIMETABLE_DRAFT_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid draft status");
    const updated = await tx.timetableDraft.update({
      where: { id },
      data: {
        name: body.name === undefined ? draft.name : requiredText(body.name, "Draft name"),
        notes: body.notes === undefined ? draft.notes : optionalText(body.notes),
        status
      },
      include: { entries: true }
    });
    return NextResponse.json(updated);
    });
  } catch (error) {
    const message = safeClientError(error, "Unable to update draft");
    return NextResponse.json({ error: message.includes("Unique constraint") ? "A draft with this name already exists." : message }, { status: error instanceof TimetableMutationError ? error.status : 400 });
  }
}
