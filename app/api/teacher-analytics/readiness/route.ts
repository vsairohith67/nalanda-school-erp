import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { teacherAnalyticsReadiness } from "@/lib/teacher-analytics";
export async function GET(request: NextRequest) { const auth=await requireApiPermission("VIEW_TEACHER_ANALYTICS"); if(auth.response)return auth.response; const q=request.nextUrl.searchParams; const start=new Date(`${q.get("periodStart")??"2026-04-01"}T00:00:00+05:30`),end=new Date(`${q.get("periodEnd")??"2027-03-31"}T23:59:59+05:30`); return NextResponse.json({readiness:await teacherAnalyticsReadiness(prisma,{academicYear:q.get("academicYear")??"2026-27",periodStart:start,periodEnd:end})});}
