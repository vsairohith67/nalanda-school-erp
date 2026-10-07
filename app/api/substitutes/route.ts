import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { linkedStaffMember } from "@/lib/staff-leave";
import { friendlySubstituteError, substituteInclude, substituteWhere } from "@/lib/substitutes";
import { saveSubstituteAssignment, SubstituteAssignmentError } from "@/lib/substitute-assignment-service";

export async function GET(request: NextRequest) {
  const auth=await requireApiPermission("VIEW_SUBSTITUTES"); if(auth.response)return auth.response;
  try { const [permissions,linked]=await Promise.all([getCurrentUserEffectivePermissions(),linkedStaffMember(prisma,auth.user.id)]); const manager=permissionSetCan(permissions,"MANAGE_SUBSTITUTES"); const sp=request.nextUrl.searchParams; const where=substituteWhere({date:sp.get("date"),status:sp.get("status"),absentStaffMemberId:sp.get("absentStaffMemberId"),substituteStaffMemberId:sp.get("substituteStaffMemberId"),className:sp.get("className"),section:sp.get("section"),ownSubstituteStaffMemberId:manager?null:linked?.id??"__unlinked__"}); const assignments=await prisma.substituteAssignment.findMany({where,include:substituteInclude,orderBy:[{assignmentDate:"desc"},{periodStartTime:"asc"}]}); return NextResponse.json({assignments,scope:manager?"ALL":"OWN"}); }
  catch(error){return NextResponse.json({error:friendlySubstituteError(error)},{status:400});}
}

export async function POST(request: NextRequest) {
  const auth=await requireApiPermission("MANAGE_SUBSTITUTES"); if(auth.response)return auth.response;
  try { const source=await request.json(); const context=await getCurrentAuthContext(); if(!context)return NextResponse.json({error:"Authentication required"},{status:401}); const assignment=await saveSubstituteAssignment(prisma,{userId:context.user.id,sessionId:context.sessionId,roleAssignmentId:context.user.roleAssignmentId},source); return NextResponse.json({assignment},{status:201}); }
  catch(error){return NextResponse.json({error:friendlySubstituteError(error)},{status:error instanceof SubstituteAssignmentError?error.status:400});}
}
