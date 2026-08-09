import { PageHeader } from "@/components/ui";
import { CampusRoster } from "@/components/safe-exit-workspace";
import { getCurrentAuthContext, getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { liveCampusRoster } from "@/lib/safe-exit";
import { prisma } from "@/lib/prisma";
export default async function Page(){await requirePermission("VIEW_LIVE_CAMPUS_ROSTER");const context=await getCurrentAuthContext();if(!context)return null;const permissions=await getCurrentUserEffectivePermissions(),roster=await liveCampusRoster(prisma,{user:context.user,sessionId:context.sessionId,permissions});return <div className="page"><PageHeader title="Live Campus Roster" description="Emergency-accountability view from append-only campus-presence events. Official daily attendance is not rewritten."/><CampusRoster initialRoster={roster}/></div>}
