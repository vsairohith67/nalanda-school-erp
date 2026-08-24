export type OperationCost = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";
export type ActorDimension = "ip" | "account" | "role" | "session" | "device" | "endpoint" | "operationCost";

export type OperationActors = Partial<Record<Exclude<ActorDimension, "endpoint" | "operationCost">, string>>;

export type RateLimitPolicy = {
  id: string;
  cost: OperationCost;
  methods: readonly string[];
  windowMs: number;
  maximum: number;
  dimensions: readonly ActorDimension[];
  matches(pathname: string): boolean;
};

export type RateLimitConsumeInput = {
  keys: string[];
  maximum: number;
  windowMs: number;
  now: number;
};

export type RateLimitStoreDecision = { allowed: boolean; retryAfterSeconds: number };

export interface RateLimitStore {
  readonly kind: "local-deterministic" | "single-process" | "distributed";
  readonly distributed: boolean;
  consume(input: RateLimitConsumeInput): Promise<RateLimitStoreDecision>;
}

export type RateLimitDecision = RateLimitStoreDecision & {
  policy: RateLimitPolicy | null;
  status: 200 | 429 | 503;
  code: "ALLOWED" | "RATE_LIMITED" | "RATE_LIMIT_STORE_UNAVAILABLE";
};

const MINUTE = 60_000;
const dimensions = ["ip", "account", "role", "session", "device", "endpoint", "operationCost"] as const;

export const RATE_LIMIT_POLICIES: readonly RateLimitPolicy[] = [
  policy("auth.login", "MEDIUM", ["POST"], 30, MINUTE, (path) => path === "/api/auth/login"),
  policy("auth.recovery", "MEDIUM", ["POST"], 5, 15 * MINUTE, (path) => path.startsWith("/api/auth/recovery/")),
  policy("auth.otp", "MEDIUM", ["POST"], 6, 10 * MINUTE, (path) => /^\/api\/auth\/(?:otp|verification)(?:\/|$)/i.test(path)),
  policy("public.admissions", "MEDIUM", ["POST", "PATCH"], 8, 10 * MINUTE, (path) => path.startsWith("/api/public/admissions/")),
  policy("public.support", "MEDIUM", ["POST"], 6, 10 * MINUTE, (path) => path.startsWith("/api/public/support/")),
  policy("smart-ai", "HIGH", ["POST"], 8, MINUTE, (path) => path === "/api/super-admin/ai" || path.startsWith("/api/ai-assistant/")),
  policy("universal-search", "MEDIUM", ["POST"], 30, MINUTE, (path) => path === "/api/super-admin/search"),
  policy("pdf-generation", "HIGH", ["POST"], 6, 10 * MINUTE, (path) => /(?:pdf-jobs|\/pdf(?:\/|$))/i.test(path)),
  policy("event-media", "HIGH", ["POST", "PATCH"], 10, 10 * MINUTE, (path) => path.startsWith("/api/event-media/")),
  policy("upload", "HIGH", ["POST", "PUT", "PATCH"], 12, 10 * MINUTE, (path) => /(?:attachments|documents|pages|assets)(?:\/|$)/i.test(path)),
  policy("real-data-import", "HIGH", ["POST"], 6, 15 * MINUTE, (path) => path.startsWith("/api/import/") || /\/import(?:\/|$)/i.test(path)),
  policy("bulk-export", "HIGH", ["GET", "POST"], 12, 10 * MINUTE, (path) => /\/export(?:\/|$)/i.test(path)),
  policy("sync", "HIGH", ["GET", "POST", "PATCH"], 30, MINUTE, (path) => /\/sync\/(?:push|pull)(?:\/|$)/i.test(path))
] as const;

const globalState = globalThis as typeof globalThis & {
  __nalandaRateLimitStore?: RateLimitStore;
  __nalandaDistributedRateLimitStore?: RateLimitStore;
};

export function operationPolicy(pathname: string, method: string) {
  const normalizedMethod = method.toUpperCase();
  return RATE_LIMIT_POLICIES.find((candidate) => candidate.methods.includes(normalizedMethod) && candidate.matches(pathname)) ?? null;
}

export async function enforceOperationRateLimit(
  pathname: string,
  method: string,
  actors: OperationActors,
  options: { now?: number; environment?: Record<string, string | undefined>; store?: RateLimitStore; dimensions?: readonly ActorDimension[] } = {}
): Promise<RateLimitDecision> {
  const matched = operationPolicy(pathname, method);
  if (!matched) return { allowed: true, retryAfterSeconds: 0, policy: null, status: 200, code: "ALLOWED" };
  const environment = options.environment ?? process.env;
  const store = options.store ?? configuredRateLimitStore(environment);
  if (!store) {
    return { allowed: false, retryAfterSeconds: 30, policy: matched, status: 503, code: "RATE_LIMIT_STORE_UNAVAILABLE" };
  }
  const keys = await actorKeys(matched, pathname, actors, options.dimensions ?? matched.dimensions);
  const decision = await store.consume({ keys, maximum: matched.maximum, windowMs: matched.windowMs, now: options.now ?? Date.now() });
  return {
    ...decision,
    policy: matched,
    status: decision.allowed ? 200 : 429,
    code: decision.allowed ? "ALLOWED" : "RATE_LIMITED"
  };
}

