type Bucket = { attempts: number[] };
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ACCOUNT_REQUESTS = 3;
const MAX_SOURCE_REQUESTS = 20;
const MAX_BUCKETS = 5_000;
const globalState = globalThis as typeof globalThis & { authRecoveryBuckets?: Map<string, Bucket> };
const buckets = globalState.authRecoveryBuckets ?? new Map<string, Bucket>();
globalState.authRecoveryBuckets = buckets;

export async function recoveryRequestAllowed(identifier: string, channel: string, source: string, now = Date.now()) {
  const [accountHash, sourceHash] = await Promise.all([hash(`${identifier.trim().toLowerCase()}:${channel}`), hash(source)]);
  const keys = [[`account:${accountHash}:${sourceHash}`, MAX_ACCOUNT_REQUESTS], [`source:${sourceHash}`, MAX_SOURCE_REQUESTS]] as const;
  let allowed = true;
  for (const [key, maximum] of keys) {
    const bucket = buckets.get(key) ?? { attempts: [] };
    bucket.attempts = bucket.attempts.filter((time) => now - time < WINDOW_MS);
    if (bucket.attempts.length >= maximum) allowed = false;
    else bucket.attempts.push(now);
    buckets.set(key, bucket);
  }
  while (buckets.size > MAX_BUCKETS) buckets.delete(buckets.keys().next().value as string);
  return { allowed, accountHash: accountHash.slice(0, 12), sourceHash: sourceHash.slice(0, 12) };
}

export function resetRecoveryRateLimitForTests() { buckets.clear(); }

async function hash(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
