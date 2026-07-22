import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildTeacherAnalyticsReport } from "@/lib/teacher-analytics-reports";
export async function GET(request:NextRequest){const auth=await requireApiPermission("VIEW_TEACHER_ANALYTICS_REPORTS");if(auth.response)return auth.response;return NextResponse.json({report:await buildTeacherAnalyticsReport(prisma,request.nextUrl.searchParams.get("cycleId")??undefined,auth.user.role==="VIEWER")});}
