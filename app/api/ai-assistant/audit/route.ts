import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseAiAuditLimit,
  purgeExpiredAiAssistantAudits,
  unexpiredAiAuditWhere
} from "@/lib/ai-assistant-audit";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_AI_ASSISTANT_AUDIT"); if (auth.response) return auth.response;
  let take: number;
  try { take = parseAiAuditLimit(request.nextUrl.searchParams.get("limit")); }
  catch { return NextResponse.json({ error: "Audit limit must be a positive whole number." }, { status: 400 }); }
  const now = new Date();
  await purgeExpiredAiAssistantAudits(prisma, now);
  const [audits, events] = await Promise.all([
    prisma.aiAssistantQueryAudit.findMany({ where: unexpiredAiAuditWhere(now), take, orderBy: { createdAt: "desc" }, select: {
      requestId: true, userId: true, assistantProfileId: true, mode: true, questionHash: true, providerKind: true, providerModelReference: true, safetyDecision: true,
      refusalReasonCode: true, toolKeysJson: true, toolCallCount: true, sourceCount: true, citationCount: true,
      retrievedCharacterCount: true, redactionCount: true, latencyMs: true, answerHash: true, createdAt: true, expiresAt: true
    } }),
    prisma.aiAssistantSafetyEvent.groupBy({ by: ["eventType"], _count: true })
  ]);
  return NextResponse.json({ audits, safetyEventCounts: events });
}
