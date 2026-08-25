import { Prisma } from "@prisma/client";
import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeChallenge, offlineTrustResponse, recordOfflineEvent, safeDevice } from "@/lib/offline-sync/device-trust";
import { offlineSyncRoleAllowed, requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

const MAX_REGISTERED_DEVICES = Math.min(3, Math.max(1, Number(process.env.OFFLINE_SYNC_MAX_DEVICES_PER_USER ?? 2) || 2));

export async function POST(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext();
  if (!context || !offlineSyncRoleAllowed(context.user.role)) return Response.json({ error: "You do not have permission for this action" }, { status: 403 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const label = String(body.label ?? "").trim();
    const platform = String(body.platform ?? "").trim();
    if (!label || label.length > 80 || !platform || platform.length > 80) throw new Error("DEVICE_METADATA_INVALID");
    const result = await prisma.$transaction(async (tx) => {
      const proof = await consumeChallenge(tx, {
        userId: context.user.id,
        purpose: "REGISTER",
        publicDeviceId: String(body.publicDeviceId ?? ""),
        keyVersion: Number(body.keyVersion),
        publicKeyJwk: body.publicKeyJwk,
        challenge: String(body.challenge ?? ""),
        signature: String(body.signature ?? "")
      });
      const count = await tx.offlineSyncDevice.count({ where: { userId: context.user.id, status: { in: ["PENDING_APPROVAL", "ACTIVE"] } } });
      if (count >= MAX_REGISTERED_DEVICES) throw new Error("DEVICE_LIMIT_REACHED");
      const device = await tx.offlineSyncDevice.create({ data: {
        publicDeviceId: String(body.publicDeviceId), userId: context.user.id, label, platform,
        publicSigningKey: JSON.stringify(proof.jwk), publicKeyHash: proof.publicKeyHash, keyVersion: Number(body.keyVersion)
      } });
      await recordOfflineEvent(tx, { eventType: "DEVICE_REGISTRATION_REQUESTED", actorUserId: context.user.id, deviceId: device.id, safeMetadata: { keyVersion: device.keyVersion } });
      return device;
    });
    return Response.json({ device: safeDevice(result), nextStep: "SUPER_ADMIN_APPROVAL_REQUIRED" }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return Response.json({ error: "This device is already registered.", code: "DEVICE_ALREADY_REGISTERED" }, { status: 409 });
    return offlineTrustResponse(error);
  }
}
