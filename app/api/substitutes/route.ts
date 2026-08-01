import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserEffectivePermissions, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { linkedStaffMember } from "@/lib/staff-leave";
import { friendlySubstituteError, substituteInclude, substituteWhere, validateSubstituteInput, validateSubstituteLinks } from "@/lib/substitutes";

export async function GET(request: NextRequest) {
  const auth=await requireApiPermission("VIEW_SUBSTITUTES"); if(auth.response)return auth.response;
  try { const [permissions,linked]=await Promise.all([getCurrentUserEffectivePermissions(),linkedStaffMember(prisma,auth.user.id)]); const manager=permissionSetCan(permissions,"MANAGE_SUBSTITUTES"); const sp=request.nextUrl.searchParams; const where=substituteWhere({date:sp.get("date"),status:sp.get("status"),absentStaffMemberId:sp.get("absentStaffMemberId"),substituteStaffMemberId:sp.get("substituteStaffMemberId"),className:sp.get("className"),section:sp.get("section"),ownSubstituteStaffMemberId:manager?null:linked?.id??"__unlinked__"}); const assignments=await prisma.substituteAssignment.findMany({where,include:substituteInclude,orderBy:[{assignmentDate:"desc"},{periodStartTime:"asc"}]}); return NextResponse.json({assignments,scope:manager?"ALL":"OWN"}); }
  catch(error){return NextResponse.json({error:friendlySubstituteError(error)},{status:400});}
}

export async function POST(request: NextRequest) {
  const auth=await requireApiPermission("MANAGE_SUBSTITUTES"); if(auth.response)return auth.response;
  try { const source=await request.json(); const permissions=await getCurrentUserEffectivePermissions(); const action=source.action==="assign"?"assign":"draft"; if(action==="assign"&&!permissionSetCan(permissions,"ASSIGN_SUBSTITUTES"))return NextResponse.json({error:"You do not have permission to assign substitutes"},{status:403}); const input=validateSubstituteInput(source); await validateSubstituteLinks(prisma,input,{requireSubstitute:action==="assign"}); const assignment=await prisma.substituteAssignment.create({data:{...input,status:action==="assign"?"ASSIGNED":"DRAFT",assignedByUserId:action==="assign"?auth.user.id:null,assignedAt:action==="assign"?new Date():null},include:substituteInclude}); return NextResponse.json({assignment},{status:201}); }
  catch(error){return NextResponse.json({error:friendlySubstituteError(error)},{status:400});}
}
