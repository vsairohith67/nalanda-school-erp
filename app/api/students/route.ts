import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateStudentPayload } from "@/lib/validation";
import { requireApiPermission } from "@/lib/auth";
import { maskPhone } from "@/lib/privacy";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_STUDENTS");
  if (auth.response) return auth.response;
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q")?.trim();
  const students = await prisma.student.findMany({
    where: {
      deletedAt: null,
      ...(searchParams.get("academicYear") ? { academicYear: searchParams.get("academicYear")! } : {}),
      ...(searchParams.get("className") ? { className: searchParams.get("className")! } : {}),
      ...(searchParams.get("status") ? { status: searchParams.get("status")! } : {}),
      ...(query
        ? {
            OR: [
              { admissionNo: { contains: query } },
              { studentName: { contains: query } },
              { fatherName: { contains: query } },
              { phone1: { contains: query } },
              { phone2: { contains: query } },
              { whatsappNumber: { contains: query } }
            ]
          }
        : {})
    },
    orderBy: [{ className: "asc" }, { section: "asc" }, { studentName: "asc" }]
  });
  return NextResponse.json(
    auth.user.role === "VIEWER"
      ? students.map((student) => ({
          ...student,
          phone1: maskPhone(student.phone1),
          phone2: maskPhone(student.phone2),
          whatsappNumber: maskPhone(student.whatsappNumber)
        }))
      : students
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_STUDENTS");
  if (auth.response) return auth.response;
  try {
    const payload = validateStudentPayload(await request.json());
    const student = await prisma.student.create({ data: payload });
    return NextResponse.json(student, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to save student") }, { status: 400 });
  }
}
