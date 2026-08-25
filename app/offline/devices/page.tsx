import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { isOfflineSyncEnabled } from "@/lib/offline-sync/feature-flag";
import { OfflineDeviceGovernance } from "@/components/offline-sync/offline-device-governance";

export default async function OfflineDeviceGovernancePage() {
  if (!isOfflineSyncEnabled()) notFound();
  await requirePermission("MANAGE_OFFLINE_SYNC_DEVICES");
  return <OfflineDeviceGovernance />;
}
