const requests = new Map<string, number[]>();
const active = new Set<string>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 8;

export function beginAiRequest(userId: string, now = Date.now()) {
  const recent = (requests.get(userId) ?? []).filter((value) => now - value < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) throw new Error("RATE_LIMIT_EXCEEDED");
  if (active.has(userId)) throw new Error("CONCURRENT_REQUEST_BLOCKED");
  recent.push(now);
  requests.set(userId, recent);
  active.add(userId);
  return () => active.delete(userId);
}

export function resetAiRateLimitForTests() {
  requests.clear();
  active.clear();
}
