"use client";

import type { TelemetryHealth } from "@/lib/portable-runtime/telemetry";

export function TechnicalTelemetryPanel({ full, state = "PROVIDER_DISABLED" }: { full: boolean; state?: TelemetryHealth }) {
  return <section className="card card-pad" aria-labelledby="telemetry-title">
    <h2 id="telemetry-title">Optional diagnostics</h2>
    <p role="status">{state === "DEGRADED" ? "Diagnostics are degraded. School operations keep their own status." : state === "LOCAL_ONLY" ? "Synthetic diagnostics stay in memory." : "External diagnostics are disabled."}</p>
    <p>Technical Operations remains authoritative for school health, incidents and maintenance.</p>
    {full ? <details><summary>Diagnostic boundaries</summary>
      <p>OpenTelemetry export, Sentry and PostHog are disabled. No session replay or automatic activity capture is active.</p>
      <p>Diagnostic loss never retries or reverses a school transaction. School actions do not wait for an exporter. Review school health and recovery through the existing governed controls.</p>
      <button disabled type="button">Provider activation requires a separate owner gate</button>
    </details> : <p>Detailed infrastructure diagnostics require technical access.</p>}
  </section>;
}
