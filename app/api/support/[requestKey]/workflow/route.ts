import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { supportWorkflow } from "@/lib/support-route-handlers";
export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiPermission("VIEW_SUPPORT_REQUESTS"); if (auth.response || !auth.user) return auth.response; return supportWorkflow(request, auth.user, (await context.params).requestKey, "MANAGE"); }
