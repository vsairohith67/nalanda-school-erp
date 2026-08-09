import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { supportUpload } from "@/lib/support-route-handlers";
export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) { const auth = await requireApiPermission("UPLOAD_SUPPORT_ATTACHMENTS"); if (auth.response || !auth.user) return auth.response; return supportUpload(request, auth.user, (await context.params).requestKey, "MANAGE"); }
