import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { searchAiDocuments } from "@/lib/ai-assistant-documents";
import { classifyAiQuestion } from "@/lib/ai-assistant-safety";
import { redactAiText } from "@/lib/ai-assistant-redaction";
import { randomUUID } from "node:crypto";
import { beginAiRequest } from "@/lib/ai-assistant-rate-limit";
import { createAiAssistantAudit } from "@/lib/ai-assistant";
import { assertAiAuditHashReady } from "@/lib/ai-assistant-audit";
import { safeAiAssistantError } from "@/lib/ai-assistant-errors";
import { assertBoundedJsonValue } from "@/lib/request-security";
import { ResourceGuardError, withOperationCapacity } from "@/lib/resource-guard";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("USE_AI_ASSISTANT_DOCUMENTATION"); if (auth.response) return auth.response;
  const started = Date.now();
  const requestId = randomUUID();
  let release: (() => void) | undefined;
  try {
    release = beginAiRequest(auth.user.id);
    const body = await request.json();
    assertBoundedJsonValue(body, { maximumArrayLength: 20, maximumStringLength: 2_000, maximumJsonNodes: 100 });
    const question = String(body.question ?? "").trim();
    if (!question || question.length > 1000) throw new Error("QUESTION_LENGTH_EXCEEDED");
    const profile = await prisma.aiAssistantProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
    if (!profile) throw new Error("AI_ASSISTANT_PROFILE_UNAVAILABLE");
    assertAiAuditHashReady();
    const safety = classifyAiQuestion(question), questionRedaction = redactAiText(question);
    if (!safety.allowed || questionRedaction.redactionCount) {
      await createAiAssistantAudit(prisma, {
        requestId, actor: auth.user, profile, mode: "DOCUMENTATION", question,
        safetyDecision: "BLOCKED", refusalReasonCode: safety.reasonCode ?? "SENSITIVE_INPUT",
        toolKeys: [], evidence: [], redactionCount: questionRedaction.redactionCount,
        latencyMs: Date.now() - started
      });
      return NextResponse.json({ error: safety.safeReason ?? "Sensitive input was blocked before retrieval." }, { status: 400 });
    }
    const policies = (await prisma.aiAssistantSourcePolicy.findMany({ where: { sourceType: "DOCUMENT", enabled: true } }))
      .filter((row) => jsonArray(row.allowedRolesJson).includes(auth.user.role) && jsonArray(row.allowedModesJson).includes("DOCUMENTATION"));
    const freshnessWarningDays = Math.min(...policies.map((row) => row.freshnessWarningDays ?? 180), 180);
    const results = await withOperationCapacity("SMART_AI", () => searchAiDocuments(questionRedaction.text, policies.map((row) => row.sourceKey), 5, freshnessWarningDays));
    await createAiAssistantAudit(prisma, {
      requestId, actor: auth.user, profile, mode: "DOCUMENTATION", question,
      safetyDecision: results.length ? "ALLOWED" : "REFUSED",
      refusalReasonCode: results.length ? null : "INSUFFICIENT_AUTHORISED_EVIDENCE",
      toolKeys: [], evidence: results, citationCount: results.length, redactionCount: 0,
      latencyMs: Date.now() - started
    });
    return NextResponse.json({ results: results.map((item) => ({ sourceKey: item.sourceKey, citation: item.citation, excerpt: redactAiText(item.text.slice(0, 600)).text, completeness: item.completeness })) });
  } catch (error) {
    if (error instanceof ResourceGuardError) return NextResponse.json({ error: "The assistant is busy. Please retry shortly." }, { status: error.status, headers: { "Retry-After": String(error.retryAfterSeconds), "Cache-Control": "private, no-store" } });
    const safe = safeAiAssistantError(error);
    return NextResponse.json({ error: safe.message }, { status: safe.status });
  } finally {
    release?.();
  }
}

function jsonArray(value: string) {
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; }
  catch { return []; }
}
