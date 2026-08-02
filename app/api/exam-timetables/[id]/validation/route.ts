import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examinationTimetableApiError, examTimetableJson } from "@/lib/examination-timetable-api";
import { inspectExaminationTimetable } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXAM_TIMETABLE");
  if (auth.response) return auth.response;
  try {
    return examTimetableJson({ validation: await inspectExaminationTimetable(prisma, (await params).id) });
  } catch (error) {
    return examinationTimetableApiError(error);
  }
}
