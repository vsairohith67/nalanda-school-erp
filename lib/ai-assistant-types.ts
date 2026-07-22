import type { Role } from "@/lib/permissions";

export const AI_MODES = ["DOCUMENTATION", "AGGREGATE_OPERATIONS"] as const;
export type AiAssistantMode = (typeof AI_MODES)[number];
export type EvidenceCompleteness = "COMPLETE" | "PARTIAL" | "INSUFFICIENT" | "UNAVAILABLE";

export type AiCitation = {
  id: string;
  sourceKey: string;
  label: string;
  heading?: string;
  relativePath?: string;
  sourceTimestamp: string;
};

export type RetrievedEvidence = {
  sourceKey: string;
  sourceCategory: "DOCUMENT" | "AGGREGATE_TOOL";
  text: string;
  citation: AiCitation;
  completeness: EvidenceCompleteness;
};

export type AiProviderInput = {
  systemSafetyInstructions: string;
  question: string;
  context: RetrievedEvidence[];
  citationIds: string[];
  responseSchema: "AI_ASSISTANT_V1";
};

export type AiProviderOutput = {
  answer: string;
  citationIds: string[];
  uncertaintyNotice?: string;
  refusal?: string;
};

export type AssistantActor = { id: string; role: Role };
