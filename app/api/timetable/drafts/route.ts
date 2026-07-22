import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { optionalText, requiredText, TIMETABLE_ACADEMIC_YEAR } from "@/lib/timetable";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_TIMETABLE_BUILDER");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const academicYear = requiredText(body.academicYear ?? TIMETABLE_ACADEMIC_YEAR, "Academic year");
    if (body.action === "duplicate") {
      const sourceId = requiredText(body.sourceId, "Source draft");
      const source = await prisma.timetableDraft.findUnique({ where: { id: sourceId }, include: { entries: true } });
      if (!source) return NextResponse.json({ error: "Draft not found" }, { status: 404 });
      const name = requiredText(body.name, "Draft name");
      const draft = await prisma.timetableDraft.create({
        data: {
          academicYear: source.academicYear,
          name,
          status: "DRAFT",
          notes: source.notes,
          createdByUserId: auth.user.id,
          entries: {
            create: source.entries.map(({ id: _id, draftId: _draftId, createdAt: _createdAt, updatedAt: _updatedAt, ...entry }) => entry)
          }
        },
        include: { entries: true }
      });
      return NextResponse.json(draft, { status: 201 });
    }
    const draft = await prisma.timetableDraft.create({
      data: {
        academicYear,
        name: requiredText(body.name, "Draft name"),
        notes: optionalText(body.notes),
        createdByUserId: auth.user.id
      },
      include: { entries: true }
    });
    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  }
}

function friendlyError(error: unknown) {
  const message = safeClientError(error, "Unable to create draft");
  return message.includes("Unique constraint") ? "A draft with this name already exists for the academic year." : message;
}
