import { stripUnsafeAssistantMarkdown } from "@/lib/ai-assistant-redaction";
import type { AiProviderInput, AiProviderOutput } from "@/lib/ai-assistant-types";
import { callMockProvider } from "@/lib/ai-assistant-provider-mock";
import { callLocalProvider } from "@/lib/ai-assistant-provider-local";
import { callCloudProvider } from "@/lib/ai-assistant-provider-cloud";

export type AiProviderKind = "MOCK" | "LOCAL_HTTP" | "CLOUD_API";

export async function callAiProvider(kind: AiProviderKind, input: AiProviderInput): Promise<AiProviderOutput> {
  const raw = kind === "MOCK"
    ? await callMockProvider(input)
    : kind === "LOCAL_HTTP"
      ? await callLocalProvider(input)
      : await callCloudProvider(input);
  return validateAiProviderOutput(raw, input.citationIds);
}

export function validateAiProviderOutput(value: unknown, allowedCitationIds: string[]): AiProviderOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("PROVIDER_OUTPUT_MALFORMED");
  const row = value as Record<string, unknown>;
  const answer = stripUnsafeAssistantMarkdown(String(row.answer ?? ""));
  const citationIds = Array.isArray(row.citationIds) ? row.citationIds.map(String) : [];
  if (!answer && !row.refusal) throw new Error("PROVIDER_OUTPUT_MALFORMED");
  if (citationIds.some((id) => !allowedCitationIds.includes(id))) throw new Error("PROVIDER_CITATION_FABRICATED");
  if (answer && !row.refusal && citationIds.length === 0) throw new Error("PROVIDER_CITATION_MISSING");
  return {
    answer,
    citationIds: [...new Set(citationIds)],
    ...(row.uncertaintyNotice ? { uncertaintyNotice: stripUnsafeAssistantMarkdown(String(row.uncertaintyNotice)) } : {}),
    ...(row.refusal ? { refusal: stripUnsafeAssistantMarkdown(String(row.refusal)) } : {})
  };
}
