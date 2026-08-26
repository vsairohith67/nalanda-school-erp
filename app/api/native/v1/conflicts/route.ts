import { prisma } from "@/lib/prisma";
import { nativeAuthResponse, resolveNativeSession } from "@/lib/native-app/auth";
import { offlineTrustResponse, verifyOfflineRequest, OfflineTrustError } from "@/lib/offline-sync/device-trust";

export async function GET(request: Request) {
  try {
    const context = await resolveNativeSession(request, "offline:own-conflicts");
    const device = await verifyOfflineRequest({ request, rawBody: "", user: context.user, sessionId: null, expectedDeviceId: context.device.id });
    const conflicts = await prisma.offlineSyncMutation.findMany({ where: { deviceId: device.id, actorUserId: context.user.id, status: "CONFLICT" }, select: { clientMutationId: true, localDraftId: true, operationType: true, conflictCode: true, receivedServerAt: true, updatedAt: true }, orderBy: { receivedServerAt: "desc" }, take: 100 });
    return Response.json({ conflicts }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return error instanceof OfflineTrustError ? offlineTrustResponse(error) : nativeAuthResponse(error); }
}
