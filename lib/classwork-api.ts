import { NextRequest, NextResponse } from "next/server";
import type { AuthUser } from "@/lib/auth";
import { getCurrentAuthContext } from "@/lib/auth";
import { ClassworkAccessError, resolveClassworkLearnerContext } from "@/lib/classwork-access";
import { ClassworkError, classworkPrivateHeaders } from "@/lib/classwork";
import { ClassworkFileError } from "@/lib/classwork-files";
import { prisma } from "@/lib/prisma";
import { getSchoolSettings } from "@/lib/school-settings";

export function classworkJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: classworkPrivateHeaders() }); }

export function classworkApiError(error: unknown) {
  if (error instanceof ClassworkAccessError) return classworkJson({ error: error.status === 403 ? error.message : "The requested classwork record is unavailable.", code: error.code }, error.status);
  if (error instanceof ClassworkError) return classworkJson({ error: error.message, code: error.code }, error.status);
  if (error instanceof ClassworkFileError) return classworkJson({ error: error.message }, error.status);
  if (error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "P2002") return classworkJson({ error: "The request conflicts with a preserved classwork record." }, 409);
  return classworkJson({ error: "The classwork request could not be completed safely." }, 500);
}

export async function classworkJsonBody(request: NextRequest, maximumBytes = 64 * 1024) {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new ClassworkError("Use an application/json request body.", 415);
  assertContentLength(request, maximumBytes);
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new ClassworkError("A JSON object is required.");
  return body as Record<string, unknown>;
}

export function assertClassworkMultipart(request: NextRequest) {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) throw new ClassworkError("Use a multipart form upload.", 415);
  assertContentLength(request, 6 * 1024 * 1024);
}

export async function requestLearnerContext(request: NextRequest, user: AuthUser, body?: Record<string, unknown>) {
  const auth = await getCurrentAuthContext();
  if (!auth || auth.user.id !== user.id || auth.user.roleAssignmentId !== user.roleAssignmentId) throw new ClassworkAccessError("Authentication required.", 401);
  const settings = await getSchoolSettings(prisma);
  const childHandle = String(body?.childContext ?? request.nextUrl.searchParams.get("childContext") ?? "").trim() || null;
  const rawVersion = body?.contextVersion ?? request.nextUrl.searchParams.get("contextVersion");
  const contextVersion = rawVersion == null || rawVersion === "" ? null : Number(rawVersion);
  if (contextVersion != null && (!Number.isSafeInteger(contextVersion) || contextVersion < 1)) throw new ClassworkError("The linked-child context version is invalid.");
  return resolveClassworkLearnerContext(prisma, { user: auth.user, sessionId: auth.sessionId, academicYear: settings.academicYear, childHandle, expectedContextVersion: contextVersion });
}

function assertContentLength(request: NextRequest, maximum: number) {
  const raw = request.headers.get("content-length");
  if (!raw) return;
  const length = Number(raw);
  if (!Number.isSafeInteger(length) || length < 0 || length > maximum) throw new ClassworkError("The request body is too large.", 413);
}
