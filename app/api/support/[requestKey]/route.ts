import { requireApiPermission } from "@/lib/auth";
import { supportDetail } from "@/lib/support-route-handlers";
export async function GET(_: Request, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiPermission("VIEW_SUPPORT_REQUESTS"); if (auth.response || !auth.user) return auth.response; return supportDetail(auth.user, (await context.params).requestKey, "MANAGE"); }
