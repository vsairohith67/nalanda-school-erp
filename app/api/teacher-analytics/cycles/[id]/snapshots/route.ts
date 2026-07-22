import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTeacherAnalyticsSnapshots, teacherAnalyticsApiError } from "@/lib/teacher-analytics-snapshots";
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireApiPermission("GENERATE_TEACHER_ANALYTICS_SNAPSHOTS");if(auth.response)return auth.response;try{const body=await request.json();return NextResponse.json(await generateTeacherAnalyticsSnapshots(prisma,(await params).id,body.expectedUpdatedAt,auth.user.id));}catch(error){const out=teacherAnalyticsApiError(error);return NextResponse.json({error:out.message},{status:out.status});}}
