import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { marksScopeWhere, resolveMarksScope } from "@/lib/marks-scope";
import { publicAssessment } from "@/lib/exams";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_EXAMS"); if (auth.response) return auth.response; if (auth.user.role !== "TEACHER") return NextResponse.json({ error: "Teacher access is required." }, { status: 403 }); const scope = await resolveMarksScope(prisma, auth.user, request.nextUrl.searchParams.get("academicYear") ?? undefined); const rows = await prisma.examAssessment.findMany({ where: marksScopeWhere(scope), include: { examCycle: { select: { examCode: true, name: true, status: true } }, marks: { select: { id: true } } }, orderBy: [{ examCycle: { startDate: "desc" } }, { className: "asc" }, { subjectName: "asc" }] }); return NextResponse.json({ staffLabel: scope.staffLabel, scopeReason: scope.reason, assessments: rows.map((row) => ({ ...publicAssessment(row), exam: row.examCycle, enteredCount: row.marks.length })) }); }
