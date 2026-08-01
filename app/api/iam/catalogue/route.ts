import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PERMISSIONS, ROLES } from "@/lib/permissions";
import { permissionLabel } from "@/lib/permissions";
import { permissionDelegability } from "@/lib/iam/permission-governance";
import { roleDisplayLabel } from "@/lib/role-presentation";

export async function GET() {
  const auth = await requireApiPermission("VIEW_IAM_ACCESS");
  if (auth.response) return auth.response;
  const [staff, guardians] = await Promise.all([
    prisma.staffMember.findMany({ where: { userId: null }, select: { iamPublicKey: true, fullName: true, staffCode: true, status: true }, orderBy: { fullName: "asc" }, take: 200 }),
    prisma.guardian.findMany({ where: { users: { none: {} } }, select: { iamPublicKey: true, displayName: true, status: true }, orderBy: { displayName: "asc" }, take: 200 })
  ]);
  const response = NextResponse.json({
    roles: ROLES.map((role) => ({ value: role, label: roleDisplayLabel(role) })),
    permissions: PERMISSIONS.map((permission) => ({ value: permission, label: permissionLabel(permission), classification: permissionDelegability(permission).replaceAll("_", " ") })),
    staff: staff.filter((row) => row.iamPublicKey).map((row) => ({ handle: row.iamPublicKey, label: `${row.fullName}${row.staffCode ? ` (${row.staffCode})` : ""}`, status: row.status })),
    guardians: guardians.filter((row) => row.iamPublicKey).map((row) => ({ handle: row.iamPublicKey, label: row.displayName, status: row.status }))
  });
  response.headers.set("cache-control", "private, no-store");
  return response;
}
