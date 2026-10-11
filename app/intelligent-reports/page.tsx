import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { availability } from "@/lib/intelligent-reports/service";
import { ReportError } from "@/lib/intelligent-reports/contract";
import { Workspace } from "@/components/intelligent-reports/workspace";
export const dynamic="force-dynamic";
export default async function Page(){
  try {
    const context=await getCurrentAuthContext();
    if(!context||context.user.mustChangePassword)throw new ReportError("Sign in with an authorised management account.","ACCESS_DENIED",403);
    const access=await availability(prisma,{userId:context.user.id,sessionId:context.sessionId,roleAssignmentId:context.user.roleAssignmentId});
    return <Workspace key={access.context} initialAccess={access}/>;
  } catch(error) {
    return <section className="card"><h1>Ask Nalanda</h1><p role="status">{error instanceof ReportError?error.message:"Management reporting is temporarily unavailable."}</p><p>Access is governed through Role Permissions, individual IAM grants and the release feature flag.</p></section>;
  }
}
