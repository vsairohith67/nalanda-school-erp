import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { updateStudentRecord } from "@/lib/authoritative-record-services";

export async function GET(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_STUDENTS");
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const student = await prisma.student.findUnique({ where: { id } });
  if (!student || student.deletedAt) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }
  return NextResponse.json(student);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("EDIT_STUDENTS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const student = await updateStudentRecord(prisma, id, await request.json());
    return NextResponse.json(student);
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to update student") }, { status: 400 });
  }
}

export async function DELETE(_: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("EDIT_STUDENTS");
  if (auth.response) return auth.response;
  if (auth.user.role !== "DIRECTOR") {
    return NextResponse.json({ error: "Only the Director can deactivate a student record" }, { status: 403 });
  }
  const { id } = await context.params;
  const student = await prisma.student.update({ where: { id }, data: { deletedAt: new Date(), status: "Left" } });
  return NextResponse.json(student);
}
