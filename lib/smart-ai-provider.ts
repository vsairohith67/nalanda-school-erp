import {
  SMART_AI_LIMITS,
  type SmartAiProviderInput,
  type SmartAiProviderOutput,
  type SmartAiProviderStatus,
  type SmartAiSource
} from "@/lib/smart-ai-contract";

export class SmartAiProviderError extends Error {
  constructor(public readonly code: string, message = "The Smart AI runtime failed safely.") {
    super(message);
  }
}

export interface SmartAiProvider {
  readonly status: SmartAiProviderStatus;
  generate(input: SmartAiProviderInput, signal?: AbortSignal): Promise<unknown>;
}

export function validateSmartAiProviderOutput(value: unknown, sources: SmartAiSource[]): SmartAiProviderOutput {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new SmartAiProviderError("PROVIDER_OUTPUT_MALFORMED");
  }
  const row = value as Record<string, unknown>;
  if (Object.keys(row).some((key) => !["answer", "citations", "uncertainty"].includes(key))) {
    throw new SmartAiProviderError("PROVIDER_OUTPUT_FIELDS_INVALID");
  }
  if (typeof row.answer !== "string") throw new SmartAiProviderError("PROVIDER_OUTPUT_MALFORMED");
  const answer = sanitizeSmartAiProviderText(row.answer, SMART_AI_LIMITS.maximumAnswerCharacters);
  if (!answer) throw new SmartAiProviderError("PROVIDER_ANSWER_EMPTY");
  if (!Array.isArray(row.citations) || row.citations.length > SMART_AI_LIMITS.maximumCitations || row.citations.some((citation) => typeof citation !== "string")) {
    throw new SmartAiProviderError("PROVIDER_CITATIONS_MALFORMED");
  }
  const allowed = new Set(sources.map((source) => source.id));
  const citations = [...new Set(row.citations.map((citation) => citation.trim()))];
  if (!citations.length) throw new SmartAiProviderError("PROVIDER_CITATIONS_MISSING");
  if (citations.some((citation) => !allowed.has(citation))) {
    throw new SmartAiProviderError("PROVIDER_CITATION_INVALID");
  }
  const uncertainty = row.uncertainty === undefined
    ? undefined
    : typeof row.uncertainty === "string"
      ? sanitizeSmartAiProviderText(row.uncertainty, 600)
      : (() => { throw new SmartAiProviderError("PROVIDER_UNCERTAINTY_MALFORMED"); })();
  return { answer, citations, ...(uncertainty ? { uncertainty } : {}) };
}

export function sanitizeSmartAiProviderText(value: string, maximumCharacters: number = SMART_AI_LIMITS.maximumAnswerCharacters) {
  return value
    .normalize("NFKC")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<svg[\s\S]*?<\/svg>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "[image removed]")
    .replace(/\[([^\]]+)]\((?:https?:|javascript:|data:)[^)]*\)/gi, "$1 [external link removed]")
    .replace(/\b(?:https?:\/\/|javascript:|data:text\/html)[^\s)]+/gi, "[external link removed]")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maximumCharacters);
}

export function disabledSmartAiProvider(message = "AI runtime is not configured. Authorised Search evidence can still be previewed."): SmartAiProvider {
  return {
    status: { kind: "DISABLED", state: "DISABLED", message },
    async generate() {
      throw new SmartAiProviderError("PROVIDER_DISABLED", message);
    }
  };
}
