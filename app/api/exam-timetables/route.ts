import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examinationTimetableApiError, examTimetableJson } from "@/lib/examination-timetable-api";
import { createExaminationTimetable, listExaminationTimetables } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireApiPermission("VIEW_EXAM_TIMETABLE");
  if (auth.response) return auth.response;
  return examTimetableJson({ timetables: await listExaminationTimetables(prisma) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_EXAM_TIMETABLE");
  if (auth.response || !auth.user) return auth.response;
  try {
    return examTimetableJson({ timetable: await createExaminationTimetable(prisma, await request.json(), auth.user) }, 201);
  } catch (error) {
    return examinationTimetableApiError(error);
  }
}
