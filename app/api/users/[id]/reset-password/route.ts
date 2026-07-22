import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import { assertCanManageUser, validateNewPassword } from "@/lib/user-management";
import { logUserAction } from "@/lib/user-audit";

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
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash: await hashPassword(password) } });
      await logUserAction(tx, {
        action: "PASSWORD_RESET",
        actor: auth.user,
        targetUserId: id,
        details: { username: target.username }
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
