import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createAssessment, publicAssessment } from "@/lib/exams";
import { marksScopeWhere, resolveMarksScope } from "@/lib/marks-scope";
import { marksError } from "@/lib/marks-api";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXAMS"); if (auth.response) return auth.response;
  const scope = await resolveMarksScope(prisma, auth.user);
  const rows = await prisma.examAssessment.findMany({ where: { examCycleId: (await params).id, ...marksScopeWhere(scope) }, orderBy: [{ className: "asc" }, { section: "asc" }, { subjectName: "asc" }] });
  return NextResponse.json({ assessments: rows.map(publicAssessment), scopeReason: scope.reason });
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CONFIGURE_EXAM_ASSESSMENTS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ assessment: publicAssessment(await createAssessment(prisma, (await params).id, await request.json(), auth.user.id)) }, { status: 201 }); }
  catch (error) { const result = marksError(error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}
