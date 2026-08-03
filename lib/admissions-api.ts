import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { evaluateEffectivePermission } from "@/lib/iam/effective-access";
import { prisma } from "@/lib/prisma";
import { AdmissionError } from "@/lib/admissions";
import type { CanonicalPermission } from "@/lib/permissions";

export const ADMISSIONS_PRIVATE_HEADERS = { "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" };
export function admissionsJson(body: unknown, status = 200) { return NextResponse.json(body, { status, headers: ADMISSIONS_PRIVATE_HEADERS }); }
export async function admissionsBody(request: NextRequest) { const type = request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase(); if (type !== "application/json") throw new AdmissionError("Use an application/json request body.", 415, "JSON_REQUIRED"); const length = Number(request.headers.get("content-length") ?? 0); if (length && (!Number.isSafeInteger(length) || length < 0 || length > 64 * 1024)) throw new AdmissionError("The request body is too large.", 413); const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) throw new AdmissionError("A JSON object is required."); return body as Record<string, unknown>; }
export function admissionsError(error: unknown) { if (error instanceof AdmissionError) return admissionsJson({ error: error.message, code: error.code }, error.status); console.error("ADMISSIONS_REQUEST_FAILED"); return admissionsJson({ error: "The admissions request could not be completed safely." }, 500); }
export async function requireAdmissionsAny(permissions: CanonicalPermission[]) { const context = await getCurrentAuthContext(); if (!context) return { response: admissionsJson({ error: "Authentication required" }, 401), user: null }; if (context.user.mustChangePassword) return { response: admissionsJson({ error: "Password change required" }, 403), user: null }; for (const permission of permissions) { const decision = await evaluateEffectivePermission(prisma, { userId: context.user.id, sessionId: context.sessionId, roleAssignmentId: context.user.roleAssignmentId, permission }); if (decision.allowed) return { response: null, user: context.user }; } return { response: admissionsJson({ error: "You do not have permission for this admissions action." }, 403), user: null }; }
export function invitationToken(request: NextRequest) { return request.headers.get("x-admission-invitation")?.trim() ?? ""; }
