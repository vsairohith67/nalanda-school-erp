import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resetRolePermissionsToDefaults } from "@/lib/role-permissions";

export async function POST() {
  const auth = await requireApiPermission("MANAGE_ROLE_PERMISSIONS");
  if (auth.response) return auth.response;
  const matrix = await resetRolePermissionsToDefaults(prisma);
  return NextResponse.json({
    matrix,
    message: "Recommended role permissions restored"
  });
}
