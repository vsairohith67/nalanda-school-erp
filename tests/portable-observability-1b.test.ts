import { createCertificateRequest } from "../lib/certificate-requests";
import { describe, it, expect, vi } from "vitest";
import { SyntheticTelemetry, validTelemetryInput, telemetryRouteTemplate, observeSchoolOperation, syntheticOtlp, type TelemetryInput } from "../lib/portable-runtime/telemetry";
import { portablePublicConfiguration } from "../lib/portable-runtime/public-configuration";
const event: TelemetryInput = { schemaVersion: 1, count: 1, service: "erp", environment: "synthetic", profile: "local-single-node", routeTemplate: "/api/health/ready", operation: "readiness", statusClass: "5xx", durationBucket: "under_100ms", dependencyState: "unknown", safeCode: "UNKNOWN" };
const create = () => new SyntheticTelemetry({ mode: "LOCAL_ONLY", releaseCommit: "a".repeat(40), now: () => 60_001 });
describe("strict no-network telemetry foundation", () => {
  it("uses validated snapshots against proxy reads and caller mutation", () => {
    const input = { ...event };
    const options = { mode: "LOCAL_ONLY" as const, releaseCommit: "a".repeat(40), now: () => { input.safeCode = "private" as never; return 60_000; } };
    const t = new SyntheticTelemetry(options); options.releaseCommit = "private";
    t.capture(new Proxy(input, { get() { return "private"; } }));
    const captured = t.drainSynthetic(); expect(captured).toHaveLength(1); expect(JSON.stringify(captured)).not.toContain("private");
    expect(() => syntheticOtlp([{ ...captured[0], safeCode: "private" } as never])).toThrow("UNTRUSTED_TELEMETRY_EVENT");
  });
  it("defers capture beyond transaction continuations and preserves synchronous throws", async () => {
    const order: string[] = [];
    const t = new SyntheticTelemetry({ mode: "LOCAL_ONLY", releaseCommit: "a".repeat(40), now: () => { order.push("capture"); return 60_000; } });
    const error = new Error("private"); expect(() => observeSchoolOperation(() => { throw error; }, t)).toThrow(error);
    await observeSchoolOperation(async () => { throw error; }, t).catch(() => { order.push("transaction-continuation"); });
    expect(order).toEqual(["transaction-continuation"]);
    await new Promise<void>(resolve => setImmediate(resolve)); expect(order).toEqual(["transaction-continuation", "capture"]);
  });
  it("rejects unknown, nested, encoded, identity-derived and private values before capture", () => {
    expect(validTelemetryInput(event)).toBe(true);
    for (const privateValue of ["student" + "-private", "someone@" + "private.invalid", "%2Fprivate%3Fkey%3Dx", { nested: "content" }, ["READY"], "a".repeat(64), "READY\nprivate"]) {
      for (const key of Object.keys(event)) expect(validTelemetryInput({ ...event, [key]: privateValue })).toBe(false);
    }
    for (const extra of ["traceId", "spanId", "releaseCommit", "timestamp", "body", "headers", "sql", "safeCodeNested", "__proto__"]) {
      expect(validTelemetryInput({ ...event, [extra]: "private" })).toBe(false);
    }
    expect(validTelemetryInput({ ...event, count: Infinity })).toBe(false);
    expect(validTelemetryInput({ ...event, count: 1.5 })).toBe(false);
    let read = false; const getter = { ...event }; Object.defineProperty(getter, "count", { get() { read = true; return 1; } });
    expect(validTelemetryInput(getter)).toBe(false); expect(read).toBe(false);
    expect(validTelemetryInput(Object.assign(Object.create({ inherited: "private" }), event))).toBe(false);
  });
  it("never guesses dynamic routes or strips just numeric identifiers", () => {
    for (const path of ["/api/health/ready?key=private", "https://private.invalid/api/health/ready", "/students/123", "/students/slug", "/students/%61", "/students/a-b-c", "//private.invalid", "\\private"]) expect(telemetryRouteTemplate(path)).toBe("UNKNOWN_ROUTE");
    expect(telemetryRouteTemplate("/api/health/ready")).toBe("/api/health/ready");
  });
  it("mints fresh correlation, rounds time and produces only in-memory OTLP spans", () => {
    const t = create(); t.capture(event); t.capture(event);
    const items = t.drainSynthetic(); expect(items).toHaveLength(2);
    expect(items[0].timestamp).toBe(60_000); expect(items[0].traceId).toMatch(/^[a-f0-9]{32}$/);
    expect(items[0].traceId).not.toBe(items[1].traceId); expect(items[0].spanId).not.toBe(items[1].spanId);
    expect(syntheticOtlp(items).resourceSpans).toHaveLength(2);
    expect(t.snapshot().bytes).toBe(0);
  });
  it("caps errors and event count/bytes, samples non-errors at 1 percent", () => {
    const t = create(); for (let i = 0; i < 100; i++) t.capture(event);
    expect(t.snapshot().queued).toBe(10); expect(t.snapshot().dropped).toBe(90);
    const sampled = create(); for (let i = 0; i < 100_100; i++) sampled.capture({ ...event, statusClass: "2xx" });
    expect(sampled.snapshot().queued).toBe(1000); expect(sampled.snapshot().dropped).toBe(1);
    expect(sampled.snapshot().bytes).toBeLessThanOrEqual(1024 * 1024);
  });
  it.each(["NONE", "TIMEOUT", "DNS", "CREDENTIALS", "FULL_DISK"] as const)("preserves exact transaction promise/result with %s sink", async fault => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(() => { throw new Error("NETWORK_FORBIDDEN"); });
    try {
      const telemetry = create(); telemetry.setSyntheticFault(fault);
      const ledger = { paise: 0, writes: 0 }; const value = Object.freeze({ posted: true });
      const promise = Promise.resolve(value);
      const transaction = vi.fn(() => { ledger.paise += 12345; ledger.writes++; return promise; });
      expect(observeSchoolOperation(transaction, telemetry)).toBe(promise);
      expect(await promise).toBe(value); expect(ledger).toEqual({ paise: 12345, writes: 1 }); expect(transaction).toHaveBeenCalledTimes(1);
      const error = new Error("private transaction error"); const rejected = Promise.reject(error);
      expect(observeSchoolOperation(() => rejected, telemetry)).toBe(rejected);
      await expect(rejected).rejects.toBe(error); expect(fetchSpy).not.toHaveBeenCalled();
      expect(JSON.stringify(telemetry.drainSynthetic())).not.toContain("private transaction error");
    } finally { fetchSpy.mockRestore(); }
  });
  it("has identical results absent, disabled and saturated; never captures bodies", async () => {
    const disabled = new SyntheticTelemetry({ mode: "PROVIDER_DISABLED", releaseCommit: "b".repeat(40) });
    const saturated = create(); for (let i = 0; i < 100_100; i++) saturated.capture({ ...event, statusClass: "2xx" });
    const outputs = [];
    for (const telemetry of [undefined, disabled, saturated]) {
      let writes = 0; const result = await observeSchoolOperation(async () => { writes++; return { totalPaise: 50000, success: true }; }, telemetry);
      outputs.push({ result, writes });
    }
    expect(outputs[0]).toEqual(outputs[1]); expect(outputs[1]).toEqual(outputs[2]);
    expect(disabled.snapshot()).toMatchObject({ state: "PROVIDER_DISABLED", queued: 0, externalTransmission: false });
  });
  it("strictly projects runtime public settings independently of build values and secrets", () => {
    const env = { PORTABLE_PROFILE: "generic-vps", AUTH_SECRET: "do-not-publish", NEXT_PUBLIC_PWA_BUILD_VERSION: "frozen-build", DATABASE_URL: "do-not-publish" };
    expect(portablePublicConfiguration(env)).toEqual({ schemaVersion: 1, profile: "generic-vps", telemetry: "PROVIDER_DISABLED", externalTelemetry: false, deploymentCertification: "NOT_PERFORMED" });
    expect(() => portablePublicConfiguration({ PORTABLE_PROFILE: "private name" })).toThrow("PUBLIC_RUNTIME_PROFILE_INVALID");
  });
});

