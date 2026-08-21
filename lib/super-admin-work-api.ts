import { NextResponse } from "next/server";
import { SuperAdminWorkError } from "@/lib/super-admin-work";

export const SUPER_ADMIN_WORK_PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
  "Vary": "Cookie"
} as const;

export function superAdminWorkJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SUPER_ADMIN_WORK_PRIVATE_HEADERS });
}

export async function parseSuperAdminWorkBody(request: Request) {
  const raw = await request.text();
  if (!raw || raw.length > 48_000) throw new SuperAdminWorkError("Request body is missing or too large.", 413, "WORK_REQUEST_SIZE");
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("object required");
    return value as Record<string, unknown>;
  } catch {
    throw new SuperAdminWorkError("Request body must be valid JSON.");
  }
}

export function superAdminWorkError(error: unknown) {
  if (error instanceof SuperAdminWorkError) return superAdminWorkJson({ error: error.message, code: error.code }, error.status);
  return superAdminWorkJson({ error: "The private work programme is temporarily unavailable.", code: "SUPER_ADMIN_WORK_UNAVAILABLE" }, 500);
}
