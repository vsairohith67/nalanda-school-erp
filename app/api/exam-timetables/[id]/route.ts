import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examinationTimetableApiError, examTimetableJson } from "@/lib/examination-timetable-api";
import { getExaminationTimetable, saveExaminationTimetableDraft } from "@/lib/examination-timetables";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXAM_TIMETABLE");
  if (auth.response) return auth.response;
  try {
    return examTimetableJson({ timetable: await getExaminationTimetable(prisma, (await params).id) });
  } catch (error) {
    return examinationTimetableApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_EXAM_TIMETABLE");
  if (auth.response || !auth.user) return auth.response;
  try {
    return examTimetableJson({ timetable: await saveExaminationTimetableDraft(prisma, (await params).id, await request.json(), auth.user) });
  } catch (error) {
    return examinationTimetableApiError(error);
  }
}
