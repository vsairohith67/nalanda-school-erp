import { notFound } from "next/navigation";
import { OfflineConflictReview } from "@/components/offline-sync/offline-conflict-review";
import { requirePermission } from "@/lib/auth";
import { isOfflineSyncEnabled } from "@/lib/offline-sync/feature-flag";

export default async function OfflineConflictReviewPage() {
  if (!isOfflineSyncEnabled()) notFound();
  await requirePermission("REVIEW_OFFLINE_SYNC_CONFLICTS");
  return <OfflineConflictReview />;
}
