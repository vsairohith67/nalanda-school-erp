import { NextResponse } from "next/server";
import { AcademicCalendarError } from "@/lib/academic-calendar";

export const ACADEMIC_CALENDAR_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
  Vary: "Cookie"
};

export function academicCalendarJson(body: unknown, status = 200) {
  return NextResponse.json(sanitizeAcademicCalendarPayload(body), { status, headers: ACADEMIC_CALENDAR_PRIVATE_HEADERS });
}

export function sanitizeAcademicCalendarPayload(value: unknown): unknown {
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(sanitizeAcademicCalendarPayload);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => key !== "id" && !key.endsWith("Id") && !key.endsWith("UserId"))
    .map(([key, entry]) => [key, sanitizeAcademicCalendarPayload(entry)]));
}

export function academicCalendarApiError(error: unknown) {
  if (error instanceof AcademicCalendarError) {
    return academicCalendarJson({ error: error.message, code: error.code }, error.status);
  }
  const message = error instanceof Error ? error.message : "Calendar request failed.";
  if (/unique|constraint|changed|locked|busy|transaction/i.test(message)) {
    return academicCalendarJson({ error: "Calendar state changed. Refresh and review the latest version.", code: "CALENDAR_CONFLICT" }, 409);
  }
  return academicCalendarJson({ error: "The calendar request could not be completed safely.", code: "CALENDAR_SAFE_ERROR" }, 400);
}
