import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { linkedStaffMember } from "@/lib/staff-leave";
import { friendlySubstituteError, substituteInclude } from "@/lib/substitutes";
import { saveSubstituteAssignment, SubstituteAssignmentError } from "@/lib/substitute-assignment-service";

async function access(id:string,user:{id:string}) { const [assignment,permissions,linked]=await Promise.all([prisma.substituteAssignment.findUnique({where:{id},include:substituteInclude}),getCurrentUserEffectivePermissions(),linkedStaffMember(prisma,user.id)]); if(!assignment)return {response:NextResponse.json({error:"Substitute assignment not found"},{status:404})}; const manager=permissionSetCan(permissions,"MANAGE_SUBSTITUTES"); if(!manager&&assignment.substituteStaffMemberId!==linked?.id)return {response:NextResponse.json({error:"You can only view your own substitute duties"},{status:403})}; return {assignment,permissions,manager,response:null}; }

export async function GET(_request:NextRequest,context:{params:Promise<{id:string}>}) { const auth=await requireApiPermission("VIEW_SUBSTITUTES");if(auth.response)return auth.response;const {id}=await context.params;const result=await access(id,auth.user);if(result.response)return result.response;return NextResponse.json({assignment:result.assignment}); }

export async function PATCH(request:NextRequest,context:{params:Promise<{id:string}>}) { const auth=await requireApiPermission("VIEW_SUBSTITUTES");if(auth.response)return auth.response; const {id}=await context.params; const result=await access(id,auth.user);if(result.response)return result.response; if(!result.manager)return NextResponse.json({error:"Teachers can view their own duties but cannot manage substitute assignments"},{status:403}); const existing=result.assignment!;const permissions=result.permissions!;const source=await request.json().catch(()=>({}));const action=String(source.action??"edit");
  try {
    if(action==="confirm"&&existing.status!=="ASSIGNED")throw new Error("Only assigned substitute duties can be confirmed");
    if(action==="complete"&&existing.status!=="CONFIRMED")throw new Error("Only confirmed substitute duties can be completed");
    if(action==="cancel"){if(["COMPLETED","CANCELLED"].includes(existing.status))throw new Error("Completed or cancelled substitute duties cannot be cancelled again");if(!String(source.cancellationReason??"").trim())throw new Error("Cancellation reason is required");}
    if(["edit","assign"].includes(action)&&!["DRAFT","ASSIGNED"].includes(existing.status))throw new Error("Only draft or assigned substitute duties can be edited");
    const context=await getCurrentAuthContext();if(!context)return NextResponse.json({error:"Authentication required"},{status:401});
    const assignment=await saveSubstituteAssignment(prisma,{userId:context.user.id,sessionId:context.sessionId,roleAssignmentId:context.user.roleAssignmentId},source,id);return NextResponse.json({assignment});
  } catch(error){return NextResponse.json({error:friendlySubstituteError(error)},{status:error instanceof SubstituteAssignmentError?error.status:400});}
}
