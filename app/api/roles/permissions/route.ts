import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getRolePermissionMatrix,
  saveRolePermissionMatrix,
  validateRolePermissionPayload
} from "@/lib/role-permissions";

export async function GET() {
  const auth = await requireApiPermission("MANAGE_ROLE_PERMISSIONS");
  if (auth.response) return auth.response;
  return NextResponse.json({ matrix: await getRolePermissionMatrix(prisma) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_ROLE_PERMISSIONS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const matrix = validateRolePermissionPayload(body.matrix);
    await saveRolePermissionMatrix(prisma, matrix);
    return NextResponse.json({
      matrix: await getRolePermissionMatrix(prisma),
      message: "Role permissions saved"
    });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to save role permissions") },
      { status: 400 }
    );
  }
}
