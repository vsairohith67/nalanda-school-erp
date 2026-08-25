import { getCurrentAuthContext, hasUserPermission, requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeDevice } from "@/lib/offline-sync/device-trust";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function GET(request: Request) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("USE_OFFLINE_SYNC"); if (auth.response) return auth.response;
  const context = await getCurrentAuthContext(); if (!context) return Response.json({ error: "Authentication required" }, { status: 401 });
  const requestedScope = new URL(request.url).searchParams.get("scope");
  const canManage = await hasUserPermission(context.user, "MANAGE_OFFLINE_SYNC_DEVICES");
  const all = requestedScope === "all" && canManage;
  const devices = await prisma.offlineSyncDevice.findMany({ where: all ? {} : { userId: context.user.id }, include: { user: { select: { name: true, role: true } } }, orderBy: [{ status: "asc" }, { requestedAt: "desc" }], take: all ? 500 : 10 });
  return Response.json({ devices: devices.map((device) => all ? { ...safeDevice(device), owner: device.user } : safeDevice(device)), scope: all ? "ALL" : "SELF" }, { headers: { "Cache-Control": "private, no-store" } });
}
