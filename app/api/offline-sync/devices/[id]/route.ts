import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordOfflineEvent, safeDevice } from "@/lib/offline-sync/device-trust";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("MANAGE_OFFLINE_SYNC_DEVICES"); if (auth.response) return auth.response;
  const { id } = await params;
  const body = await request.json() as Record<string, unknown>;
  const action = String(body.action ?? "").toUpperCase();
  const reason = String(body.reason ?? "").trim();
  if (!["APPROVE", "REVOKE", "RETIRE"].includes(action)) return Response.json({ error: "Unsupported device action", code: "DEVICE_ACTION_INVALID" }, { status: 400 });
  if (action !== "APPROVE" && (reason.length < 4 || reason.length > 500)) return Response.json({ error: "A reason of 4 to 500 characters is required", code: "DEVICE_REASON_REQUIRED" }, { status: 400 });
  try {
    const device = await prisma.$transaction(async (tx) => {
      const current = await tx.offlineSyncDevice.findUnique({ where: { id } });
      if (!current) throw new Error("DEVICE_NOT_FOUND");
      if (action === "APPROVE") {
        if (current.status !== "PENDING_APPROVAL") throw new Error("DEVICE_NOT_PENDING");
        const activeCount = await tx.offlineSyncDevice.count({ where: { userId: current.userId, status: "ACTIVE" } });
        const max = Math.min(3, Math.max(1, Number(process.env.OFFLINE_SYNC_MAX_DEVICES_PER_USER ?? 2) || 2));
        if (activeCount >= max) throw new Error("DEVICE_LIMIT_REACHED");
        const updated = await tx.offlineSyncDevice.update({ where: { id }, data: { status: "ACTIVE", approvedAt: new Date(), approvedByUserId: auth.user.id } });
        await recordOfflineEvent(tx, { eventType: "DEVICE_APPROVED", actorUserId: auth.user.id, deviceId: id, safeMetadata: { keyVersion: updated.keyVersion } });
        return updated;
      }
      if (current.status === "REVOKED" || current.status === "RETIRED") throw new Error("DEVICE_ALREADY_TERMINAL");
      const status = action === "REVOKE" ? "REVOKED" : "RETIRED";
      const updated = await tx.offlineSyncDevice.update({ where: { id }, data: { status, revokedAt: new Date(), revokedByUserId: auth.user.id, revocationReason: reason } });
      await recordOfflineEvent(tx, { eventType: action === "REVOKE" ? "DEVICE_REVOKED" : "DEVICE_RETIRED", actorUserId: auth.user.id, deviceId: id, safeMetadata: { reasonCode: "GOVERNED_ACTION" } });
      return updated;
    });
    return Response.json({ device: safeDevice(device) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const knownCode = error instanceof Error && ["DEVICE_NOT_FOUND", "DEVICE_NOT_PENDING", "DEVICE_LIMIT_REACHED", "DEVICE_ALREADY_TERMINAL"].includes(error.message)
      ? error.message
      : "DEVICE_UPDATE_FAILED";
    return Response.json({ error: "Unable to update the device.", code: knownCode }, { status: knownCode === "DEVICE_NOT_FOUND" ? 404 : 409 });
  }
}
