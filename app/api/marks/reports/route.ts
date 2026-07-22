import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExamReports } from "@/lib/exam-reports";
import { resolveMarksScope } from "@/lib/marks-scope";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("VIEW_EXAM_REPORTS"); if (auth.response) return auth.response; const academicYear = request.nextUrl.searchParams.get("academicYear") ?? undefined; const examCode = request.nextUrl.searchParams.get("examCode") ?? undefined; const scope = await resolveMarksScope(prisma, auth.user, academicYear); return NextResponse.json(await buildExamReports(prisma, scope, { academicYear, examCode }, auth.user.role === "VIEWER")); }
