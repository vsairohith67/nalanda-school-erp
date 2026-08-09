import { NextRequest } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { supportUpload } from "@/lib/support-route-handlers";
export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiRolePermission("UPLOAD_SUPPORT_ATTACHMENTS", "PARENT"); if (auth.response || !auth.user) return auth.response; return supportUpload(request, auth.user, (await context.params).requestKey, "OWN"); }
