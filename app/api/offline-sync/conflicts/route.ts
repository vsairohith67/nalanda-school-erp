import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function GET() {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("REVIEW_OFFLINE_SYNC_CONFLICTS"); if (auth.response) return auth.response;
  const rows = await prisma.offlineSyncMutation.findMany({ where: { status: "CONFLICT" }, select: { id: true, clientMutationId: true, operationType: true, conflictCode: true, createdClientAt: true, receivedServerAt: true, updatedAt: true, device: { select: { publicDeviceId: true, label: true } }, actor: { select: { name: true } }, conflictReviews: { select: { resolutionStatus: true, resolutionNote: true, reviewedAt: true }, orderBy: { reviewedAt: "desc" }, take: 1 } }, orderBy: { receivedServerAt: "desc" }, take: 250 });
  return Response.json({ conflicts: rows }, { headers: { "Cache-Control": "private, no-store" } });
}
