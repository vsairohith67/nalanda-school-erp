import { createHmac } from "node:crypto";
import { securitySecret } from "@/lib/security-secrets";

export function parseAiAuditLimit(value: string | null) {
  if (value == null) return 100;
  if (!/^\d+$/.test(value)) throw new Error("INVALID_AUDIT_LIMIT");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) throw new Error("INVALID_AUDIT_LIMIT");
  return Math.min(250, Math.max(1, parsed));
}

export function hashAiAuditContent(value: string) {
  return createHmac("sha256", securitySecret("AI_ASSISTANT_AUDIT_HASH_PEPPER"))
    .update(`nalanda-ai-audit-v2|${value}`)
    .digest("hex");
}

export function assertAiAuditHashReady() {
  hashAiAuditContent("");
}

export async function purgeExpiredAiAssistantAudits(client: any, now = new Date()) {
  const expired = await client.aiAssistantQueryAudit.findMany({
    where: { expiresAt: { lte: now } },
    select: { id: true },
    orderBy: { expiresAt: "asc" },
    take: 500
  });
  const ids = expired.map((row: any) => row.id);
  if (!ids.length) return 0;
  await client.$transaction([
    client.aiAssistantSafetyEvent.deleteMany({ where: { queryAuditId: { in: ids } } }),
    client.aiAssistantQueryAudit.deleteMany({ where: { id: { in: ids } } })
  ]);
  return ids.length;
}

export function unexpiredAiAuditWhere(now = new Date()) {
  return { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] };
}
