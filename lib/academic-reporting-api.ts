import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { prisma } from "@/lib/prisma";
import { AcademicReportingError } from "@/lib/academic-reporting";

export function academicReportJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function academicReportBody(request: NextRequest) {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new AcademicReportingError("Use an application/json request body.", 415, "JSON_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && (!Number.isSafeInteger(length) || length < 0 || length > 64 * 1024)) throw new AcademicReportingError("The report request is too large.", 413, "REPORT_REQUEST_TOO_LARGE");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new AcademicReportingError("A JSON object is required.");
  return body as Record<string, unknown>;
}

export async function requireAcademicReportAccess() {
  const context = await getCurrentAuthContext();
  if (!context) return { response: academicReportJson({ error: "Authentication required" }, 401), context: null };
  if (context.user.mustChangePassword) return { response: academicReportJson({ error: "Password change required" }, 403), context: null };
  const permission = permissionForRole(context.user.role);
  if (!permission) return { response: academicReportJson({ error: "This role is not authorised for academic reporting." }, 403), context: null };
  const decision = await evaluateEffectivePermission(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId, permission });
  if (!decision.allowed) return { response: academicReportJson({ error: "You do not have permission for academic reporting." }, 403), context: null };
  return { response: null, context };
}

export function academicReportError(error: unknown) {
  if (error instanceof AcademicReportingError) return academicReportJson({ error: error.message, code: error.code }, error.status);
  return academicReportJson({ error: "The academic report request could not be completed safely." }, 500);
}

function permissionForRole(role: string) {
  if (["SUPER_ADMIN","DIRECTOR","PRINCIPAL","VIEWER"].includes(role)) return "VIEW_REPORT_CARD_REPORTS";
  if (role === "TEACHER") return "VIEW_OWN_EXAM_MARKS";
  if (role === "PARENT" || role === "STUDENT") return "VIEW_OWN_REPORT_CARDS";
  return null;
}
