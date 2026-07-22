import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseExpectedVersion, publicExam, updateExamDraft } from "@/lib/exams";
import { marksScopeWhere, resolveMarksScope } from "@/lib/marks-scope";
import { marksError } from "@/lib/marks-api";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_EXAMS"); if (auth.response) return auth.response;
  const { id } = await params; const scope = await resolveMarksScope(prisma, auth.user);
  const row = await prisma.examCycle.findFirst({ where: { id, ...(!scope.broad ? { assessments: { some: marksScopeWhere(scope) } } : {}) }, include: { assessments: { where: marksScopeWhere(scope), orderBy: [{ className: "asc" }, { section: "asc" }, { subjectName: "asc" }] } } });
  return row ? NextResponse.json({ exam: publicExam(row) }) : NextResponse.json({ error: "Exam was not found in your authorised scope." }, { status: 404 });
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_EXAMS"); if (auth.response) return auth.response;
  try { const body = await request.json(); const exam = await updateExamDraft(prisma, (await params).id, body, parseExpectedVersion(body.expectedUpdatedAt, "exam")); return NextResponse.json({ exam: publicExam(exam) }); }
  catch (error) { const result = marksError(error); return NextResponse.json({ error: result.message }, { status: result.status }); }
}
