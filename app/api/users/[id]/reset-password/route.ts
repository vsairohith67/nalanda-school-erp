import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import { assertCanManageUser, validateNewPassword } from "@/lib/user-management";
import { logUserAction } from "@/lib/user-audit";
import { logAuthSecurityEvent } from "@/lib/auth-security";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("RESET_USER_PASSWORDS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const password = String(body.password ?? "");
    const confirmPassword = String(body.confirmPassword ?? "");
    if (password !== confirmPassword) throw new Error("Password confirmation does not match");
    validateNewPassword(password);

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target || !isRole(target.role)) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    assertCanManageUser(auth.user.role, target.role);
    const passwordHash = await hashPassword(password);
    await prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.user.update({ where: { id }, data: { passwordHash, credentialVersion: { increment: 1 } } });
      await tx.authSession.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: now, revocationReason: "ADMIN_PASSWORD_RESET" }
      });
      await tx.authPasswordResetToken.updateMany({
        where: { userId: id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now, invalidationReason: "ADMIN_PASSWORD_RESET" }
      });
      await tx.authVerificationChallenge.updateMany({
        where: { userId: id, usedAt: null, invalidatedAt: null },
        data: { invalidatedAt: now }
      });
      await logUserAction(tx, {
        action: "PASSWORD_RESET",
        actor: auth.user,
        targetUserId: id
      });
      await logAuthSecurityEvent(tx, {
        eventType: "PASSWORD_RESET_BY_ADMIN",
        userId: id,
        actorUserId: auth.user.id,
        subjectType: "USER",
        subjectId: id,
        details: { sessionsRevoked: true }
      });
    });
    return NextResponse.json({ success: true, message: "Temporary password saved" });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to reset password") },
      { status: 400 }
    );
  }
}
