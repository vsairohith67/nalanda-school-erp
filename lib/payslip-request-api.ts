import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import type { CanonicalPermission } from "@/lib/permissions";
import { PAYSLIP_PRIVATE_HEADERS, PayslipRequestError } from "@/lib/payslip-request";
import { PayslipSecretError } from "@/lib/payslip-request-crypto";
import { PayslipPdfError } from "@/lib/payslip-request-pdf";
import { prisma } from "@/lib/prisma";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";

export function payslipJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PAYSLIP_PRIVATE_HEADERS });
}

export async function payslipBody(request: NextRequest) {
  if (!unsafeRequestOriginAllowed(request)) throw new PayslipRequestError("The request origin is not allowed.", 403, "ORIGIN_DENIED");
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new PayslipRequestError("Use an application/json request body.", 415, "JSON_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && (!Number.isSafeInteger(length) || length < 0 || length > 128 * 1024)) throw new PayslipRequestError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PayslipRequestError("A JSON object is required.");
  return body as Record<string, unknown>;
}

export function payslipError(error: unknown) {
  if (error instanceof PayslipRequestError || error instanceof PayslipPdfError) return payslipJson({ error: error.message, code: error.code }, error.status);
  if (error instanceof PayslipSecretError) return payslipJson({ error: error.message, code: "PAYSLIP_SECRET_UNAVAILABLE" }, 503);
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Re-authentication") || message.startsWith("Authorization changed")) return payslipJson({ error: message, code: "REAUTHENTICATION_REQUIRED" }, 403);
  console.error("PAYSLIP_REQUEST_FAILED");
  return payslipJson({ error: "The payslip request could not be completed safely." }, 500);
}

export async function requirePayslipAny(permissions: CanonicalPermission[], requiredRole?: string) {
  const context = await getCurrentAuthContext();
  if (!context) return { response: payslipJson({ error: "Authentication required" }, 401), user: null, context: null, permission: null };
  if (context.user.mustChangePassword) return { response: payslipJson({ error: "Password change required" }, 403), user: null, context: null, permission: null };
  if (requiredRole && context.user.role !== requiredRole) return { response: payslipJson({ error: "Switch to the Staff/Teacher context before accessing payslip requests." }, 403), user: null, context: null, permission: null };
  for (const permission of permissions) {
    const decision = await evaluateEffectivePermission(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId, permission });
    if (decision.allowed) return { response: null, user: context.user, context, permission };
  }
  return { response: payslipJson({ error: "You do not have permission for this payslip request action." }, 403), user: null, context: null, permission: null };
}
