import { randomUUID } from "node:crypto";
import { searchAiDocuments } from "@/lib/ai-assistant-documents";
import { validateAiProviderOutput } from "@/lib/ai-assistant-provider";
import { classifyAiQuestion } from "@/lib/ai-assistant-safety";
import { chooseAggregateTools } from "@/lib/ai-assistant-tools";
import { RECOMMENDED_ROLE_PERMISSIONS } from "@/lib/permissions";

export async function runAiAssistantEvaluations(client: any, userId: string) {
  const profile = await client.aiAssistantProfile.findFirst({ where: { providerKind: "MOCK", status: "ACTIVE" } });
  if (!profile) throw new Error("Active MOCK profile is required");
  const cases = await client.aiAssistantEvaluationCase.findMany({ where: { status: "ACTIVE" }, orderBy: { caseCode: "asc" } });
  const startedAt = new Date();
  const results = await Promise.all(cases.map(evaluateAiAssistantCase));
  const passedCases = results.filter((item: any) => item.passed).length;
  const runPrefix = profile.profileCode.startsWith("QA20A") ? "QA20A-RUN" : "AI-EVAL-RUN";
  return client.aiAssistantEvaluationRun.create({ data: {
    runNumber: `${runPrefix}-${startedAt.toISOString().replace(/\D/g, "").slice(0, 14)}-${randomUUID().slice(0, 6)}`,
    profileId: profile.id, startedAt, completedAt: new Date(), totalCases: results.length,
    passedCases, failedCases: results.length - passedCases,
    blockedCases: results.filter((item: any) => item.actualDecision === "BLOCKED").length,
    resultSummaryJson: JSON.stringify(results), createdByUserId: userId
  } });
}

export async function evaluateAiAssistantCase(item: any) {
  const requiredSourceKeys = jsonStringArray(item.requiredSourceKeysJson);
  let actualDecision = "BLOCKED";
  let safeSummary = "Deterministic evaluation did not meet the expected boundary.";

  if (item.category === "SAFETY") {
    actualDecision = classifyAiQuestion(String(item.question)).decision;
    safeSummary = "Safety classifier decision recorded.";
  } else if (item.category === "DOCUMENTATION") {
    const evidence = await searchAiDocuments(String(item.question), requiredSourceKeys, 4);
    actualDecision = requiredSourceKeys.length > 0 && requiredSourceKeys.every((key) => evidence.some((row) => row.sourceKey === key))
      ? "ALLOWED"
      : "BLOCKED";
    safeSummary = "Allowlisted documentation retrieval and citation coverage checked.";
  } else if (item.category === "AGGREGATE") {
    const selected = chooseAggregateTools(String(item.question));
    actualDecision = requiredSourceKeys.length > 0 && requiredSourceKeys.every((key) => selected.includes(key))
      ? "ALLOWED"
      : "BLOCKED";
    safeSummary = "Allowlisted aggregate-tool selection checked without querying operational records.";
  } else if (item.category === "CITATION") {
    try {
      const fabricated = /fabricat/i.test(String(item.caseCode));
      validateAiProviderOutput(
        { answer: "Synthetic evaluation answer.", citationIds: fabricated ? ["fabricated-source"] : [] },
        ["expected-source"]
      );
      actualDecision = "ALLOWED";
    } catch {
      actualDecision = "BLOCKED";
    }
    safeSummary = "Missing or fabricated citation rejection checked with synthetic provider output.";
  } else if (item.category === "PERMISSION" || item.category === "PERMISSION_BLOCKED") {
    const role = item.category === "PERMISSION_BLOCKED" ? "VIEWER" : "DIRECTOR";
    const permission = requiredSourceKeys.some((key) => key.startsWith("docs."))
      ? "USE_AI_ASSISTANT_DOCUMENTATION"
      : "USE_AI_ASSISTANT_AGGREGATES";
    actualDecision = RECOMMENDED_ROLE_PERMISSIONS[role].has(permission) ? "ALLOWED" : "BLOCKED";
    safeSummary = "Default role-permission boundary checked without changing permissions.";
  }

  const passed = actualDecision === item.expectedDecision;
  return {
    caseCode: item.caseCode,
    passed,
    expectedDecision: item.expectedDecision,
    actualDecision,
    safeSummary: passed ? safeSummary : "Expected decision did not match the deterministic evaluation."
  };
}

function jsonStringArray(value: unknown) {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}
