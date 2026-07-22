import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { createClassXPackage } from "@/lib/class-x-document-packages";
import { getParentClassXPackages } from "@/lib/class-x-package-portals";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiRolePermission("VIEW_OWN_CHILD_CLASS_X_PACKAGE", "PARENT"); if (auth.response) return auth.response;
  try { return NextResponse.json(await getParentClassXPackages(prisma, auth.user.id, request.nextUrl.searchParams.get("student"))); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to load linked-child Class X packages") }, { status: 400 }); }
}
export async function POST(request: NextRequest) {
  const auth = await requireApiRolePermission("REQUEST_OWN_CHILD_CLASS_X_PACKAGE", "PARENT"); if (auth.response) return auth.response;
  try { const body = await request.json(), user = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { guardianId: true } }); if (!user?.guardianId) throw new Error("Parent account is not linked to a Guardian"); const link = await prisma.studentGuardian.findFirst({ where: { guardianId: user.guardianId, student: { admissionNo: String(body.admissionNo ?? ""), deletedAt: null } }, select: { studentId: true } }); if (!link) throw new Error("This Student is not linked to the signed-in Parent"); const row = await createClassXPackage(prisma, { ...body, studentId: link.studentId }, { id: auth.user.id, source: "PARENT_PORTAL", guardianId: user.guardianId }); return NextResponse.json({ package: { packageNumber: row.packageNumber, status: row.status } }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to submit Class X package request") }, { status: 400 }); }
}
