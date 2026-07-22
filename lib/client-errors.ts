const INTERNAL_ERROR_PATTERNS = [
  /\bprisma\b/i,
  /\bsql(?:ite|state)?\b/i,
  /\b(?:select|insert|update|delete|alter|drop)\s+(?:from|into|table|database)\b/i,
  /\b(?:unique|foreign key|check|not null)\s+constraint\b/i,
  /\bnode_modules\b/i,
  /\b(?:auth|session|api)[_-]?(?:secret|token|key)\b/i,
  /\bpassword(?:hash)?\b/i,
  /(?:[a-z]:\\|\/(?:home|users?|var|tmp)\/)/i,
  /\bat\s+(?:async\s+)?[\w$.<>]+\s*\(/i
];

export function safeClientError(error: unknown, fallback: string) {
  if (!(error instanceof Error)) return fallback;
  const message = error.message.replace(/[\u0000-\u001f\u007f]+/g, " ").trim();
  if (!message || message.length > 300) return fallback;
  if (INTERNAL_ERROR_PATTERNS.some((pattern) => pattern.test(message))) return fallback;
  return message;
}
