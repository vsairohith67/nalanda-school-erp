import { PageHeader } from "@/components/ui";
import { SafeExitWorkspace } from "@/components/safe-exit-workspace";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parentSafeExitContext } from "@/lib/safe-exit";
import { redirect } from "next/navigation";
export default async function Page(){const context=await getCurrentAuthContext();if(!context)redirect("/login");if(context.user.role!=="PARENT")redirect("/unauthorized");const permissions=await getCurrentUserEffectivePermissions();if(!permissions.has("REQUEST_STUDENT_DEPARTURE"))redirect("/unauthorized");const actor={user:context.user,sessionId:context.sessionId,permissions},data=await parentSafeExitContext(prisma,actor);return <div className="page"><PageHeader title="Student Early Leave" description="Request early leave for a linked child, approve or deny Staff-initiated consent, and follow the governed status through checkout or return."/><SafeExitWorkspace mode="PARENT" permissions={[...permissions]} students={data.children.map((child:any)=>({id:child.id,name:child.studentName,className:child.className,section:child.section}))} initialRequests={data.requests} initialStandingAuthorisations={data.standingAuthorisations}/></div>}
