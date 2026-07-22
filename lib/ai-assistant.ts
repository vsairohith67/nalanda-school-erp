import { randomUUID } from "node:crypto";
import { ensureAiAssistantFoundation } from "@/lib/ai-assistant-profiles";
import { searchAiDocuments } from "@/lib/ai-assistant-documents";
import { chooseAggregateTools, runAggregateTool } from "@/lib/ai-assistant-tools";
import { callAiProvider } from "@/lib/ai-assistant-provider";
import { beginAiRequest } from "@/lib/ai-assistant-rate-limit";
import { redactAiText } from "@/lib/ai-assistant-redaction";
import { AI_SYSTEM_SAFETY_INSTRUCTIONS, classifyAiQuestion } from "@/lib/ai-assistant-safety";
import { AI_MODES, type AiAssistantMode, type AssistantActor, type EvidenceCompleteness, type RetrievedEvidence } from "@/lib/ai-assistant-types";
import {
  assertAiAuditHashReady,
  hashAiAuditContent,
  purgeExpiredAiAssistantAudits
} from "@/lib/ai-assistant-audit";

const NO_EVIDENCE = "I do not have enough authorised information to answer that.";

export async function askAiAssistant(client: any, actor: AssistantActor, input: { mode: string; question: string }) {
  const started = Date.now();
  const requestId = randomUUID();
  await ensureAiAssistantFoundation(client);
  const profile = await client.aiAssistantProfile.findFirst({ where: { status: "ACTIVE" }, orderBy: { createdAt: "asc" } });
  if (!profile) throw new Error("AI_ASSISTANT_PROFILE_UNAVAILABLE");
  assertAiAuditHashReady();
  if (profile.providerKind !== "MOCK") throw new Error("PROVIDER_DISABLED");
  if (!AI_MODES.includes(input.mode as AiAssistantMode)) throw new Error("INVALID_ASSISTANT_MODE");
  const mode = input.mode as AiAssistantMode;
  const question = String(input.question ?? "").trim();
  if (!question || question.length > profile.maximumQuestionLength) throw new Error("QUESTION_LENGTH_EXCEEDED");
  const release = beginAiRequest(actor.id);
  try {
    const questionRedaction = redactAiText(question);
    const safety = classifyAiQuestion(question);
    if (!safety.allowed || questionRedaction.redactionCount > 0) {
      const reason = safety.reasonCode ?? "SENSITIVE_INPUT";
      const audit = await createAiAssistantAudit(client, { requestId, actor, profile, mode, question, safetyDecision: "BLOCKED", refusalReasonCode: reason, toolKeys: [], evidence: [], redactionCount: questionRedaction.redactionCount, latencyMs: Date.now() - started });
      await client.aiAssistantSafetyEvent.create({ data: { queryAuditId: audit.id, eventType: safety.eventType ?? "PROHIBITED_DATA_REQUESTED", severity: "BLOCKED", safeReason: safety.safeReason ?? "Sensitive input was blocked before retrieval." } });
      return response(NO_EVIDENCE, mode, "INSUFFICIENT", [], [], safety.safeReason ?? "This request is outside the authorised read-only scope.", requestId);
    }

    const policies = await client.aiAssistantSourcePolicy.findMany({ where: { enabled: true } });
    const authorised = policies.filter((row: any) => jsonArray(row.allowedRolesJson).includes(actor.role) && jsonArray(row.allowedModesJson).includes(mode));
    let evidence: RetrievedEvidence[] = [];
    let toolKeys: string[] = [];
    if (mode === "DOCUMENTATION") {
      const documentPolicies = authorised.filter((row: any) => row.sourceType === "DOCUMENT");
      const freshnessWarningDays = Math.min(...documentPolicies.map((row: any) => row.freshnessWarningDays ?? 180), 180);
      evidence = await searchAiDocuments(questionRedaction.text, documentPolicies.map((row: any) => row.sourceKey), Math.min(profile.maximumToolCalls, 4), freshnessWarningDays);
    } else {
      const toolPolicies = new Map<string, any>(authorised.filter((row: any) => row.sourceType === "AGGREGATE_TOOL").map((row: any) => [row.sourceKey, row]));
      const allowedTools = new Set(toolPolicies.keys());
      toolKeys = chooseAggregateTools(questionRedaction.text).filter((key) => allowedTools.has(key)).slice(0, profile.maximumToolCalls);
      evidence = await Promise.all(toolKeys.map((key) => {
        const policy = toolPolicies.get(key);
        return runAggregateTool(
          client,
          key,
          actor.role,
          Math.max(profile.minimumAggregateGroupSize, policy?.minimumGroupSize ?? 5),
          Math.min(profile.maximumRowsPerTool, policy?.maximumRows ?? 100)
        );
      }));
    }
    let contextCharacters = 0;
    evidence = evidence.filter((item) => {
      if (contextCharacters + item.text.length > profile.maximumContextCharacters) return false;
      contextCharacters += item.text.length;
      return true;
    });
    const contextRedaction = evidence.map((item) => {
      const redacted = redactAiText(item.text);
      return { item: { ...item, text: redacted.text }, count: redacted.redactionCount };
    });
    const redactionCount = contextRedaction.reduce((sum, item) => sum + item.count, 0);
    evidence = contextRedaction.map((item) => item.item);

    if (!evidence.length) {
      await createAiAssistantAudit(client, { requestId, actor, profile, mode, question, safetyDecision: "REFUSED", refusalReasonCode: "INSUFFICIENT_AUTHORISED_EVIDENCE", toolKeys, evidence, redactionCount, latencyMs: Date.now() - started });
      return response(NO_EVIDENCE, mode, "INSUFFICIENT", [], toolKeys, "No authorised matching source was available. Operational decisions remain with authorised school leadership.", requestId);
    }

    const provider = await Promise.race([
      callAiProvider(profile.providerKind, {
        systemSafetyInstructions: AI_SYSTEM_SAFETY_INSTRUCTIONS, question: questionRedaction.text, context: evidence,
        citationIds: evidence.map((item) => item.citation.id), responseSchema: "AI_ASSISTANT_V1"
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("PROVIDER_TIMEOUT")), profile.requestTimeoutMs))
    ]);
    const answerRedaction = redactAiText(provider.answer);
    const citations = evidence.filter((item) => provider.citationIds.includes(item.citation.id)).map((item) => item.citation);
    const completeness = overallCompleteness(evidence);
    const audit = await createAiAssistantAudit(client, { requestId, actor, profile, mode, question, answer: answerRedaction.text, safetyDecision: provider.refusal ? "REFUSED" : "ALLOWED", refusalReasonCode: provider.refusal, toolKeys, evidence, citationCount: citations.length, redactionCount: redactionCount + answerRedaction.redactionCount, latencyMs: Date.now() - started });
    if (answerRedaction.redactionCount) await client.aiAssistantSafetyEvent.create({ data: { queryAuditId: audit.id, eventType: "RESPONSE_REDACTED", severity: "WARNING", safeReason: "Provider output matched a prohibited-data pattern and was redacted." } });
    return response(provider.refusal ? NO_EVIDENCE : answerRedaction.text, mode, provider.refusal ? "INSUFFICIENT" : completeness, citations, toolKeys, provider.uncertaintyNotice, requestId);
  } catch (error) {
    const code = error instanceof Error ? error.message : "ASSISTANT_FAILED";
    const failedAudit = await createAiAssistantAudit(client, { requestId, actor, profile, mode, question, safetyDecision: "FAILED", refusalReasonCode: code, toolKeys: [], evidence: [], redactionCount: 0, latencyMs: Date.now() - started }).catch(() => undefined);
    if (/PROVIDER|CITATION|TIMEOUT/.test(code)) await client.aiAssistantSafetyEvent.create({ data: { queryAuditId: failedAudit?.id ?? null, eventType: code.includes("CITATION") ? "CITATION_MISSING" : "PROVIDER_FAILURE", severity: "BLOCKED", safeReason: safeError(code) } }).catch(() => undefined);
    throw new Error(safeError(code));
  } finally {
    release();
  }
}

