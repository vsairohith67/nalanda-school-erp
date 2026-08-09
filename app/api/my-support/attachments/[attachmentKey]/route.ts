import { requireApiPermission } from "@/lib/auth";
import { supportDownload } from "@/lib/support-route-handlers";
export async function GET(_: Request, context: { params: Promise<{ attachmentKey: string }> }) { const auth = await requireApiPermission("DOWNLOAD_SUPPORT_ATTACHMENTS"); if (auth.response || !auth.user) return auth.response; if (["PARENT","STUDENT"].includes(auth.user.role)) return new Response(null, { status: 403 }); return supportDownload(auth.user, (await context.params).attachmentKey, "OWN"); }
