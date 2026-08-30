import { randomUUID } from "node:crypto";
import Valkey from "iovalkey";
import type { RateLimitStore, RateLimitStoreDecision } from "@/lib/security-resilience";
import { readPortableSecret } from "@/lib/portable-runtime/secrets";

const MAX_KEYS_PER_DECISION = 16;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1_000;
const KEY_COMPONENT = /^[a-z0-9._:-]{1,320}$/i;
const LUA_SLIDING_WINDOW = String.raw`
local maximum = tonumber(ARGV[1])
local window_ms = tonumber(ARGV[2])
local member = ARGV[3]
local server_time = redis.call('TIME')
local now_ms = (tonumber(server_time[1]) * 1000) + math.floor(tonumber(server_time[2]) / 1000)
local cutoff = now_ms - window_ms
local blocked = 0
local retry_ms = 0

for index, key in ipairs(KEYS) do
  redis.call('ZREMRANGEBYSCORE', key, '-inf', cutoff)
  local count = redis.call('ZCARD', key)
  if count >= maximum then
    blocked = 1
    local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    if oldest[2] then
      local candidate = math.max(1, tonumber(oldest[2]) + window_ms - now_ms)
      if candidate > retry_ms then retry_ms = candidate end
    end
  end
end

if blocked == 1 then
  return {0, retry_ms}
end

for index, key in ipairs(KEYS) do
  redis.call('ZADD', key, now_ms, member .. ':' .. index)
  redis.call('PEXPIRE', key, window_ms + 1000)
end
return {1, 0}
`;

export type ValkeyRateLimitHealth = {
  ready: boolean;
  state: "ready" | "unavailable";
  safeCode: "VALKEY_READY" | "VALKEY_UNAVAILABLE";
};

export interface DistributedValkeyRateLimitStore extends RateLimitStore {
  readonly kind: "distributed";
  readonly distributed: true;
  healthCheck(): Promise<ValkeyRateLimitHealth>;
  close(): Promise<void>;
}

function boundedInteger(value: unknown, minimum: number, maximum: number, code: string) {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) throw new Error(code);
  return Number(value);
}

function valkeyUrl(environment: NodeJS.ProcessEnv) {
  const source = readPortableSecret("VALKEY_URL", environment, { required: true });
  let parsed: URL;
  try { parsed = new URL(source); }
  catch { throw new Error("VALKEY_URL_INVALID"); }
  if (!new Set(["redis:", "rediss:", "valkey:", "valkeys:"]).has(parsed.protocol)) throw new Error("VALKEY_URL_PROTOCOL_INVALID");
  const deployment = (environment.NALANDA_ENVIRONMENT ?? environment.DEPLOYMENT_ENVIRONMENT ?? "").toLowerCase();
  if (new Set(["staging", "production"]).has(deployment) && !new Set(["rediss:", "valkeys:"]).has(parsed.protocol)) {
    throw new Error("VALKEY_TLS_REQUIRED");
  }
  if (parsed.protocol === "valkey:") parsed.protocol = "redis:";
  if (parsed.protocol === "valkeys:") parsed.protocol = "rediss:";
  return parsed.toString();
}

function safeKey(key: string) {
  if (!KEY_COMPONENT.test(key) || /[{}\s\u0000-\u001f]/.test(key)) throw new Error("VALKEY_RATE_LIMIT_KEY_INVALID");
  return `{nalanda-rate-limit}:v1:${key}`;
}

export function createValkeyRateLimitStore(
  environment: NodeJS.ProcessEnv = process.env,
  options: { client?: Valkey } = {}
): DistributedValkeyRateLimitStore {
  const connectTimeout = boundedInteger(Number(environment.VALKEY_CONNECT_TIMEOUT_MS || 3_000), 100, 30_000, "VALKEY_CONNECT_TIMEOUT_INVALID");
  const commandTimeout = boundedInteger(Number(environment.VALKEY_COMMAND_TIMEOUT_MS || 2_000), 100, 30_000, "VALKEY_COMMAND_TIMEOUT_INVALID");
  const client = options.client ?? new Valkey(valkeyUrl(environment), {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout,
    commandTimeout,
    retryStrategy(attempt) {
      if (attempt > 5) return null;
      return Math.min(1_000, 100 * attempt);
    }
  });
  client.on("error", () => undefined);
  let pendingReady: Promise<void> | null = null;

  async function waitUntilReady() {
    if (client.status === "ready") return;
    if (new Set(["wait", "end"]).has(String(client.status))) await client.connect();
    if (String(client.status) === "ready") return;
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error("VALKEY_NOT_READY")), connectTimeout);
      const onReady = () => finish();
      const onEnd = () => finish(new Error("VALKEY_NOT_READY"));
      const finish = (error?: Error) => {
        clearTimeout(timeout);
        client.off("ready", onReady);
        client.off("end", onEnd);
        if (error) reject(error);
        else resolve();
      };
      client.once("ready", onReady);
      client.once("end", onEnd);
      if (String(client.status) === "ready") finish();
    });
  }

  async function ready() {
    if (client.status === "ready") return;
    if (!pendingReady) {
      pendingReady = waitUntilReady().finally(() => { pendingReady = null; });
    }
    await pendingReady;
  }

  return {
    kind: "distributed",
    distributed: true,
    async consume(input): Promise<RateLimitStoreDecision> {
      const maximum = boundedInteger(input.maximum, 1, 10_000, "VALKEY_RATE_LIMIT_MAXIMUM_INVALID");
      const windowMs = boundedInteger(input.windowMs, 1_000, MAX_WINDOW_MS, "VALKEY_RATE_LIMIT_WINDOW_INVALID");
      if (!Array.isArray(input.keys) || input.keys.length < 1 || input.keys.length > MAX_KEYS_PER_DECISION) {
        throw new Error("VALKEY_RATE_LIMIT_KEY_COUNT_INVALID");
      }
      const keys = [...new Set(input.keys)].map(safeKey);
      await ready();
      const raw = await client.eval(
        LUA_SLIDING_WINDOW,
        keys.length,
        ...keys,
        String(maximum),
        String(windowMs),
        randomUUID()
      ) as [number | string, number | string];
      if (!Array.isArray(raw) || raw.length !== 2) throw new Error("VALKEY_RATE_LIMIT_RESPONSE_INVALID");
      const allowed = Number(raw[0]);
      const retryMs = Number(raw[1]);
      if (![0, 1].includes(allowed) || !Number.isFinite(retryMs) || retryMs < 0 || retryMs > windowMs) {
        throw new Error("VALKEY_RATE_LIMIT_RESPONSE_INVALID");
      }
      return allowed === 1
        ? { allowed: true, retryAfterSeconds: 0 }
        : { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1_000)) };
    },
    async healthCheck() {
      try {
        await ready();
        const response = await client.ping();
        return response === "PONG"
          ? { ready: true, state: "ready", safeCode: "VALKEY_READY" }
          : { ready: false, state: "unavailable", safeCode: "VALKEY_UNAVAILABLE" };
      } catch {
        return { ready: false, state: "unavailable", safeCode: "VALKEY_UNAVAILABLE" };
      }
    },
    async close() {
      if (client.status === "ready") await client.quit().catch(() => client.disconnect());
      else client.disconnect();
    }
  };
}
