import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { regenerateTeacherAnalyticsSnapshot, teacherAnalyticsApiError } from "@/lib/teacher-analytics-snapshots";
export async function POST(request:NextRequest,{params}:{params:Promise<{snapshotId:string}>}){const auth=await requireApiPermission("GENERATE_TEACHER_ANALYTICS_SNAPSHOTS");if(auth.response)return auth.response;try{const body=await request.json();const row=await regenerateTeacherAnalyticsSnapshot(prisma,(await params).snapshotId,auth.user.id,body.reason);return NextResponse.json({snapshotHash:row.snapshotHash,sourceCalculatedAt:row.sourceCalculatedAt});}catch(error){const out=teacherAnalyticsApiError(error);return NextResponse.json({error:out.message},{status:out.status});}}
