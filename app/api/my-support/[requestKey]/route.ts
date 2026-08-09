import { requireApiPermission } from "@/lib/auth";
import { supportDetail } from "@/lib/support-route-handlers";
export async function GET(_: Request, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiPermission("VIEW_OWN_SUPPORT"); if (auth.response || !auth.user) return auth.response; if (["PARENT","STUDENT"].includes(auth.user.role)) return new Response(null, { status: 403 }); return supportDetail(auth.user, (await context.params).requestKey, "OWN"); }
