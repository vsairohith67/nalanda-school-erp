import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTeacherAnalyticsReport, teacherAnalyticsReportCsv, teacherAnalyticsReportFilename } from "@/lib/teacher-analytics-reports";
export async function GET(request:NextRequest){const auth=await requireApiPermission("EXPORT_TEACHER_ANALYTICS_REPORTS");if(auth.response)return auth.response;const report=await buildTeacherAnalyticsReport(prisma,request.nextUrl.searchParams.get("cycleId")??undefined,false);return new NextResponse(teacherAnalyticsReportCsv(report),{headers:{"content-type":"text/csv; charset=utf-8","content-disposition":`attachment; filename="${teacherAnalyticsReportFilename()}"`,"cache-control":"private, no-store","x-content-type-options":"nosniff"}});}
