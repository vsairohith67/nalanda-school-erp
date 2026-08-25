import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordOfflineEvent } from "@/lib/offline-sync/device-trust";
import { requireOfflineSyncForApi } from "@/lib/offline-sync/feature-flag";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const unavailable = requireOfflineSyncForApi(); if (unavailable) return unavailable;
  const auth = await requireApiPermission("REVIEW_OFFLINE_SYNC_CONFLICTS"); if (auth.response) return auth.response;
  const { id } = await params; const body = await request.json() as Record<string, unknown>;
  const resolutionStatus = String(body.resolutionStatus ?? "").toUpperCase(); const resolutionNote = String(body.resolutionNote ?? "").trim();
  if (!["ACKNOWLEDGED", "DRAFT_REVISED", "DISCARDED"].includes(resolutionStatus) || resolutionNote.length < 8 || resolutionNote.length > 1000) return Response.json({ error: "A valid resolution and note of 8 to 1000 characters are required." }, { status: 400 });
  try {
    const review = await prisma.$transaction(async (tx) => {
      const mutation = await tx.offlineSyncMutation.findFirst({ where: { id, status: "CONFLICT" }, select: { id: true, deviceId: true } });
      if (!mutation) throw new Error("CONFLICT_NOT_FOUND");
      const created = await tx.offlineSyncConflictReview.create({ data: { mutationId: mutation.id, deviceId: mutation.deviceId, reviewedByUserId: auth.user.id, resolutionStatus, resolutionNote } });
      await recordOfflineEvent(tx, { eventType: "CONFLICT_REVIEWED", actorUserId: auth.user.id, deviceId: mutation.deviceId, mutationId: mutation.id, safeMetadata: { resolutionStatus } });
      return created;
    });
    return Response.json({ review: { id: review.id, resolutionStatus: review.resolutionStatus, reviewedAt: review.reviewedAt } }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch { return Response.json({ error: "Conflict was unavailable or changed." }, { status: 409 }); }
}
