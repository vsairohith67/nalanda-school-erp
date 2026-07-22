const RULES: Array<[string, RegExp]> = [
  ["credential", /\b(?:sk-[A-Za-z0-9_-]{12,}|(?:api[_ -]?key|access[_ -]?token|password(?:hash)?|secret|session(?:token)?|cookie|authorization)\s*[:=]\s*\S+)/gi],
  ["email", /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi],
  ["phone", /(?<!\d)(?:\+?91[\s-]?)?[6-9]\d{9}(?!\d)/g],
  ["aadhaar", /(?<!\d)\d{4}[\s-]?\d{4}[\s-]?\d{4}(?!\d)/g],
  ["bank", /\b(?:account|a\/c)\s*(?:number|no\.?)?\s*[:=-]?\s*\d{8,18}\b/gi],
  ["password-hash", /(?:\$(?:2[aby]|argon2)[^ \n]{20,}|scrypt\$(?:[^$\s]+\$){3,}[^$\s]+)/gi],
  ["database-url", /\b(?:postgres(?:ql)?|mysql|file):\/\/?\S+/gi],
  ["cookie", /\b(?:connect\.sid|next-auth\.session-token|__Secure-[A-Za-z0-9_-]+)=\S+/gi],
  ["address", /\b(?:postal\s+)?address\s*[:=]\s*[^\r\n,;]{6,120}(?:,[^\r\n;]{2,80})?/gi],
  ["raw-id", /\b(?:user|student|teacher|guardian|record|admission|session|request|receipt)(?:Id|No| ID| number)?\s*[:=]\s*[A-Za-z0-9_-]{6,80}\b/gi]
];

export function redactAiText(value: string) {
  let text = value;
  let redactionCount = 0;
  const categories = new Set<string>();
  for (const [category, pattern] of RULES) {
    text = text.replace(pattern, () => {
      redactionCount += 1;
      categories.add(category);
      return `[REDACTED ${category.toUpperCase()}]`;
    });
  }
  return { text, redactionCount, categories: [...categories] };
}

export function stripUnsafeAssistantMarkdown(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "[external image removed]")
    .replace(/\[[^\]]+]\((?:https?:|javascript:|data:)[^)]*\)/gi, "[external link removed]")
    .slice(0, 12_000)
    .trim();
}
