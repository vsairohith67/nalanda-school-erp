import { NextResponse } from "next/server";
import { ExaminationTimetableError } from "@/lib/examination-timetables";

export const EXAM_TIMETABLE_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8"
};

export function examTimetableJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: EXAM_TIMETABLE_PRIVATE_HEADERS });
}

export function examinationTimetableApiError(error: unknown) {
  if (error instanceof ExaminationTimetableError) {
    return examTimetableJson({ error: error.message, code: error.code, issues: error.issues }, error.status);
  }
  return examTimetableJson({ error: "The examination timetable request could not be completed safely." }, 500);
}
