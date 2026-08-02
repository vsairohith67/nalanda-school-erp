const WINDOW_MS = 60_000;
const MAX_EXPORTS = 6;

const globalForCalendarExport = globalThis as typeof globalThis & {
  academicCalendarExportBuckets?: Map<string, number[]>;
};

const buckets = globalForCalendarExport.academicCalendarExportBuckets ?? new Map<string, number[]>();
globalForCalendarExport.academicCalendarExportBuckets = buckets;

export function checkAcademicCalendarExportRateLimit(actorId: string, now = Date.now()) {
  const cutoff = now - WINDOW_MS;
  const attempts = (buckets.get(actorId) ?? []).filter((attempt) => attempt > cutoff);
  if (attempts.length >= MAX_EXPORTS) {
    const retryAfterSeconds = Math.max(1, Math.ceil((attempts[0] + WINDOW_MS - now) / 1_000));
    buckets.set(actorId, attempts);
    return { allowed: false, retryAfterSeconds };
  }
  attempts.push(now);
  buckets.set(actorId, attempts);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetAcademicCalendarExportRateLimitForTests() { buckets.clear(); }
