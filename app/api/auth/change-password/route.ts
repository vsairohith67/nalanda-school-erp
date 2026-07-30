import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { validateOwnPasswordChange } from "@/lib/password-control";
import { logUserAction } from "@/lib/user-audit";
import { sessionCookieName, sessionCookieSecure } from "@/lib/session-token";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return privateJson({ error: "Authentication required" }, 401);
  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (!account) return privateJson({ error: "User account not found" }, 404);
    await validateOwnPasswordChange({
      currentPassword,
      storedHash: account.passwordHash,
      newPassword,
      confirmPassword
    });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } });
      await logUserAction(tx, {
        action: "OWN_PASSWORD_CHANGED",
        actor: user,
        targetUserId: user.id
      });
    });
    const response = privateJson({
      success: true,
      message: "Password updated. Sign in again with your new password."
    }, 200);
    response.cookies.set(sessionCookieName(), "", {
      httpOnly: true,
      sameSite: "strict",
      secure: sessionCookieSecure(),
      path: "/",
      expires: new Date(0)
    });
    return response;
  } catch (error) {
    return privateJson({ error: safeClientError(error, "Unable to change password") }, 400);
  }
}

function privateJson(body: Record<string, unknown>, status: number) {
  const response = NextResponse.json(body, { status });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
