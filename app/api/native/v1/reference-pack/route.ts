import { nativeAuthResponse, resolveNativeSession } from "@/lib/native-app/auth";
import { prisma } from "@/lib/prisma";
import { prepareReferenceResponse } from "@/lib/native-app/reference-response";
import { buildReferencePack } from "@/lib/offline-sync/reference-packs";
import { offlineTrustResponse, verifyOfflineRequest, OfflineTrustError } from "@/lib/offline-sync/device-trust";

export async function GET(request: Request) {
  try {
    const context = await resolveNativeSession(request, "offline:reference");
    const device = await verifyOfflineRequest({ request, rawBody: "", user: context.user, sessionId: null, expectedDeviceId: context.device.id });
    const pack = await buildReferencePack({ userId: context.user.id, device, cursor: new URL(request.url).searchParams.get("cursor") });
    const response = await prepareReferenceResponse(prisma, pack, { userId: context.user.id, sessionId: context.session.publicSessionId, deviceId: device.id, publicDeviceId: device.publicDeviceId }, request.headers.get("x-offline-nonce")!);
    return Response.json(response, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return error instanceof OfflineTrustError ? offlineTrustResponse(error) : nativeAuthResponse(error); }
}
