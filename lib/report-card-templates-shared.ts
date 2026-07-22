export function safeReportCardText(value: unknown, label: string, max: number, required = true) {
  const text = String(value ?? "").trim();
  if (required && !text) throw new Error(`${label} is required.`);
  if (text.length > max) throw new Error(`${label} must be ${max} characters or fewer.`);
  if (/[<>]/.test(text) || /(?:javascript\s*:|on(?:click|load|error)\s*=|<\/?(?:script|iframe|object))/i.test(text) || /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) throw new Error(`${label} must be safe plain text.`);
  return text || null;
}
