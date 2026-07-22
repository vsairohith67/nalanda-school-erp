const RANK: Record<string, number> = {
  QUEUED: 0,
  SENDING: 1,
  ACCEPTED: 2,
  SENT: 3,
  DELIVERED: 4,
  READ: 5
};

export function canAdvanceWhatsAppDelivery(current: string, next: string) {
  if (next === "FAILED") return !["DELIVERED", "READ", "OPTED_OUT", "CANCELLED"].includes(current);
  if (["OPTED_OUT", "CANCELLED"].includes(current)) return false;
  if (!(next in RANK)) return current !== "READ";
  return (RANK[next] ?? -1) > (RANK[current] ?? -1);
}

export function whatsappDeliveryStatusData(status: string, timestamp = new Date()) {
  if (status === "ACCEPTED") return { status, acceptedAt: timestamp };
  if (status === "SENT") return { status, sentAt: timestamp };
  if (status === "DELIVERED") return { status, deliveredAt: timestamp, sentAt: timestamp };
  if (status === "READ") return { status, readAt: timestamp, deliveredAt: timestamp, sentAt: timestamp };
  if (status === "FAILED") return { status, failedAt: timestamp };
  return { status };
}

export async function refreshWhatsAppBatchCounts(client: any, batchId: string) {
  const rows = await client.whatsAppDelivery.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((row: any) => [row.status, row._count._all]));
  const active = ["SCHEDULED", "QUEUED", "RETRY_PENDING", "SENDING"].reduce((sum, key) => sum + (counts[key] ?? 0), 0);
  const failed = counts.FAILED ?? 0;
  const terminalTotal = rows.reduce((sum: number, row: any) => sum + row._count._all, 0);
  const status = active > 0
    ? (counts.SCHEDULED ? "SCHEDULED" : counts.SENDING ? "PROCESSING" : "QUEUED")
    : failed > 0
      ? terminalTotal === failed ? "FAILED" : "PARTIALLY_FAILED"
      : terminalTotal > 0 ? "COMPLETED" : undefined;
  return client.whatsAppOutboundBatch.update({ where: { id: batchId }, data: {
    ...(status ? { status, completedAt: ["COMPLETED", "FAILED", "PARTIALLY_FAILED"].includes(status) ? new Date() : null } : {}),
    totalQueued: active,
    totalAccepted: counts.ACCEPTED ?? 0,
    totalSent: counts.SENT ?? 0,
    totalDelivered: counts.DELIVERED ?? 0,
    totalRead: counts.READ ?? 0,
    totalFailed: failed,
    totalOptedOut: counts.OPTED_OUT ?? 0,
    totalUnknown: counts.UNKNOWN ?? 0
  } });
}
