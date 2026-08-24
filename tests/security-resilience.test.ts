import { readFileSync } from "node:fs";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../middleware";
import {
  assertBoundedJsonValue,
  requestJsonBudgetIssue,
  requestQueryBudgetIssue,
  unsafeRequestOriginAllowed
} from "../lib/request-security";
import {
  createDeterministicRateLimitStore,
  enforceOperationRateLimit,
  operationPolicy,
  RATE_LIMIT_POLICIES,
  resetSecurityRateLimitStoresForTests
} from "../lib/security-resilience";
import {
  BoundedSemaphore,
  ResourceGuardError,
  resetResourceGuardsForTests,
  withCircuitBreaker
} from "../lib/resource-guard";
import { trustedClientIdentity } from "../lib/trusted-client";

describe("SECURITY-RESILIENCE-1A governed controls", () => {
  it("uses endpoint-specific policy instead of one arbitrary global threshold", () => {
    expect(operationPolicy("/api/auth/login", "POST")?.id).toBe("auth.login");
    expect(operationPolicy("/api/public/support/requests", "POST")?.id).toBe("public.support");
    expect(operationPolicy("/api/super-admin/search", "POST")?.id).toBe("universal-search");
    expect(operationPolicy("/api/report-cards/pdf-jobs", "POST")?.cost).toBe("HIGH");
    expect(operationPolicy("/api/health", "GET")).toBeNull();
    expect(new Set(RATE_LIMIT_POLICIES.map((policy) => `${policy.maximum}:${policy.windowMs}`)).size).toBeGreaterThan(5);
  });

  it("keeps actor budgets isolated instead of creating a tiny global endpoint bucket", async () => {
    const store = createDeterministicRateLimitStore();
    for (let index = 0; index < 30; index += 1) {
      expect((await enforceOperationRateLimit("/api/auth/login", "POST", { ip: "192.0.2.10" }, { store, now: index })).allowed).toBe(true);
    }
    expect((await enforceOperationRateLimit("/api/auth/login", "POST", { ip: "192.0.2.10" }, { store, now: 31 })).status).toBe(429);
    expect((await enforceOperationRateLimit("/api/auth/login", "POST", { ip: "192.0.2.11" }, { store, now: 31 })).allowed).toBe(true);
  });

  it("provides a deterministic bounded adapter and controlled Retry-After", async () => {
    const store = createDeterministicRateLimitStore(100);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await enforceOperationRateLimit("/api/auth/recovery/request", "POST", { ip: "192.0.2.10", account: "user-1" }, { store, now: attempt })).allowed).toBe(true);
    }
    const blocked = await enforceOperationRateLimit("/api/auth/recovery/request", "POST", { ip: "192.0.2.10", account: "user-1" }, { store, now: 5 });
    expect(blocked).toMatchObject({ allowed: false, status: 429, code: "RATE_LIMITED" });
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed in production when no distributed store is registered", async () => {
    resetSecurityRateLimitStoresForTests();
    await expect(enforceOperationRateLimit("/api/super-admin/ai", "POST", { session: "session-1" }, { environment: { NODE_ENV: "production" } }))
      .resolves.toMatchObject({ allowed: false, status: 503, code: "RATE_LIMIT_STORE_UNAVAILABLE" });
  });

  it("normalizes failed or malformed distributed-store decisions to controlled 503", async () => {
    const unavailableStore = {
      kind: "distributed" as const,
      distributed: true,
      async consume() { throw new Error("synthetic store outage"); }
    };
    const malformedStore = {
      kind: "distributed" as const,
      distributed: true,
      async consume() { return { allowed: true, retryAfterSeconds: -1 }; }
    };
    for (const store of [unavailableStore, malformedStore]) {
      await expect(enforceOperationRateLimit("/api/public/support/requests", "POST", { ip: "192.0.2.20" }, { store }))
        .resolves.toMatchObject({ allowed: false, status: 503, code: "RATE_LIMIT_STORE_UNAVAILABLE", retryAfterSeconds: 30 });
    }
  });

  it("permits the single-process adapter only for an explicit isolated loopback production-mode rehearsal", async () => {
    resetSecurityRateLimitStoresForTests();
    await expect(enforceOperationRateLimit("/api/auth/login", "POST", {}, { environment: {
      NODE_ENV: "production",
      APP_ORIGIN: "http://127.0.0.1:3011",
      NALANDA_LOCAL_SECURITY_REHEARSAL: "true",
      QA20C_ISOLATED_DATABASE: "true",
      SECURITY_RATE_LIMIT_MODE: "single-process-rehearsal"
    } })).resolves.toMatchObject({ allowed: true, status: 200 });
  });

  it("rejects spoofed proxy headers and accepts only exact authenticated IPv4 or IPv6 edge identity", () => {
    const secret = "synthetic-proxy-proof-with-at-least-thirty-two-characters";
    const environment = {
      TRUST_PROXY_HEADERS: "true",
      NALANDA_TRUSTED_PROXY_MODE: "authenticated-edge-v1",
      NALANDA_PROXY_SHARED_SECRET: secret,
      NALANDA_CLIENT_IP_HEADER: "x-forwarded-for",
      APP_ORIGIN: "https://staging.example.test"
    };
    const headers = (ip: string, proof = secret) => new Headers({
      "x-forwarded-for": ip,
      "x-forwarded-host": "staging.example.test",
      "x-forwarded-proto": "https",
      "x-nalanda-proxy-auth": proof
    });
    expect(trustedClientIdentity(headers("203.0.113.8"), environment)).toMatchObject({ trusted: true, source: "203.0.113.8" });
    expect(trustedClientIdentity(headers("2001:db8::8"), environment)).toMatchObject({ trusted: true, source: "2001:db8::8" });
    expect(trustedClientIdentity(headers("203.0.113.8, 198.51.100.1"), environment)).toMatchObject({ trusted: false, boundaryMismatch: true });
    expect(trustedClientIdentity(headers("203.0.113.8", "attacker-value"), environment)).toMatchObject({ trusted: false, source: "direct" });
    expect(trustedClientIdentity(new Headers({ "cf-connecting-ip": "203.0.113.9" }), environment)).toMatchObject({ trusted: false, source: "direct" });
  });

  it("bounds JSON structure, pagination, and date ranges server-side", () => {
    expect(() => assertBoundedJsonValue({ rows: Array.from({ length: 2_001 }, () => 1) })).toThrow("JSON_ARRAY_LIMIT_EXCEEDED");
    expect(() => assertBoundedJsonValue({ value: "x".repeat(20_001) })).toThrow("JSON_STRING_LIMIT_EXCEEDED");
    expect(requestQueryBudgetIssue(new URL("https://example.test/api/students?pageSize=251"))).toContain("Pagination");
    expect(requestQueryBudgetIssue(new URL("https://example.test/api/reports?from=2024-01-01&to=2026-01-02"))).toContain("Date range");
    expect(requestQueryBudgetIssue(new URL("https://example.test/api/reports?pageSize=100&from=2026-01-01&to=2026-03-01"))).toBeNull();
  });

  it("rejects oversized import arrays even when the byte body is otherwise valid", async () => {
    const base = new Request("https://erp.example.test/api/import/students", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rows: Array.from({ length: 2_001 }, (_, index) => ({ index })) })
    });
    const request = Object.assign(base, { nextUrl: new URL(base.url) });
    await expect(requestJsonBudgetIssue(request as never)).resolves.toContain("complexity");
  });

  it("uses bounded concurrency and queue wait rather than unbounded work", async () => {
    const semaphore = new BoundedSemaphore(1, 1, 100);
    const first = await semaphore.acquire();
    const secondPromise = semaphore.acquire();
    await expect(semaphore.acquire()).rejects.toMatchObject({ code: "CAPACITY_EXHAUSTED", status: 503 });
    first();
    const second = await secondPromise;
    second();
    expect(semaphore.snapshot()).toEqual({ active: 0, queued: 0 });
  });

  it("opens the provider circuit after bounded failures and recovers after cooldown", async () => {
    resetResourceGuardsForTests();
    let now = 1_000;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expect(withCircuitBreaker("synthetic-provider", async () => { throw new Error("synthetic failure"); }, { now: () => now, cooldownMs: 1_000 }))
        .rejects.toThrow("synthetic failure");
    }
    await expect(withCircuitBreaker("synthetic-provider", async () => "unexpected", { now: () => now, cooldownMs: 1_000 }))
      .rejects.toBeInstanceOf(ResourceGuardError);
    now += 1_001;
    await expect(withCircuitBreaker("synthetic-provider", async () => "recovered", { now: () => now, cooldownMs: 1_000 })).resolves.toBe("recovered");
  });

  it("fails closed when browser mutation origin evidence is absent, except signed-provider routes", () => {
    const request = (pathname: string) => ({ method: "POST", headers: new Headers(), nextUrl: new URL(`https://erp.example.test${pathname}`) });
    expect(unsafeRequestOriginAllowed(request("/api/auth/logout") as never, "https://erp.example.test")).toBe(false);
    expect(unsafeRequestOriginAllowed(request("/api/whatsapp/webhook/test") as never, "https://erp.example.test")).toBe(true);
  });

  it("rejects an untrusted direct-origin request before reading its body stream", async () => {
    const names = ["TRUST_PROXY_HEADERS", "NALANDA_TRUSTED_PROXY_MODE", "NALANDA_PROXY_SHARED_SECRET", "NALANDA_REQUIRE_TRUSTED_PROXY", "APP_ORIGIN"] as const;
    const prior = Object.fromEntries(names.map((name) => [name, process.env[name]]));
    Object.assign(process.env, {
      TRUST_PROXY_HEADERS: "true",
      NALANDA_TRUSTED_PROXY_MODE: "authenticated-edge-v1",
      NALANDA_PROXY_SHARED_SECRET: "synthetic-proof-at-least-thirty-two-characters",
      NALANDA_REQUIRE_TRUSTED_PROXY: "true",
      APP_ORIGIN: "https://staging.example.test"
    });
    try {
      const body = new ReadableStream<Uint8Array>({ pull(controller) { controller.error(new Error("BODY_MUST_NOT_BE_READ")); } });
      const requestInit = {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        duplex: "half"
      } as unknown as ConstructorParameters<typeof NextRequest>[1];
      const request = new NextRequest("https://staging.example.test/api/public/support/requests", requestInit);
      await expect(middleware(request)).resolves.toMatchObject({ status: 403 });
    } finally {
      for (const name of names) {
        if (prior[name] === undefined) delete process.env[name];
        else process.env[name] = prior[name];
      }
    }
  });

  it("wires governed controls to every named expensive family and preserves health", () => {
    const middleware = readFileSync("middleware.ts", "utf8");
    const pdf = readFileSync("lib/report-pdf-jobs.ts", "utf8");
    const smartAi = readFileSync("app/api/super-admin/ai/route.ts", "utf8");
    const search = readFileSync("app/api/super-admin/search/route.ts", "utf8");
    const eventMedia = readFileSync("app/api/event-media/albums/[albumKey]/assets/route.ts", "utf8");
    const publicSupportUi = readFileSync("components/public-support-form.tsx", "utf8");
    const publicAdmissionsUi = readFileSync("components/admissions-public-enquiry-form.tsx", "utf8");
    const loginUi = readFileSync("components/login-form.tsx", "utf8");
    const runtimeHarness = readFileSync("scripts/sec1-runtime-server.ps1", "utf8");
    const releaseWorkflow = readFileSync(".github/workflows/release-rehearsal.yml", "utf8");
    expect(middleware).toContain("enforceOperationRateLimit");
    expect(middleware).toContain("proxyHealthPath");
    expect(middleware).toContain('"/api/health"');
    expect(middleware.indexOf("trustedClientIdentity(request.headers)")).toBeLessThan(middleware.indexOf("requestBodyTooLarge(request)"));
    expect(middleware.indexOf("enforceOperationRateLimit(pathname")).toBeLessThan(middleware.indexOf("requestBodyTooLarge(request)"));
    expect(pdf).toContain("MAX_QUEUED_REPORT_PDF_JOBS");
    expect(smartAi).toContain('withOperationCapacity("SMART_AI"');
    expect(search).toContain('withOperationCapacity("UNIVERSAL_SEARCH"');
    expect(eventMedia).toContain('withOperationCapacity("EVENT_MEDIA_IMAGE"');
    expect(publicSupportUi).toContain("if (!response.ok)");
    expect(publicSupportUi).toContain("submissionKeyRef.current ??=");
    expect(publicSupportUi).toContain("We could not confirm that your support request was received.");
    expect(publicSupportUi).not.toContain("reference: `NPS-SUP-${crypto.randomUUID()");
    expect(publicSupportUi).toContain("Too many support requests. Please wait before trying again.");
    expect(publicAdmissionsUi).toContain("if (!response.ok)");
    expect(publicAdmissionsUi).toContain("requestKeyRef.current ??=");
    expect(publicAdmissionsUi).toContain("Too many admissions enquiries. Please wait before trying again.");
    expect(publicAdmissionsUi).toContain("We could not confirm that your enquiry was received.");
    expect(loginUi).toContain("Too many sign-in attempts. Please wait before trying again.");
    expect(loginUi).toContain("Sign-in protection is temporarily unavailable. Please retry shortly.");
    expect(runtimeHarness).toContain('[ValidateSet("single-process-rehearsal", "distributed")]');
    expect(runtimeHarness).toContain('$env:SECURITY_RATE_LIMIT_MODE = $RateLimitMode');
    expect(runtimeHarness).toContain('$env:QA20C_ISOLATED_DATABASE = "true"');
    expect(releaseWorkflow).toContain("runs-on: windows-latest");
    expect(releaseWorkflow).toContain("choco install ripgrep poppler -y --no-progress");
    expect(releaseWorkflow).toContain("Copy-Item -LiteralPath prisma\\tmp\\release-ci\\synthetic.db -Destination prisma\\dev.db");
  });
});
