import { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { supportWorkflow } from "@/lib/support-route-handlers";
export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiRolePermission("VIEW_OWN_SUPPORT", "PARENT"); if (auth.response || !auth.user) return auth.response; return supportWorkflow(request, auth.user, (await context.params).requestKey, "OWN"); }
