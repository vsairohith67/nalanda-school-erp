import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listSupportAssignees } from "@/lib/support";
import { supportActor, supportApiError, supportJson } from "@/lib/support-api";
export async function GET(_: Request, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiPermission("ASSIGN_SUPPORT_REQUESTS"); if (auth.response || !auth.user) return auth.response; try { return supportJson({ assignees: await listSupportAssignees(prisma, await supportActor(auth.user), (await context.params).requestKey) }); } catch (error) { return supportApiError(error); } }