// Actual existing school service, with an isolated deterministic persistence adapter.
// No ORM, deployment, operational records or certificate issuance is involved.
describe("school request service remains authoritative with optional telemetry", () => {
  it.each(["absent", "disabled", "local", "TIMEOUT", "DNS", "CREDENTIALS", "FULL_DISK", "saturated"])("preserves linked-child writes and permission denial: %s", async mode => {
    const telemetry = mode === "absent" ? undefined : new SyntheticTelemetry({ mode: mode === "disabled" ? "PROVIDER_DISABLED" : "LOCAL_ONLY", releaseCommit: "a".repeat(40), now: () => 60000 });
    if (["TIMEOUT", "DNS", "CREDENTIALS", "FULL_DISK"].includes(mode)) telemetry!.setSyntheticFault(mode as "TIMEOUT");
    if (mode === "saturated") for (let i = 0; i < 1001; i++) telemetry!.recordSettlement("REJECTED", "5xx");
    const execute = async (observer: typeof telemetry, linked: boolean) => {
      const writes: unknown[] = [];
      const client: any = { studentGuardian: { findUnique: async () => linked ? { id: "synthetic-link" } : null },
        studentCertificateRequest: { create: async ({ data }: any) => { writes.push(structuredClone(data)); return { id: "synthetic-request", ...data }; } },
        studentCertificateEvent: { create: async ({ data }: any) => { writes.push(structuredClone(data)); return {}; } } };
      const result = observeSchoolOperation(() => createCertificateRequest(client,
        { studentId: "synthetic-student", academicYear: "2026-27", certificateType: "STUDY", purpose: "Synthetic test" },
        { id: "synthetic-actor", guardianId: "synthetic-guardian", source: "PARENT_PORTAL" }), observer);
      return { value: await result.then(value => ({ value }), error => ({ status: error.status })), writes };
    };
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-09-05T00:00:00Z"));
    try {
      const baseline = await execute(undefined, true); const observed = await execute(telemetry, true);
      // Generated request numbers are random identifiers; compare all business fields and event count.
      const normalize = (v: unknown) => JSON.parse(JSON.stringify(v), (key, value) => key === "requestNumber" ? "GENERATED" : value);
      expect(normalize(observed)).toEqual(normalize(baseline)); expect(observed.writes).toHaveLength(2);
      expect(await execute(telemetry, false)).toEqual({ value: { status: 403 }, writes: [] });
      await new Promise<void>(resolve => setImmediate(resolve));
      const events = JSON.stringify(telemetry?.drainSynthetic() ?? []);
      for (const privateValue of ["synthetic-student", "synthetic-guardian", "synthetic-actor", "Synthetic test"]) expect(events).not.toContain(privateValue);
    } finally { vi.useRealTimers(); }
  });
});
