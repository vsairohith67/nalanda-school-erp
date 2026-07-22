import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildExamReports, examReportsCsv, examReportsFilename } from "@/lib/exam-reports";
import { resolveMarksScope } from "@/lib/marks-scope";
export async function GET(request: NextRequest) { const auth = await requireApiPermission("EXPORT_EXAM_REPORTS"); if (auth.response) return auth.response; if (["TEACHER", "PARENT", "VIEWER", "ACCOUNTANT"].includes(auth.user.role)) return NextResponse.json({ error: "Broad marks export is not available for this role." }, { status: 403 }); const academicYear = request.nextUrl.searchParams.get("academicYear") ?? undefined; const examCode = request.nextUrl.searchParams.get("examCode") ?? undefined; const report = await buildExamReports(prisma, await resolveMarksScope(prisma, auth.user, academicYear), { academicYear, examCode }); return new NextResponse(examReportsCsv(report.rows), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${examReportsFilename()}"` } }); }
