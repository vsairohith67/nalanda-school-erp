import { getCurrentAuthContext, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeDevice } from "@/lib/offline-sync/device-trust";
import { offlineSyncRoleAllowed, requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function GET() {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext(); if (!context || !offlineSyncRoleAllowed(context.user.role)) return Response.json({ error: "You do not have permission for this action" }, { status: 403 });
  const devices = await prisma.offlineSyncDevice.findMany({ where: { userId: context.user.id }, orderBy: { requestedAt: "desc" }, take: 3 });
  return Response.json({ userId: context.user.id, role: context.user.role, devices: devices.map(safeDevice), feature: "OFFLINE_SYNC_1A", schemaVersion: 1 }, { headers: { "Cache-Control": "private, no-store" } });
}
