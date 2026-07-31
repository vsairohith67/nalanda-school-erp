import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumePasswordReset } from "@/lib/auth-recovery";
import { safeClientError } from "@/lib/client-errors";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const token = String(body.token ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    if (token.length > 128 || newPassword.length > 128 || confirmPassword.length > 128) {
      throw new Error("The reset request is invalid");
    }
    await consumePasswordReset(prisma, { token, newPassword, confirmPassword });
    return privateJson({ success: true, message: "Password updated. Sign in with your new password." }, 200);
  } catch (error) {
    return privateJson({ error: safeClientError(error, "The reset link is invalid or expired") }, 400);
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
