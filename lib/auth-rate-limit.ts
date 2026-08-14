type LoginBucket = {
  failures: number[];
  blockedUntil: number;
};

type LoginRateLimitInput = {
  identifier: string;
  source: string;
};

const WINDOW_MS = 5 * 60 * 1000;
const BLOCK_MS = 60 * 1000;
const MAX_FAILURES = 10;
const MAX_BUCKETS = 5_000;

const globalForAuthRateLimit = globalThis as typeof globalThis & {
  authLoginBuckets?: Map<string, LoginBucket>;
};

const buckets = globalForAuthRateLimit.authLoginBuckets ?? new Map<string, LoginBucket>();
globalForAuthRateLimit.authLoginBuckets = buckets;

export async function checkLoginRateLimit(input: LoginRateLimitInput, now = Date.now()) {
  const identity = await loginBucketIdentity(input);
  let retryAfterSeconds = 0;
  for (const key of identity.blockingKeys) {
    const bucket = currentBucket(key, now);
    if (bucket.blockedUntil > now) {
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil((bucket.blockedUntil - now) / 1000));
    }
  }
  return {
    allowed: retryAfterSeconds === 0,
    retryAfterSeconds,
    accountHash: identity.accountHash.slice(0, 12),
    sourceHash: identity.sourceHash.slice(0, 12)
  };
}

export async function recordLoginFailure(input: LoginRateLimitInput, now = Date.now()) {
  const identity = await loginBucketIdentity(input);
  let retryAfterSeconds = 0;
  for (const key of identity.blockingKeys) {
    const bucket = currentBucket(key, now);
    bucket.failures.push(now);
    if (bucket.failures.length >= MAX_FAILURES) {
      bucket.blockedUntil = Math.max(bucket.blockedUntil, now + BLOCK_MS);
      retryAfterSeconds = Math.max(retryAfterSeconds, Math.ceil(BLOCK_MS / 1000));
    }
    buckets.set(key, bucket);
  }
  pruneBuckets(now);
  return {
    blocked: retryAfterSeconds > 0,
    retryAfterSeconds,
    accountHash: identity.accountHash.slice(0, 12),
    sourceHash: identity.sourceHash.slice(0, 12)
  };
}

export async function clearLoginAccountFailures(identifier: string) {
  const accountHash = await sha256(identifier.trim().toLowerCase());
  for (const key of buckets.keys()) {
    if (key.startsWith(`account-source:${accountHash}:`)) buckets.delete(key);
  }
}

export function loginRequestSource(
  headers: Pick<Headers, "get">,
  environment: Record<string, string | undefined> = process.env
) {
  if (
    environment.TRUST_PROXY_HEADERS === "true" &&
    environment.NALANDA_TRUSTED_PROXY_MODE === "single-hop-sanitized"
  ) {
    const forwarded = headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
    const real = headers.get("x-real-ip")?.trim();
    const value = forwarded || real;
    if (value) return value.slice(0, 128);
  }
  return "direct";
}

export function resetLoginRateLimitForTests() {
  buckets.clear();
}

async function loginBucketIdentity(input: LoginRateLimitInput) {
  const [accountHash, sourceHash] = await Promise.all([
    sha256(input.identifier.trim().toLowerCase()),
    sha256(input.source)
  ]);
  // Direct mode has no trustworthy client distinction, so a global source
  // lockout would let one caller deny login to every unrelated account. Keep
  // the per-account control there; only enforce source-wide spraying limits
  // when a configured sanitized proxy supplies a distinct source.
  const blockingKeys = [`account-source:${accountHash}:${sourceHash}`];
  if (input.source !== "direct") blockingKeys.push(`source:${sourceHash}`);
  return { accountHash, sourceHash, blockingKeys };
}

function currentBucket(key: string, now: number) {
  const existing = buckets.get(key) ?? { failures: [], blockedUntil: 0 };
  existing.failures = existing.failures.filter((value) => now - value < WINDOW_MS);
  if (existing.blockedUntil <= now) existing.blockedUntil = 0;
  return existing;
}

function pruneBuckets(now: number) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [key, bucket] of buckets) {
    const active = bucket.blockedUntil > now || bucket.failures.some((value) => now - value < WINDOW_MS);
    if (!active) buckets.delete(key);
    if (buckets.size <= MAX_BUCKETS) break;
  }
  while (buckets.size > MAX_BUCKETS) {
    const oldest = buckets.keys().next().value as string | undefined;
    if (!oldest) break;
    buckets.delete(oldest);
  }
}

async function sha256(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
