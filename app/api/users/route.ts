import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { isRole } from "@/lib/permissions";
import { assertCanAssignRole, SAFE_USER_SELECT, validateNewPassword } from "@/lib/user-management";
import { logUserAction } from "@/lib/user-audit";

export async function GET() {
  const auth = await requireApiPermission("VIEW_USERS");
  if (auth.response) return auth.response;
  const users = await prisma.user.findMany({
    select: SAFE_USER_SELECT,
    orderBy: [{ role: "asc" }, { name: "asc" }]
  });
  return NextResponse.json(users);
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_USERS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const name = requiredText(body.name, "Name");
    const username = requiredText(body.username, "Username").toLowerCase();
    const email = optionalText(body.email)?.toLowerCase() ?? null;
    const role = String(body.role ?? "");
    const password = String(body.password ?? "");
    if (!isRole(role)) throw new Error("A valid role is required");
    assertCanAssignRole(auth.user.role, role);
    validateNewPassword(password);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: { name, username, email, role, passwordHash: await hashPassword(password), isActive: true },
        select: SAFE_USER_SELECT
      });
      await logUserAction(tx, {
        action: "USER_CREATED",
        actor: auth.user,
        targetUserId: created.id,
        details: { username, role }
      });
      return created;
    });
    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: friendlyError(error, "Unable to create user") }, { status: 400 });
  }
}

function requiredText(value: unknown, label: string) {
  const result = String(value ?? "").trim();
  if (!result) throw new Error(`${label} is required`);
  return result;
}

function optionalText(value: unknown) {
  const result = String(value ?? "").trim();
  return result || null;
}

function friendlyError(error: unknown, fallback: string) {
  const message = safeClientError(error, fallback);
  return message.includes("Unique constraint") ? "Username or email is already in use" : message;
}
