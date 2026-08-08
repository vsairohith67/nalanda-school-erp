import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { PayrollError, PAYROLL_PRIVATE_HEADERS } from "@/lib/payroll";
import { prisma } from "@/lib/prisma";
import type { CanonicalPermission } from "@/lib/permissions";

export function payrollJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: PAYROLL_PRIVATE_HEADERS });
}

export async function payrollBody(request: NextRequest) {
  const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
  if (type !== "application/json") throw new PayrollError("Use an application/json request body.", 415, "JSON_REQUIRED");
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length && (!Number.isSafeInteger(length) || length < 0 || length > 128 * 1024)) throw new PayrollError("The request body is too large.", 413, "PAYLOAD_TOO_LARGE");
  const body = await request.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new PayrollError("A JSON object is required.");
  return body as Record<string, unknown>;
}

export function payrollError(error: unknown) {
  if (error instanceof PayrollError) return payrollJson({ error: error.message, code: error.code }, error.status);
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Re-authentication") || message.startsWith("Authorization changed")) return payrollJson({ error: message, code: "REAUTHENTICATION_REQUIRED" }, 403);
  console.error("PAYROLL_REQUEST_FAILED");
  return payrollJson({ error: "The payroll request could not be completed safely." }, 500);
}

export async function requirePayrollAny(permissions: CanonicalPermission[], objectScopeSatisfied = true) {
  const context = await getCurrentAuthContext();
  if (!context) return { response: payrollJson({ error: "Authentication required" }, 401), user: null, context: null };
  if (context.user.mustChangePassword) return { response: payrollJson({ error: "Password change required" }, 403), user: null, context: null };
  for (const permission of permissions) {
    const decision = await evaluateEffectivePermission(prisma, {
      userId: context.user.id,
      sessionId: context.sessionId,
      roleAssignmentId: context.user.roleAssignmentId,
      permission,
      objectScopeSatisfied
    });
    if (decision.allowed) return { response: null, user: context.user, context, permission };
  }
  return { response: payrollJson({ error: "You do not have permission for this payroll action." }, 403), user: null, context: null };
}
