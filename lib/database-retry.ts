type RetryLogger = (event: { event: "database_transaction_retry" | "database_transaction_retry_exhausted"; attempt: number; category: "serialization_or_deadlock" }) => void;

function errorCodes(error: unknown): string[] {
  const seen = new Set<unknown>();
  const codes: string[] = [];
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as Record<string, unknown>;
    if (typeof record.code === "string") codes.push(record.code);
    current = record.cause ?? record.meta;
  }
  const message = error instanceof Error ? error.message : "";
  for (const code of ["40001", "40P01"]) if (message.includes(code)) codes.push(code);
  return codes;
}

export function isRetryableDatabaseConflict(error: unknown) {
  return errorCodes(error).some((code) => code === "P2034" || code === "40001" || code === "40P01");
}

export async function withDatabaseRetry<T>(
  operation: () => Promise<T>,
  options: { maxAttempts?: number; baseDelayMs?: number; logger?: RetryLogger; random?: () => number } = {}
) {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 20;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 5) throw new Error("DATABASE_RETRY_ATTEMPTS_INVALID");
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isRetryableDatabaseConflict(error) || attempt === maxAttempts) {
        if (isRetryableDatabaseConflict(error)) options.logger?.({ event: "database_transaction_retry_exhausted", attempt, category: "serialization_or_deadlock" });
        throw error;
      }
      options.logger?.({ event: "database_transaction_retry", attempt, category: "serialization_or_deadlock" });
      const random = options.random?.() ?? Math.random();
      const delay = Math.min(250, baseDelayMs * 2 ** (attempt - 1) + Math.floor(random * baseDelayMs));
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("DATABASE_RETRY_UNREACHABLE");
}

export function publicDatabaseError(error: unknown) {
  const codes = errorCodes(error);
  if (codes.includes("P2002") || codes.includes("23505")) return { code: "CONFLICT", status: 409, message: "This operation conflicts with an existing record." };
  if (codes.includes("P2003") || codes.includes("23503")) return { code: "RELATED_RECORD_CONFLICT", status: 409, message: "A related record is unavailable or changed." };
  if (codes.some((code) => ["P2034", "40001", "40P01"].includes(code))) return { code: "RETRY_LATER", status: 409, message: "The record changed concurrently. Please retry." };
  if (codes.some((code) => ["P1001", "P2024", "57P01", "55P03", "57014"].includes(code))) return { code: "DATABASE_TEMPORARILY_UNAVAILABLE", status: 503, message: "The service is temporarily unavailable." };
  return { code: "DATABASE_OPERATION_FAILED", status: 500, message: "The database operation could not be completed." };
}
