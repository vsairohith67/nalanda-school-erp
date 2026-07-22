const SECRET_PATTERN = /(authorization|access[_ -]?token|app[_ -]?secret|verify[_ -]?token|password|bearer)\s*[:=]\s*[^\s,;]+/gi;
const PHONE_PATTERN = /\+?[1-9]\d{7,14}/g;

export function redactWhatsAppText(value: unknown) {
  return String(value ?? "")
    .replace(SECRET_PATTERN, "$1=[redacted]")
    .replace(PHONE_PATTERN, (phone) => `***${phone.slice(-4)}`)
    .slice(0, 500);
}

export function safeProviderError(error: unknown) {
  if (!error) return { category: "UNKNOWN", code: null, message: "Unknown provider error" };
  const source = error as { code?: unknown; message?: unknown; status?: unknown; name?: unknown };
  const code = source.code == null ? source.status == null ? null : String(source.status) : String(source.code);
  const message = redactWhatsAppText(source.message ?? source.name ?? error);
  return { category: classifyProviderError(code, message), code, message };
}

export function classifyProviderError(code: string | null, message: string) {
  if (code === "429" || /rate|throttl/i.test(message)) return "RATE_LIMIT";
  if (code && /^5\d\d$/.test(code) || /timeout|network|temporar/i.test(message)) return "TRANSIENT";
  if (/template|parameter|recipient|phone|permission|auth/i.test(message)) return "PERMANENT_VALIDATION";
  return "PROVIDER";
}

export function isRetryableProviderError(category: string) {
  return ["RATE_LIMIT", "TRANSIENT"].includes(category);
}
