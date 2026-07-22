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

export async function PUT(request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const auth = await requireApiPermission(permissionForResource(resource));
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    let updated: unknown;
    if (resource === "teachers") {
      updated = await prisma.timetableTeacher.update({ where: { id }, data: validateTeacherInput(body) });
    } else if (resource === "subjects") {
      updated = await prisma.timetableSubject.update({ where: { id }, data: validateSubjectInput(body) });
    } else if (resource === "classes") {
      updated = await prisma.timetableClassSection.update({ where: { id }, data: validateClassInput(body) });
    } else if (resource === "assignments") {
      updated = await prisma.timetableAssignment.update({
        where: { id },
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
    } else if (resource === "period-templates") {
      const type = requiredText(body.type, "Period type");
      updated = await prisma.timetablePeriodTemplate.update({
        where: { id },
        data: {
          label: requiredText(body.label, "Label"),
          startTime: requiredText(body.startTime, "Start time"),
          endTime: requiredText(body.endTime, "End time"),
          type,
          isTeachingPeriod: type === "TEACHING",
          periodNumber: positiveInt(body.periodNumber, "Period number", true)
        }
      });
    } else {
      return NextResponse.json({ error: "This timetable resource cannot be edited here" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error) }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ resource: string; id: string }> }) {
  const { resource, id } = await context.params;
  const auth = await requireApiPermission(permissionForResource(resource));
  if (auth.response) return auth.response;
  try {
    if (resource === "assignments") await prisma.timetableAssignment.delete({ where: { id } });
    else if (resource === "unavailability") await prisma.timetableTeacherUnavailability.delete({ where: { id } });
    else if (resource === "fixed-periods") await prisma.timetableFixedPeriod.delete({ where: { id } });
    else return NextResponse.json({ error: "Use inactive status instead of deleting this master record" }, { status: 400 });
    return NextResponse.json({ ok: true });
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
  const message = safeClientError(error, "Unable to update timetable data");
  if (message.includes("Unique constraint")) return "This record already exists. Check the short code or selected mapping.";
  if (message.includes("Foreign key constraint")) return "This record is still being used by timetable setup.";
  return message;
}
