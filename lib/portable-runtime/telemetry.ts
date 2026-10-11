import { randomBytes } from "node:crypto";

// No SDK registration, network transport, global instrumentation or raw log adapter.
export const TELEMETRY_VALUES = {
  service: ["erp", "migrator", "jobs"],
  environment: ["synthetic"],
  profile: ["local-single-node", "generic-vps"],
  routeTemplate: ["/api/health/ready", "/technical-operations", "UNKNOWN_ROUTE"],
  operation: ["readiness", "school_transaction", "migration", "backup", "restore", "job"],
  statusClass: ["2xx", "4xx", "5xx", "none"],
  durationBucket: ["under_100ms", "under_1s", "under_10s", "over_10s", "unknown"],
  dependencyState: ["healthy", "disabled", "unavailable", "unknown"],
  safeCode: ["READY", "COMPLETED", "REJECTED", "UNAVAILABLE", "UNKNOWN"]
} as const;
for (const values of Object.values(TELEMETRY_VALUES)) Object.freeze(values);
Object.freeze(TELEMETRY_VALUES);
type Values = typeof TELEMETRY_VALUES;
export type TelemetryInput = { [K in keyof Values]: Values[K][number] } & { schemaVersion: 1; count: number };
export type TelemetryEvent = Readonly<TelemetryInput & { timestamp: number; releaseCommit: string; traceId: string; spanId: string }>;
export type TelemetryHealth = "PROVIDER_DISABLED" | "LOCAL_ONLY" | "DEGRADED";
export type SyntheticSinkFault = "NONE" | "TIMEOUT" | "DNS" | "CREDENTIALS" | "FULL_DISK";
const fields = ["schemaVersion", "count", ...Object.keys(TELEMETRY_VALUES)];
const mintedEvents = new WeakSet<object>();
const mintedBatches = new WeakSet<object>();

function canonicalTelemetryInput(raw: unknown): TelemetryInput | null {
  try {
    if (!raw || typeof raw !== "object" || Object.getPrototypeOf(raw) !== Object.prototype) return null;
    const descriptors = Object.getOwnPropertyDescriptors(raw);
    if (Reflect.ownKeys(raw).length !== fields.length || fields.some(k => !descriptors[k] || !("value" in descriptors[k]))) return null;
    if (descriptors.schemaVersion.value !== 1 || !Number.isSafeInteger(descriptors.count.value) || descriptors.count.value < 0 || descriptors.count.value > 1000) return null;
    if (!Object.entries(TELEMETRY_VALUES).every(([key, allowed]) => (allowed as readonly unknown[]).includes(descriptors[key].value))) return null;
    return Object.freeze(Object.fromEntries(fields.map(key => [key, descriptors[key].value]))) as TelemetryInput;
  } catch { return null; }
}
export function validTelemetryInput(raw: unknown): raw is TelemetryInput { return canonicalTelemetryInput(raw) !== null; }

// Only exact server-owned templates survive. Never parse or echo request URLs.
export function telemetryRouteTemplate(value: unknown): TelemetryInput["routeTemplate"] {
  return value === "/api/health/ready" || value === "/technical-operations" ? value : "UNKNOWN_ROUTE";
}

export interface OptionalProviderSink {
  readonly state: "PROVIDER_DISABLED";
  offer(event: unknown): "PROVIDER_DISABLED";
}
// Disabled sinks neither retain nor inspect arbitrary event payloads.
const disabledSink: OptionalProviderSink = Object.freeze({ state: "PROVIDER_DISABLED", offer: (_event: unknown) => "PROVIDER_DISABLED" as const });
export const DISABLED_PROVIDER_INTERFACES = Object.freeze({
  sentry: Object.freeze({ ...disabledSink, replay: false, capture: false }),
  posthog: Object.freeze({ ...disabledSink, replay: false, autocapture: false, permissionsAuthority: false, featureFlagsAuthority: false }),
  openTelemetry: Object.freeze({ ...disabledSink, exporter: "PROVIDER_DISABLED", externalTransmission: false })
});

