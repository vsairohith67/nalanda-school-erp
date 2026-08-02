import { NextResponse } from "next/server";
import { ParentAcademicAccessError } from "@/lib/parent-academics";

export const PARENT_ACADEMIC_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8",
  "X-Content-Type-Options": "nosniff",
  "Vary": "Cookie"
};

export function parentAcademicJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PARENT_ACADEMIC_PRIVATE_HEADERS });
}

export function parentAcademicApiError(error: unknown) {
  if (error instanceof ParentAcademicAccessError) {
    const message = error.status === 400 ? error.message : "The requested linked-child record is unavailable.";
    return parentAcademicJson({ error: message }, error.status);
  }
  return parentAcademicJson({ error: "The linked-child academic record could not be loaded safely." }, 500);
}

export function optionalContextVersion(value: string | null) {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) throw new ParentAcademicAccessError("The linked-child context is invalid.", 400);
  return parsed;
}
