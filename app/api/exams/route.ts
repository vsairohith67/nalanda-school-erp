import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createExam, publicExam } from "@/lib/exams";
import { marksScopeWhere, resolveMarksScope } from "@/lib/marks-scope";
import { marksError } from "@/lib/marks-api";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_EXAMS"); if (auth.response) return auth.response;
  const academicYear = request.nextUrl.searchParams.get("academicYear") ?? undefined;
  const status = request.nextUrl.searchParams.get("status") ?? undefined;
  const scope = await resolveMarksScope(prisma, auth.user, academicYear);
  const assessmentWhere = marksScopeWhere(scope);
  const rows = await prisma.examCycle.findMany({ where: { ...(academicYear ? { academicYear } : {}), ...(status ? { status } : {}), ...(!scope.broad ? { assessments: { some: assessmentWhere } } : {}) }, include: { assessments: { where: assessmentWhere, orderBy: [{ className: "asc" }, { section: "asc" }, { subjectName: "asc" }] } }, orderBy: [{ startDate: "desc" }, { name: "asc" }] });
  return NextResponse.json({ exams: rows.map(publicExam), scopeReason: scope.reason });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_EXAMS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ exam: publicExam(await createExam(prisma, await request.json(), auth.user.id)) }, { status: 201 }); }
  catch (error) { const result = marksError(error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}
