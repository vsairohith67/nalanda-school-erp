import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";

export async function GET(_: NextRequest, context: { params: Promise<{ admissionNo: string }> }) {
  const auth = await requireApiPermission("VIEW_STUDENTS");
  if (auth.response) return auth.response;
  const { admissionNo } = await context.params;
  const student = await prisma.student.findUnique({ where: { admissionNo: decodeURIComponent(admissionNo) } });
  if (!student || student.deletedAt) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json(student);
}
