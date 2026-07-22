import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import {
  TIMETABLE_ACADEMIC_YEAR,
  boolValue,
  optionalText,
  positiveInt,
  requiredText,
  validateClassInput,
  validateSubjectInput,
  validateTeacherInput
} from "@/lib/timetable";

export async function POST(request: NextRequest, context: { params: Promise<{ resource: string }> }) {
  const { resource } = await context.params;
  const auth = await requireApiPermission(permissionForResource(resource));
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    let created: unknown;
    if (resource === "teachers") {
      created = await prisma.timetableTeacher.create({ data: validateTeacherInput(body) });
    } else if (resource === "subjects") {
      created = await prisma.timetableSubject.create({ data: validateSubjectInput(body) });
    } else if (resource === "classes") {
      created = await prisma.timetableClassSection.create({ data: validateClassInput(body) });
    } else if (resource === "assignments") {
      created = await prisma.timetableAssignment.create({
        data: {
          academicYear: requiredText(body.academicYear ?? TIMETABLE_ACADEMIC_YEAR, "Academic year"),
          classSectionId: requiredText(body.classSectionId, "Class section"),
          subjectId: requiredText(body.subjectId, "Subject"),
          teacherId: requiredText(body.teacherId, "Teacher"),
          periodsPerWeek: positiveInt(body.periodsPerWeek, "Periods per week")!,
          allowConsecutiveOverride: body.allowConsecutiveOverride === "" || body.allowConsecutiveOverride === undefined
            ? null
            : boolValue(body.allowConsecutiveOverride),
          priority: positiveInt(body.priority, "Priority", true),
          notes: optionalText(body.notes)
        }
      });
    } else if (resource === "unavailability") {
      created = await prisma.timetableTeacherUnavailability.create({
        data: {
          teacherId: requiredText(body.teacherId, "Teacher"),
          dayOfWeek: requiredText(body.dayOfWeek, "Day"),
          periodNumber: positiveInt(body.periodNumber, "Period")!,
          reason: optionalText(body.reason)
        }
      });
    } else if (resource === "fixed-periods") {
      const classSectionId = optionalText(body.classSectionId);
      const teacherId = optionalText(body.teacherId);
      const subjectId = optionalText(body.subjectId);
      if (!classSectionId && !teacherId && !subjectId) throw new Error("Choose at least one class section, teacher, or subject");
      created = await prisma.timetableFixedPeriod.create({
        data: {
          academicYear: requiredText(body.academicYear ?? TIMETABLE_ACADEMIC_YEAR, "Academic year"),
          classSectionId,
          teacherId,
          subjectId,
          dayOfWeek: requiredText(body.dayOfWeek, "Day"),
          periodNumber: positiveInt(body.periodNumber, "Period")!,
          label: requiredText(body.label, "Label"),
          reason: optionalText(body.reason)
        }
      });
    } else {
      return NextResponse.json({ error: "Unknown timetable resource" }, { status: 404 });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  }
}

function permissionForResource(resource: string) {
  return resource === "assignments"
    ? "MANAGE_TIMETABLE_ASSIGNMENTS"
    : "MANAGE_TIMETABLE_MASTER";
}

function friendlyError(error: unknown) {
  const message = safeClientError(error, "Unable to save timetable data");
  if (message.includes("Unique constraint")) return "This record already exists. Check the short code or selected class, subject, teacher, day, and period.";
  if (message.includes("Foreign key constraint")) return "A selected teacher, subject, or class section no longer exists.";
  return message;
}
