import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { validateOwnPasswordChange } from "@/lib/password-control";
import { logUserAction } from "@/lib/user-audit";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  try {
    const body = await request.json();
    const currentPassword = String(body.currentPassword ?? "");
    const newPassword = String(body.newPassword ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    if (!account) return NextResponse.json({ error: "User account not found" }, { status: 404 });
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
    return NextResponse.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to change password") },
      { status: 400 }
    );
  }
}
