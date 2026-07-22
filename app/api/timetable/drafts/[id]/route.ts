import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { optionalText, requiredText, TIMETABLE_DRAFT_STATUSES } from "@/lib/timetable";

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const draft = await prisma.timetableDraft.findUnique({ where: { id } });
    if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    const action = String(body.action ?? "update");
    if (action === "activate") {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.timetableDraft.updateMany({
          where: { academicYear: draft.academicYear, status: "ACTIVE", id: { not: id } },
          data: { status: "DRAFT" }
        });
        return tx.timetableDraft.update({ where: { id }, data: { status: "ACTIVE" }, include: { entries: true } });
      });
      return NextResponse.json(updated);
    }
    const status = action === "archive" ? "ARCHIVED"
      : action === "restore" ? "DRAFT"
      : body.status === undefined ? draft.status : requiredText(body.status, "Status");
    if (!(TIMETABLE_DRAFT_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid draft status");
    const updated = await prisma.timetableDraft.update({
      where: { id },
      data: {
        name: body.name === undefined ? draft.name : requiredText(body.name, "Draft name"),
        notes: body.notes === undefined ? draft.notes : optionalText(body.notes),
        status
      },
      include: { entries: true }
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = safeClientError(error, "Unable to update draft");
    return NextResponse.json({ error: message.includes("Unique constraint") ? "A draft with this name already exists." : message }, { status: 400 });
  }
}
