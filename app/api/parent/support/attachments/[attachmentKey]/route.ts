import { requireApiRolePermission } from "@/lib/auth";
import { supportDownload } from "@/lib/support-route-handlers";
export async function GET(_: Request, context: { params: Promise<{ attachmentKey: string }> }) { const auth = await requireApiRolePermission("DOWNLOAD_SUPPORT_ATTACHMENTS", "PARENT"); if (auth.response || !auth.user) return auth.response; return supportDownload(auth.user, (await context.params).attachmentKey, "OWN"); }
