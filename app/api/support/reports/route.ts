import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { supportReport } from "@/lib/support";
import { supportActor, supportApiError, supportJson } from "@/lib/support-api";
export async function GET() { const auth = await requireApiPermission("VIEW_SUPPORT_REPORTS"); if (auth.response || !auth.user) return auth.response; try { return supportJson({ report: await supportReport(prisma, await supportActor(auth.user)) }); } catch (error) { return supportApiError(error); } }
