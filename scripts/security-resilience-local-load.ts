import { createHash } from "node:crypto";
import { BoundedSemaphore, ResourceGuardError } from "../lib/resource-guard";
import { createDeterministicRateLimitStore, enforceOperationRateLimit } from "../lib/security-resilience";

const HARD_MAX_REQUESTS = 250;
const HARD_MAX_CONCURRENCY = 8;
const HARD_MAX_DURATION_MS = 10_000;
const started = Date.now();
let total = 0;

async function main() {
assertLocalOnly(process.env.SECURITY_LOAD_TARGET);

const store = createDeterministicRateLimitStore(1_000);
const scenarios = [
  ["normal", "/api/dashboard", "GET", 20],
  ["login-burst", "/api/auth/login", "POST", 40],
  ["public-form-burst", "/api/public/support/requests", "POST", 20],
  ["search-burst", "/api/super-admin/search", "POST", 45],
  ["export-burst", "/api/support/reports/export", "GET", 24]
] as const;

let accepted = 0;
let rejected429 = 0;
for (const [name, path, method, count] of scenarios) {
  for (let index = 0; index < count; index += 1) {
    enforceSafety();
    const result = await enforceOperationRateLimit(path, method, { ip: "192.0.2.25", session: `synthetic-${name}` }, { store, now: index });
    total += 1;
    if (result.allowed) accepted += 1;
    else if (result.status === 429) rejected429 += 1;
  }
}

const cpuGuard = new BoundedSemaphore(2, 4, 50);
const concurrencyResults = await Promise.allSettled(Array.from({ length: HARD_MAX_CONCURRENCY }, async (_, index) => {
  const release = await cpuGuard.acquire();
  try {
    await new Promise((resolve) => setTimeout(resolve, index < 2 ? 40 : 5));
    createHash("sha256").update(Buffer.alloc(8 * 1024, index)).digest();
    return "completed";
  } finally { release(); }
}));
const controlled503 = concurrencyResults.filter((result) => result.status === "rejected" && result.reason instanceof ResourceGuardError).length;

const dbPoolModel = new BoundedSemaphore(2, 2, 25);
const dbHolds = await Promise.all([dbPoolModel.acquire(), dbPoolModel.acquire()]);
const dbQueued = [dbPoolModel.acquire(), dbPoolModel.acquire()];
await expectCapacityFailure(dbPoolModel.acquire());
dbHolds.forEach((release) => release());
(await Promise.all(dbQueued)).forEach((release) => release());

await expectTimeout(Promise.race([
  new Promise((resolve) => setTimeout(() => resolve("late-provider"), 100)),
  new Promise((_, reject) => setTimeout(() => reject(new Error("LOCAL_AI_TIMEOUT")), 10))
]));

if (rejected429 < 1 || controlled503 < 1 || cpuGuard.snapshot().active !== 0 || dbPoolModel.snapshot().active !== 0) {
  throw new Error("Local resilience acceptance did not observe controlled degradation and recovery.");
}

console.log(JSON.stringify({
  suite: "SECURITY-RESILIENCE-1A-LOCAL-ONLY",
  target: "pure-local-adapters",
  hardLimits: { requests: HARD_MAX_REQUESTS, concurrency: HARD_MAX_CONCURRENCY, durationMs: HARD_MAX_DURATION_MS },
  total,
  accepted,
  rejected429,
  controlled503,
  recovered: true,
  operationalDatabaseTouched: false
}, null, 2));
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Local resilience load suite failed.");
  process.exitCode = 1;
});

function assertLocalOnly(value?: string) {
  if (!value) return;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("SECURITY_LOAD_TARGET must be an absolute loopback URL."); }
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("The load suite refuses non-loopback, HTTPS, public, edge, and third-party targets.");
  }
}

function enforceSafety() {
  if (total >= HARD_MAX_REQUESTS) throw new Error("Hard request cap reached.");
  if (Date.now() - started > HARD_MAX_DURATION_MS) throw new Error("Hard duration cap reached.");
}

async function expectCapacityFailure(value: Promise<unknown>) {
  try { await value; } catch (error) { if (error instanceof ResourceGuardError) return; throw error; }
  throw new Error("Expected bounded DB-pool model saturation.");
}

async function expectTimeout(value: Promise<unknown>) {
  try { await value; } catch (error) { if (error instanceof Error && error.message === "LOCAL_AI_TIMEOUT") return; throw error; }
  throw new Error("Expected local AI timeout.");
}
