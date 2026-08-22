import type { UniversalSearchSourceState } from "@/lib/universal-search-contract";

export const SMART_AI_LIMITS = {
  minimumQuestionCharacters: 2,
  maximumQuestionCharacters: 2_000,
  maximumConversationTurns: 6,
  maximumConversationCharacters: 6_000,
  maximumRetrievalResults: 12,
  maximumContextCharacters: 8_000,
  maximumSourceCharacters: 900,
  maximumAnswerCharacters: 6_000,
  maximumCitations: 8,
  maximumProviderResponseBytes: 24_000,
  defaultProviderTimeoutMs: 8_000,
  minimumProviderTimeoutMs: 250,
  maximumProviderTimeoutMs: 30_000,
  maximumRequestBytes: 20_000
} as const;

export type SmartAiConversationTurn = {
  role: "USER" | "ASSISTANT";
  content: string;
};

export type SmartAiRequest = {
  question: string;
  conversation: SmartAiConversationTurn[];
};

export type SmartAiSource = {
  id: string;
  module: string;
  type: string;
  title: string;
  summary: string;
  status: string | null;
  timestamp: string | null;
  href: string;
};

export type SmartAiSourceCoverage = {
  source: string;
  label: string;
  state: UniversalSearchSourceState;
  message: string | null;
};

export type SmartAiProviderState = "DISABLED" | "READY" | "MISCONFIGURED";

export type SmartAiProviderStatus = {
  kind: "DISABLED" | "LOCAL";
  state: SmartAiProviderState;
  message: string;
};

export type SmartAiResponseStatus =
  | "ANSWER"
  | "REFUSED"
  | "PROVIDER_DISABLED"
  | "INSUFFICIENT_EVIDENCE"
  | "RETRIEVAL_DEGRADED"
  | "RETRIEVAL_FAILURE"
  | "PROVIDER_FAILURE";

export type SmartAiResponse = {
  status: SmartAiResponseStatus;
  answer: string;
  citations: SmartAiSource[];
  sources: SmartAiSource[];
  provider: SmartAiProviderStatus;
  retrieval: {
    resultCount: number;
    coverage: "COMPLETE" | "DEGRADED";
    sources: SmartAiSourceCoverage[];
  };
  timing: {
    retrievalMs: number;
    contextMs: number;
    providerMs: number;
    orchestrationMs: number;
    totalMs: number;
  };
  readOnly: true;
  ephemeral: true;
};

export type SmartAiProviderInput = {
  systemInstructions: string;
  question: string;
  conversation: SmartAiConversationTurn[];
  sources: SmartAiSource[];
  serializedContext: string;
  maximumAnswerCharacters: number;
};

export type SmartAiProviderOutput = {
  answer: string;
  citations: string[];
  uncertainty?: string;
};
