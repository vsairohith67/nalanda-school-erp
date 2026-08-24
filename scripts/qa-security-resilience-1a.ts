import { existsSync, readFileSync } from "node:fs";

const required = [
  "docs/security/DDOS_AND_RESOURCE_EXHAUSTION_RUNBOOK.md",
  "docs/security/ACCOUNT_TAKEOVER_RUNBOOK.md",
  "docs/security/ORIGIN_EXPOSURE_RUNBOOK.md",
  "docs/security/SECURITY_INCIDENT_RECOVERY.md",
  "docs/security/ORIGIN_HIDING_AND_EDGE_BLUEPRINT.md",
  "docs/security/SECURITY_RESILIENCE_ARCHITECTURE.md",
  "deploy/security-resilience/edge-policy.example.yml"
];
for (const path of required) if (!existsSync(path)) throw new Error(`Missing required security resilience artifact: ${path}`);

const middleware = readFileSync("middleware.ts", "utf8");
const policies = readFileSync("lib/security-resilience.ts", "utf8");
const trustedClient = readFileSync("lib/trusted-client.ts", "utf8");
for (const marker of ["auth.login", "auth.recovery", "public.admissions", "public.support", "upload", "real-data-import", "bulk-export", "pdf-generation", "event-media", "universal-search", "smart-ai", "sync"]) {
  if (!policies.includes(marker)) throw new Error(`Missing centrally governed policy: ${marker}`);
}
if (!middleware.includes("enforceOperationRateLimit") || !policies.includes("RATE_LIMIT_STORE_UNAVAILABLE") || !middleware.includes("EDGE_ORIGIN_MISMATCH")) throw new Error("Middleware does not fail closed for abuse-store or ingress-boundary failure.");
if (!trustedClient.includes("authenticated-edge-v1") || trustedClient.includes("split(\",\", 1)")) throw new Error("Trusted client identity must require authenticated single-value edge identity.");

console.log("SECURITY-RESILIENCE-1A independent source acceptance passed (no database access, no deployment, no external target).\n");
