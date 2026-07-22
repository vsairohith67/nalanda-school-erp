import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireApiPermission } from "@/lib/auth";
import { createClassXPackage, safeClassXPackage } from "@/lib/class-x-document-packages";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  const p = request.nextUrl.searchParams, where: Prisma.ClassXDocumentPackageWhereInput = {};
  for (const field of ["academicYear", "status", "requestSource"] as const) if (p.get(field)) where[field] = p.get(field)!;
  if (p.get("paymentStatus")) where.charge = { is: { status: p.get("paymentStatus")! } };
  const rows = await prisma.classXDocumentPackage.findMany({ where, include: { student: { select: { admissionNo: true, studentName: true, className: true, section: true } }, charge: true }, orderBy: { createdAt: "desc" }, take: 500 });
  return NextResponse.json({ packages: rows.map((row) => ({ id: row.id, ...safeClassXPackage(row), student: row.student, paymentStatus: row.charge?.status ?? "NOT_REQUIRED" })) });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_CLASS_X_PACKAGES"); if (auth.response) return auth.response;
  try { const row = await createClassXPackage(prisma, await request.json(), { id: auth.user.id, source: "INTERNAL" }); return NextResponse.json({ package: { id: row.id, packageNumber: row.packageNumber, status: row.status } }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to create Class X package") }, { status: 400 }); }
}