export class SyntheticTelemetry {
  private readonly queue: TelemetryEvent[] = [];
  private bytes = 0;
  private dropped = 0;
  private rejected = 0;
  private fault: SyntheticSinkFault = "NONE";
  private minute = -1;
  private errorsInMinute = 0;
  private sequence = 0;
  private pending = 0;
  private readonly options: Readonly<{ mode: "PROVIDER_DISABLED" | "LOCAL_ONLY"; releaseCommit: string; now?: () => number }>;
  constructor(options: { mode: "PROVIDER_DISABLED" | "LOCAL_ONLY"; releaseCommit: string; now?: () => number }) {
    const d = Object.getOwnPropertyDescriptors(options);
    const mode = d.mode?.value; const releaseCommit = d.releaseCommit?.value; const now = d.now?.value;
    if (typeof releaseCommit !== "string" || !/^[a-f0-9]{40}$/.test(releaseCommit) || (mode !== "PROVIDER_DISABLED" && mode !== "LOCAL_ONLY") || (d.now && typeof now !== "function")) throw new Error("TELEMETRY_CONFIGURATION_INVALID");
    this.options = Object.freeze({ mode, releaseCommit, now });
  }
  // Fault injection is an enum, not an arbitrary exporter callback on a transaction.
  setSyntheticFault(fault: SyntheticSinkFault) { this.fault = ["NONE", "TIMEOUT", "DNS", "CREDENTIALS", "FULL_DISK"].includes(fault) ? fault : "CREDENTIALS"; }
  capture(raw: unknown): void {
    try {
      if (this.options.mode === "PROVIDER_DISABLED") return;
      const safe = canonicalTelemetryInput(raw);
      if (!safe) { this.rejected = Math.min(1_000_000, this.rejected + 1); return; }
      const now = Math.floor((this.options.now?.() ?? Date.now()) / 60_000) * 60_000;
      if (!Number.isSafeInteger(now) || now < 0) { this.rejected++; return; }
      if (this.minute !== now) { this.minute = now; this.errorsInMinute = 0; }
      if (safe.statusClass === "5xx") {
        if (++this.errorsInMinute > 10) { this.drop(); return; }
      } else if (++this.sequence % 100 !== 0) return; // bounded 1% synthetic sampling
      if (this.fault !== "NONE" || this.queue.length >= 1000) { this.drop(); return; }
      const event = Object.freeze({ ...safe, timestamp: now, releaseCommit: this.options.releaseCommit,
        traceId: randomBytes(16).toString("hex"), spanId: randomBytes(8).toString("hex") });
      const size = Buffer.byteLength(JSON.stringify(event));
      if (size > 2048 || this.bytes + size > 1024 * 1024) { this.drop(); return; }
      mintedEvents.add(event); this.queue.push(event); this.bytes += size;
    } catch { this.drop(); }
  }
  private drop() { this.dropped = Math.min(1_000_000, this.dropped + 1); }
  recordSettlement(safeCode: "COMPLETED" | "REJECTED", statusClass: "2xx" | "5xx") {
    if (this.options.mode === "PROVIDER_DISABLED") return;
    if (this.pending >= 1000) { this.drop(); return; }
    this.pending++;
    setImmediate(() => {
      this.pending--;
      this.capture({ schemaVersion: 1, count: 1, service: "erp", environment: "synthetic", profile: "local-single-node",
        routeTemplate: "UNKNOWN_ROUTE", operation: "school_transaction", statusClass, durationBucket: "unknown", dependencyState: "unknown", safeCode });
    }).unref();
  }
  snapshot() { return Object.freeze({ state: (this.options.mode === "PROVIDER_DISABLED" ? "PROVIDER_DISABLED" : this.dropped || this.rejected || this.fault !== "NONE" ? "DEGRADED" : "LOCAL_ONLY") as TelemetryHealth,
    queued: this.queue.length, bytes: this.bytes, dropped: this.dropped, rejected: this.rejected, externalTransmission: false as const }); }
  drainSynthetic() { const events = Object.freeze(this.queue.splice(0)); mintedBatches.add(events); this.bytes = 0; return events; }
}

// OTLP JSON span projection is possible only from a validated, internally minted event.
// It is data in memory. There is deliberately no send/export method.
export function syntheticOtlp(events: readonly TelemetryEvent[]) {
  if (!mintedBatches.has(events)) throw new Error("UNTRUSTED_TELEMETRY_EVENT");
  return { resourceSpans: events.map(event => ({ resource: { attributes: [{ key: "service.name", value: { stringValue: event.service } }] },
    scopeSpans: [{ scope: { name: "nalanda.safe-telemetry", version: "1" }, spans: [{
      traceId: event.traceId, spanId: event.spanId, name: event.operation, kind: 1,
      startTimeUnixNano: `${event.timestamp}000000`, endTimeUnixNano: `${event.timestamp}000000`,
      attributes: [{ key: "http.route", value: { stringValue: event.routeTemplate } }, { key: "nalanda.safe_code", value: { stringValue: event.safeCode } }]
    }] }] })) };
}

/** Preserve the exact promise, settled value/error and single invocation. No exporter waits. */
export function observeSchoolOperation<T>(operation: () => Promise<T>, telemetry?: SyntheticTelemetry): Promise<T> {
  const result = operation();
  if (telemetry) void result.then(() => settled("COMPLETED", "2xx"), () => settled("REJECTED", "5xx"));
  function settled(safeCode: "COMPLETED" | "REJECTED", statusClass: "2xx" | "5xx") {
    try { telemetry?.recordSettlement(safeCode, statusClass); } catch { /* Observation cannot change the transaction. */ }
  }
  return result;
}
