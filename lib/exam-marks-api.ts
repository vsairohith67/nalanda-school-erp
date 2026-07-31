import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { ExamMarksError } from "@/lib/exam-marks";
import { ExamMarksScopeError } from "@/lib/exam-marks-scope";
import type { Permission } from "@/lib/permissions";

export const EXAM_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "Content-Type": "application/json; charset=utf-8"
};

export function examPrivateJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, {
    status: init?.status,
    headers: EXAM_PRIVATE_HEADERS
  });
}

export function examMarksApiError(error: unknown) {
  if (error instanceof ExamMarksScopeError) {
    return examPrivateJson({ error: "The requested examination marks scope is unavailable." }, { status: error.status });
  }
  if (error instanceof ExamMarksError) {
    return examPrivateJson({ error: error.message, code: error.code }, { status: error.status });
  }
  return examPrivateJson(
    { error: "The governed examination marks request could not be completed safely." },
    { status: 500 }
  );
}

export async function requireExamModerationMutation(permission: Permission) {
  const auth = await requireApiPermission(permission);
  if (auth.response || !auth.user) return auth;
  if (auth.user.role !== "SUPER_ADMIN") return auth;
  const intervention = await requireApiPermission("INTERVENE_EXAM_MARKS");
  if (intervention.response || !intervention.user) return intervention;
  return auth;
}
