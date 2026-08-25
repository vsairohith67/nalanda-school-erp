import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { validateOfflineSyncBatch } from "@/lib/offline-sync/contracts";
import { offlineTrustResponse, sha256Hex, verifyOfflineRequest } from "@/lib/offline-sync/device-trust";
import { processOfflineMutation } from "@/lib/offline-sync/sync-service";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function POST(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext(); if (!context) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rawBody = await request.text();
  try {
    const device = await verifyOfflineRequest({ request, rawBody, user: context.user, sessionId: context.sessionId });
    const batch = validateOfflineSyncBatch(JSON.parse(rawBody));
    const requestHash = sha256Hex(rawBody);
    const results = [];
    for (const item of batch.mutations) results.push(await processOfflineMutation({ item, requestHash, device, user: context.user, sessionId: context.sessionId }));
    return Response.json({ schemaVersion: 1, serverTime: new Date().toISOString(), results }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return offlineTrustResponse(error); }
}
