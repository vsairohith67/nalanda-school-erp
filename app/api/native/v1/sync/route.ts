import { validateOfflineSyncBatch } from "@/lib/offline-sync/contracts";
import { offlineTrustResponse, sha256Hex, verifyOfflineRequest, OfflineTrustError } from "@/lib/offline-sync/device-trust";
import { processOfflineMutation } from "@/lib/offline-sync/sync-service";
import { nativeAuthResponse, resolveNativeSession } from "@/lib/native-app/auth";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const context = await resolveNativeSession(request, "offline:sync");
    const device = await verifyOfflineRequest({ request, rawBody, user: context.user, sessionId: null, expectedDeviceId: context.device.id });
    const batch = validateOfflineSyncBatch(JSON.parse(rawBody));
    const requestHash = sha256Hex(rawBody); const results = [];
    for (const item of batch.mutations) results.push(await processOfflineMutation({ item, requestHash, device, user: context.user, sessionId: null }));
    return Response.json({ schemaVersion: 1, serverTime: new Date().toISOString(), results }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return error instanceof OfflineTrustError ? offlineTrustResponse(error) : nativeAuthResponse(error); }
}