function response(answer: string, mode: AiAssistantMode, evidenceCompleteness: EvidenceCompleteness, citations: any[], sourceCategoriesUsed: string[], safetyNotice: string | undefined, requestId: string) {
  return {
    requestId, answer, retrievalMode: mode, generatedAt: new Date().toISOString(), evidenceCompleteness,
    citations, sourceCategoriesUsed: [...new Set(sourceCategoriesUsed.length ? sourceCategoriesUsed : citations.map((item) => item.sourceKey))],
    safetyNotice: safetyNotice ?? "Read-only assistant. It cannot change school records. Verify important decisions against the cited source. Operational decisions remain with authorised school leadership."
  };
}

export async function createAiAssistantAudit(client: any, value: any) {
  await purgeExpiredAiAssistantAudits(client);
  const expiresAt = new Date(Date.now() + value.profile.auditRetentionDays * 86_400_000);
  return client.aiAssistantQueryAudit.create({ data: {
    requestId: value.requestId, userId: value.actor.id, assistantProfileId: value.profile.id, mode: value.mode,
    questionHash: hashAiAuditContent(value.question), providerKind: value.profile.providerKind, providerModelReference: value.profile.providerModelReference,
    safetyDecision: value.safetyDecision, refusalReasonCode: value.refusalReasonCode ?? null,
    toolKeysJson: JSON.stringify(value.toolKeys), toolCallCount: value.toolKeys.length, sourceCount: value.evidence.length,
    citationCount: value.citationCount ?? 0, retrievedCharacterCount: value.evidence.reduce((sum: number, item: RetrievedEvidence) => sum + item.text.length, 0),
    redactionCount: value.redactionCount, latencyMs: value.latencyMs, answerHash: value.answer ? hashAiAuditContent(value.answer) : null, expiresAt
  } });
}

function jsonArray(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : []; } catch { return []; } }
function overallCompleteness(evidence: RetrievedEvidence[]): EvidenceCompleteness { return evidence.some((item) => item.completeness === "UNAVAILABLE") ? "UNAVAILABLE" : evidence.some((item) => item.completeness === "PARTIAL") ? "PARTIAL" : "COMPLETE"; }
function safeError(code: string) {
  if (code === "RATE_LIMIT_EXCEEDED") return "Too many assistant requests. Wait a minute and try again.";
  if (code === "CONCURRENT_REQUEST_BLOCKED") return "An assistant request is already running for this user.";
  if (code === "PROVIDER_TIMEOUT") return "The assistant provider timed out safely. No record was changed.";
  if (code.includes("CITATION")) return "The provider response failed citation validation and was not returned.";
  return "The assistant failed safely. No school record was changed.";
}
