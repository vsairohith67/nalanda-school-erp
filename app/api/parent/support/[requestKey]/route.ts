import { requireApiRolePermission } from "@/lib/auth";
import { supportDetail } from "@/lib/support-route-handlers";
export async function GET(_: Request, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiRolePermission("VIEW_OWN_SUPPORT", "PARENT"); if (auth.response || !auth.user) return auth.response; return supportDetail(auth.user, (await context.params).requestKey, "OWN"); }
