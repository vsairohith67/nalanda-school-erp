const SAFE_AI_ERROR_MESSAGES: Record<string, string> = {
  RATE_LIMIT_EXCEEDED: "Too many assistant requests. Please wait before trying again.",
  CONCURRENT_REQUEST_BLOCKED: "Another assistant request is already in progress for this user.",
  QUESTION_LENGTH_EXCEEDED: "The question is empty or exceeds the configured safe length.",
  INVALID_ASSISTANT_MODE: "The requested retrieval mode is not available.",
  AI_ASSISTANT_PROFILE_UNAVAILABLE: "The read-only assistant is currently unavailable.",
  PROVIDER_DISABLED: "The selected provider is disabled.",
  PROVIDER_TIMEOUT: "The read-only assistant timed out safely. No school record was changed.",
  PROVIDER_OUTPUT_MALFORMED: "The provider returned an invalid response and it was rejected.",
  PROVIDER_CITATION_FABRICATED: "The provider response was rejected because a citation was not retrieved.",
  PROVIDER_CITATION_MISSING: "The provider response was rejected because a required citation was missing."
};

export function safeAiAssistantError(error: unknown) {
  const code = error instanceof Error ? error.message : "";
  return {
    status: code === "RATE_LIMIT_EXCEEDED" || code === "CONCURRENT_REQUEST_BLOCKED" ? 429 : 400,
    message: SAFE_AI_ERROR_MESSAGES[code] ?? "The assistant failed safely. No school record was changed."
  };
}
