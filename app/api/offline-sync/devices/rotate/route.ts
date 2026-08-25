import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeChallenge, offlineTrustResponse, recordOfflineEvent, safeDevice, verifyOfflineRequest } from "@/lib/offline-sync/device-trust";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function POST(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext(); if (!context) return Response.json({ error: "Authentication required" }, { status: 401 });
  const rawBody = await request.text();
  try {
    const current = await verifyOfflineRequest({ request, rawBody, user: context.user, sessionId: context.sessionId });
    const body = JSON.parse(rawBody) as Record<string, unknown>;
    const nextKeyVersion = Number(body.keyVersion);
    if (nextKeyVersion !== current.keyVersion + 1) throw new Error("KEY_VERSION_MUST_INCREMENT");
    const updated = await prisma.$transaction(async (tx) => {
      const proof = await consumeChallenge(tx, { userId: context.user.id, purpose: "ROTATE", publicDeviceId: current.publicDeviceId, keyVersion: nextKeyVersion, publicKeyJwk: body.publicKeyJwk, challenge: String(body.challenge ?? ""), signature: String(body.newKeySignature ?? "") });
      const changed = await tx.offlineSyncDevice.updateMany({ where: { id: current.id, status: "ACTIVE", keyVersion: current.keyVersion }, data: { publicSigningKey: JSON.stringify(proof.jwk), publicKeyHash: proof.publicKeyHash, keyVersion: nextKeyVersion } });
      if (changed.count !== 1) throw new Error("DEVICE_CHANGED_DURING_ROTATION");
      await recordOfflineEvent(tx, { eventType: "DEVICE_KEY_ROTATED", actorUserId: context.user.id, deviceId: current.id, safeMetadata: { fromKeyVersion: current.keyVersion, toKeyVersion: nextKeyVersion } });
      return tx.offlineSyncDevice.findUniqueOrThrow({ where: { id: current.id } });
    });
    return Response.json({ device: safeDevice(updated) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return offlineTrustResponse(error); }
}
