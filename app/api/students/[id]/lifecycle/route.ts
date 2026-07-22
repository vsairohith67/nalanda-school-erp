import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { studentLifecycleApiResponse } from "@/lib/student-lifecycle";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_STUDENT_LIFECYCLE");
  if (auth.response) return auth.response;
  const { id } = await params;
  const student = await prisma.student.findFirst({
    where: { id, deletedAt: null },
    select: {
      admissionNo: true, studentName: true,
      academicYearEnrollments: {
        orderBy: [{ academicYear: "desc" }, { createdAt: "desc" }],
        select: { academicYear: true, className: true, section: true, rollNo: true, status: true, enrollmentDate: true, exitDate: true, exitReason: true, notes: true }
      },
      lifecycleEvents: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        select: { academicYear: true, eventType: true, fromClass: true, fromSection: true, toClass: true, toSection: true, fromStatus: true, toStatus: true, effectiveDate: true, reason: true, evidenceNotes: true, parentAcknowledgementNotes: true }
      }
    }
  });
  if (!student) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json(studentLifecycleApiResponse(student));
}
