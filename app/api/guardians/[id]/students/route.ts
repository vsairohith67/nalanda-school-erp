import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { GUARDIAN_RELATIONSHIPS } from "@/lib/guardian-constants";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const admissionNo = String(body.admissionNo ?? "").trim();
    if (!admissionNo) throw new Error("Admission number is required");
    const [guardian, student] = await Promise.all([
      prisma.guardian.findUnique({ where: { id } }),
      prisma.student.findUnique({ where: { admissionNo } })
    ]);
    if (!guardian) throw new Error("Guardian not found");
    if (!student || student.deletedAt) throw new Error("Student not found");

    const existingLink = await prisma.studentGuardian.findUnique({
      where: { guardianId_studentId: { guardianId: guardian.id, studentId: student.id } }
    });
    if (existingLink) {
      return NextResponse.json(
        { error: "This guardian is already linked to this student. Remove the existing link before adding it again." },
        { status: 409 }
      );
    }

    const relationship = normalizeRelationship(body.relationshipToStudent ?? body.relationship);
    const isPrimaryContact = body.isPrimaryContact === true;
    if (isPrimaryContact) {
      await prisma.studentGuardian.updateMany({
        where: { studentId: student.id, guardianId: { not: guardian.id } },
        data: { isPrimaryContact: false }
      });
    }
    const link = await prisma.studentGuardian.create({
      data: {
        guardianId: guardian.id,
        studentId: student.id,
        relationshipToStudent: relationship,
        isPrimaryContact,
        canViewFees: body.canViewFees !== false,
        canReceiveReminders: body.canReceiveReminders !== false
      }
    });
    return NextResponse.json({ link });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to link student") },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const studentId = String(body.studentId ?? "").trim();
    if (!studentId) throw new Error("Student ID is required");
    await prisma.studentGuardian.delete({
      where: { guardianId_studentId: { guardianId: id, studentId } }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to remove student link") },
      { status: 400 }
    );
  }
}

function normalizeRelationship(value: unknown) {
  const text = String(value ?? "Parent").trim();
  return (GUARDIAN_RELATIONSHIPS as readonly string[]).includes(text) ? text : "Other";
}
