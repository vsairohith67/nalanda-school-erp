const REDACTED_PWA_ERROR = "Registration failed. Review the secure-context and deployment configuration.";

export function redactPwaError(error: unknown) {
  if (!error) return null;
  return REDACTED_PWA_ERROR;
}

