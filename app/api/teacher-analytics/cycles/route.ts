import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTeacherAnalyticsCycle, teacherAnalyticsApiError } from "@/lib/teacher-analytics-snapshots";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_TEACHER_ANALYTICS"); if (auth.response) return auth.response;
  const rows = await prisma.teacherAnalyticsReviewCycle.findMany({ where: { ...(request.nextUrl.searchParams.get("academicYear") ? { academicYear: request.nextUrl.searchParams.get("academicYear")! } : {}), ...(request.nextUrl.searchParams.get("status") ? { status: request.nextUrl.searchParams.get("status")! } : {}) }, select: { id:true,cycleCode:true,academicYear:true,title:true,periodStart:true,periodEnd:true,status:true,minimumStudentCohort:true,metricDefinitionVersion:true,createdAt:true,updatedAt:true,_count:{select:{snapshots:true}} }, orderBy:{periodStart:"desc"} });
  return NextResponse.json({ cycles: rows });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_TEACHER_ANALYTICS_CYCLES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ cycle: await createTeacherAnalyticsCycle(prisma, await request.json(), auth.user.id) }, { status: 201 }); } catch (error) { const out=teacherAnalyticsApiError(error); return NextResponse.json({error:out.message},{status:out.status}); }
}
