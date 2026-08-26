import { nativeAuthResponse, resolveNativeSession } from "@/lib/native-app/auth";
import { buildReferencePack } from "@/lib/offline-sync/reference-packs";
import { offlineTrustResponse, verifyOfflineRequest, OfflineTrustError } from "@/lib/offline-sync/device-trust";

export async function GET(request: Request) {
  try {
    const context = await resolveNativeSession(request, "offline:reference");
    const device = await verifyOfflineRequest({ request, rawBody: "", user: context.user, sessionId: null, expectedDeviceId: context.device.id });
    const pack = await buildReferencePack({ userId: context.user.id, device, cursor: new URL(request.url).searchParams.get("cursor") });
    return Response.json(pack, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return error instanceof OfflineTrustError ? offlineTrustResponse(error) : nativeAuthResponse(error); }
}
