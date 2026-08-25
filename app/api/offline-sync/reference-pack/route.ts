import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { buildReferencePack } from "@/lib/offline-sync/reference-packs";
import { offlineTrustResponse, verifyOfflineRequest } from "@/lib/offline-sync/device-trust";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function GET(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext(); if (!context) return Response.json({ error: "Authentication required" }, { status: 401 });
  try {
    const device = await verifyOfflineRequest({ request, rawBody: "", user: context.user, sessionId: context.sessionId });
    const cursor = new URL(request.url).searchParams.get("cursor");
    const pack = await buildReferencePack({ userId: context.user.id, device, cursor });
    return Response.json(pack, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return offlineTrustResponse(error); }
}