export function registerDistributedRateLimitStore(store: RateLimitStore) {
  if (!store.distributed || store.kind !== "distributed") throw new Error("A production rate-limit store must be distributed and atomic.");
  globalState.__nalandaDistributedRateLimitStore = store;
}

export function configuredRateLimitStore(environment: Record<string, string | undefined> = process.env) {
  if (environment.NODE_ENV === "production") {
    if (localProductionRehearsalAllowed(environment)) {
      return globalState.__nalandaRateLimitStore ??= createSingleProcessRateLimitStore();
    }
    return globalState.__nalandaDistributedRateLimitStore ?? null;
  }
  return globalState.__nalandaRateLimitStore ??= createSingleProcessRateLimitStore();
}

export function createDeterministicRateLimitStore(maximumBuckets = 10_000): RateLimitStore {
  return memoryStore("local-deterministic", maximumBuckets);
}

export function createSingleProcessRateLimitStore(maximumBuckets = 10_000): RateLimitStore {
  return memoryStore("single-process", maximumBuckets);
}

export function resetSecurityRateLimitStoresForTests() {
  delete globalState.__nalandaRateLimitStore;
  delete globalState.__nalandaDistributedRateLimitStore;
}

function policy(
  id: string,
  cost: OperationCost,
  methods: readonly string[],
  maximum: number,
  windowMs: number,
  matches: (pathname: string) => boolean
): RateLimitPolicy {
  return { id, cost, methods, maximum, windowMs, dimensions, matches };
}

function memoryStore(kind: RateLimitStore["kind"], maximumBuckets: number): RateLimitStore {
  const buckets = new Map<string, number[]>();
  return {
    kind,
    distributed: false,
    async consume(input) {
      const active = input.keys.map((key) => {
        const attempts = (buckets.get(key) ?? []).filter((time) => input.now - time < input.windowMs);
        return { key, attempts };
      });
      const blocked = active.filter((entry) => entry.attempts.length >= input.maximum);
      if (blocked.length) {
        const retryAfterSeconds = Math.max(...blocked.map((entry) => Math.max(1, Math.ceil((entry.attempts[0] + input.windowMs - input.now) / 1_000))));
        active.forEach((entry) => buckets.set(entry.key, entry.attempts));
        return { allowed: false, retryAfterSeconds };
      }
      active.forEach((entry) => buckets.set(entry.key, [...entry.attempts, input.now]));
      while (buckets.size > maximumBuckets) buckets.delete(buckets.keys().next().value as string);
      return { allowed: true, retryAfterSeconds: 0 };
    }
  };
}

async function actorKeys(policyValue: RateLimitPolicy, pathname: string, actors: OperationActors, selectedDimensions: readonly ActorDimension[]) {
  const keys: string[] = [];
  const values: Partial<Record<ActorDimension, string>> = {
    ...actors,
    endpoint: normalizedEndpoint(pathname),
    operationCost: policyValue.cost
  };
  const actorAnchor = actors.account ?? actors.session ?? actors.device ?? actors.ip;
  for (const dimension of selectedDimensions.filter((candidate) => candidate !== "endpoint" && candidate !== "operationCost")) {
    const value = values[dimension]?.trim();
    if (!value) continue;
    const actorScopedValue = dimension === "role" && actorAnchor ? `${actorAnchor}:${value}` : value;
    keys.push(`${policyValue.id}:${dimension}:${await digest(actorScopedValue)}`);
  }
  if (keys.length) return keys;
  const fallback = [
    selectedDimensions.includes("endpoint") ? values.endpoint : undefined,
    selectedDimensions.includes("operationCost") ? values.operationCost : undefined
  ].filter(Boolean).join(":") || policyValue.id;
  return [`${policyValue.id}:anonymous:${await digest(fallback)}`];
}

function normalizedEndpoint(pathname: string) {
  return pathname
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ":id")
    .replace(/\b\d{3,}\b/g, ":number")
    .slice(0, 240);
}

function localProductionRehearsalAllowed(environment: Record<string, string | undefined>) {
  if (
    environment.NALANDA_LOCAL_SECURITY_REHEARSAL !== "true" ||
    environment.QA20C_ISOLATED_DATABASE !== "true" ||
    environment.SECURITY_RATE_LIMIT_MODE !== "single-process-rehearsal"
  ) return false;
  try {
    const host = new URL(environment.APP_ORIGIN ?? "").hostname;
    return host === "localhost" || host.endsWith(".localhost") || host === "127.0.0.1" || host === "[::1]";
  } catch {
    return false;
  }
}

async function digest(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
}
