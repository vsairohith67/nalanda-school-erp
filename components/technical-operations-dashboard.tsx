"use client";

import { useState } from "react";
import { PageHeader, StatusBadge } from "@/components/ui";
import { TechnicalTelemetryPanel } from "@/components/technical-telemetry-panel";
import type { TechnicalOperationsDashboard as Dashboard, OperationalStatus } from "@/lib/technical-operations-types";

type Permissions = { full: boolean; runChecks: boolean; manageAlerts: boolean; manageIncidents: boolean; manageMaintenance: boolean; manageClientPolicy: boolean };
type AlertRow = { publicKey: string; domain: string; severity: string; status: string; titleSafe: string; evidenceSummarySafe: string; runbookPath: string; occurrenceCount: number; lastSeenAt: string; version: number };
type IncidentRow = { publicKey: string; incidentNumber: string; severity: string; status: string; titleSafe: string; summarySafe: string; updatedAt: string; version: number };
type MaintenanceRow = { publicKey: string; domain: string; status: string; reasonSafe: string; expectedImpactSafe: string; plannedStartAt: string; plannedEndAt: string; version: number };

export function TechnicalOperationsDashboard({ dashboard, permissions, runtimeConfiguration }: { dashboard: Dashboard; permissions: Permissions; runtimeConfiguration?: { telemetry: "PROVIDER_DISABLED" | "DEGRADED" | "LOCAL_ONLY" } }) {
  const alerts = dashboard.alerts as unknown as AlertRow[];
  const incidents = dashboard.incidents as unknown as IncidentRow[];
  const maintenance = dashboard.maintenanceWindows as unknown as MaintenanceRow[];
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(url: string, body: Record<string, unknown>) {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(String(result.error ?? "The action failed safely."));
      setMessage("Action recorded. Refreshing current technical state.");
      window.setTimeout(() => window.location.reload(), 500);
    } catch (error) { setMessage(error instanceof Error ? error.message : "The action failed safely."); setBusy(false); }
  }

  return (
    <main className="page technical-operations-page">
      <PageHeader title="Technical Operations" description={dashboard.summaryOnly ? "Concise operational summary for authorised leadership." : "Provider-neutral health, recovery, security, jobs, release, alerts and incidents for the owned Super Admin."} />
      <p className="muted-text">Checked {formatDate(dashboard.generatedAt)}. This view is private, no-store and excludes secrets, raw paths, private payloads, full IP addresses and school-user identities.</p>
      {message ? <div className="card card-pad ops-live-message" role="status" aria-live="polite">{message}</div> : null}

      <section className="ops-conclusions" aria-label="Operational conclusions">
        <Conclusion title="Core application" status={dashboard.conclusions.coreApplication} />
        <Conclusion title="Operational readiness" status={dashboard.conclusions.operationalReadiness} />
        <Conclusion title="Deployment readiness" status={dashboard.conclusions.deploymentReadiness} />
        <Conclusion title="Optional providers" status={dashboard.conclusions.optionalProviders} />
      </section>
      <TechnicalTelemetryPanel full={permissions.full && !dashboard.summaryOnly} state={runtimeConfiguration?.telemetry ?? "PROVIDER_DISABLED"} />
      <section className="card card-pad ops-explanation" aria-labelledby="ops-separation-title">
        <h2 id="ops-separation-title">Why these statuses differ</h2>
        <p>{dashboard.conclusions.explanation}</p>
      </section>

      {permissions.runChecks ? (
        <section className="card card-pad">
          <div className="section-title inline-section-title"><div><h2>Governed manual check</h2><p>Runs bounded SQLite and count-only business checks. It never repairs records or changes providers.</p></div></div>
          <button disabled={busy} onClick={() => void send("/api/technical-operations/checks", { confirmation: "RUN GOVERNED DEEP CHECKS" })}>Run governed deep checks</button>
        </section>
      ) : null}

      <section aria-labelledby="ops-domains-title">
        <h2 id="ops-domains-title">Health domains</h2>
        <div className="ops-domain-grid">
          {dashboard.domains.map((card) => <article className="card card-pad ops-domain-card" key={card.domain}>
            <div className="section-title inline-section-title"><div><h3>{card.label}</h3><p>{card.lastCheckedAt ? `Checked ${formatDate(card.lastCheckedAt)}` : "No stored check yet"}</p></div><StatusBadge status={statusLabel(card.status)} /></div>
            <p>{card.explanation}</p>
            {card.metrics.length ? <dl className="ops-metrics">{card.metrics.map((metric) => <div key={metric.label}><dt>{metric.label}</dt><dd>{metric.value}{metric.status ? <span className={`ops-dot ${metric.status.toLowerCase()}`} aria-label={statusLabel(metric.status)} /> : null}</dd></div>)}</dl> : null}
            <p className="muted-text"><strong>Action:</strong> {card.action}</p>
            <a className="button secondary" href={card.runbookPath}>Open runbook</a>
          </article>)}
        </div>
      </section>

      <section className="card card-pad" aria-labelledby="ops-adoption-title">
        <h2 id="ops-adoption-title">Account adoption and security activity</h2>
        <p>This aggregate supports access safety and rollout readiness. It is not employee performance and does not track page clicks, reading time or rankings.</p>
        <dl className="ops-metrics ops-metrics-wide">
          <Metric label="Active sessions" value={dashboard.adoption.activeSessions} />
          <Metric label="Unique users in 24 hours" value={dashboard.adoption.uniqueUsers24h} />
          <Metric label="Unique users in 7 days" value={dashboard.adoption.uniqueUsers7d} />
          <Metric label="Never logged in" value={dashboard.adoption.neverLoggedIn} />
          <Metric label="Disabled or pending" value={dashboard.adoption.disabledOrPending} />
        </dl>
        {permissions.full && dashboard.adoption.roleGroups.length ? <div className="table-wrap"><table><thead><tr><th>Role group</th><th>Active sessions</th><th>Users in 7 days</th></tr></thead><tbody>{dashboard.adoption.roleGroups.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.activeSessions}</td><td>{row.users7d}</td></tr>)}</tbody></table></div> : null}
      </section>

      {permissions.full ? <>
        <section className="card card-pad" aria-labelledby="ops-release-title"><h2 id="ops-release-title">Release and client versions</h2><dl className="ops-metrics ops-metrics-wide">
          <Metric label="Server release" value={dashboard.release.serverVersion} /><Metric label="Git commit" value={shortValue(dashboard.release.gitCommit)} /><Metric label="Build ID" value={dashboard.release.buildId} /><Metric label="Migration" value={dashboard.release.migrationVersion} /><Metric label="Migration count" value={dashboard.release.migrationCount} /><Metric label="Backup format" value={dashboard.release.backupVersion} /><Metric label="PWA build" value={dashboard.release.pwaBuildId} /><Metric label="Client state" value={dashboard.release.clientState.replaceAll("_", " ")} />
        </dl>{permissions.manageClientPolicy ? <ClientPolicyForm release={dashboard.release} busy={busy} send={send} /> : null}</section>

        <section className="card card-pad" aria-labelledby="ops-providers-title"><h2 id="ops-providers-title">Provider configuration</h2><p>Rendering this table does not make external network calls or activate providers.</p><div className="table-wrap"><table><thead><tr><th>Category</th><th>State</th><th>Environment</th><th>Configuration</th><th>Safe result</th></tr></thead><tbody>{dashboard.providers.map((row) => <tr key={row.category}><td>{row.category}</td><td><StatusBadge status={row.state.replaceAll("_", " ")} /></td><td>{row.environment}</td><td>{row.configurationComplete ? "Complete" : "Not configured"}</td><td>{row.explanation}</td></tr>)}</tbody></table></div></section>

        <section className="card card-pad" aria-labelledby="ops-alerts-title"><h2 id="ops-alerts-title">Open alerts</h2>{alerts.length ? <div className="table-wrap"><table><thead><tr><th>Alert</th><th>State</th><th>Occurrences</th><th>Last seen</th><th>Action</th></tr></thead><tbody>{alerts.map((row) => <tr key={row.publicKey}><td><strong>{row.titleSafe}</strong><br/><span className="muted-text">{row.evidenceSummarySafe}</span></td><td><StatusBadge status={row.severity} /> <span>{row.status.toLowerCase()}</span></td><td>{row.occurrenceCount}</td><td>{formatDate(row.lastSeenAt)}</td><td>{permissions.manageAlerts ? <AlertAction row={row} busy={busy} send={send} /> : <a href={row.runbookPath}>Runbook</a>}</td></tr>)}</tbody></table></div> : <p>No open operational alerts.</p>}</section>

        <section className="card card-pad" aria-labelledby="ops-incidents-title"><h2 id="ops-incidents-title">Open incidents</h2>{incidents.length ? <div className="table-wrap"><table><thead><tr><th>Incident</th><th>State</th><th>Updated</th><th>Action</th></tr></thead><tbody>{incidents.map((row) => <tr key={row.publicKey}><td><strong>{row.incidentNumber} · {row.titleSafe}</strong><br/><span className="muted-text">{row.summarySafe}</span></td><td><StatusBadge status={row.severity} /> {row.status.toLowerCase()}</td><td>{formatDate(row.updatedAt)}</td><td>{permissions.manageIncidents ? <IncidentAction row={row} busy={busy} send={send} /> : "Restricted"}</td></tr>)}</tbody></table></div> : <p>No open operational incidents.</p>}{permissions.manageIncidents ? <IncidentForm alerts={alerts} busy={busy} send={send} /> : null}</section>

        <section className="card card-pad" aria-labelledby="ops-maintenance-title"><h2 id="ops-maintenance-title">Maintenance windows</h2>{maintenance.length ? <div className="table-wrap"><table><thead><tr><th>Domain</th><th>State</th><th>Window</th><th>Impact</th><th>Action</th></tr></thead><tbody>{maintenance.map((row) => <tr key={row.publicKey}><td>{friendlyCode(row.domain)}</td><td>{row.status.toLowerCase()}</td><td>{formatDate(row.plannedStartAt)} – {formatDate(row.plannedEndAt)}</td><td>{row.expectedImpactSafe}</td><td>{permissions.manageMaintenance ? <MaintenanceAction row={row} busy={busy} send={send} /> : "Restricted"}</td></tr>)}</tbody></table></div> : <p>No current maintenance window.</p>}{permissions.manageMaintenance ? <MaintenanceForm busy={busy} send={send} /> : null}</section>
      </> : <section className="card card-pad"><h2>Leadership summary boundary</h2><p>Technical evidence, provider detail, manual checks, alert actions, incidents and maintenance controls require separate exact permissions.</p></section>}
    </main>
  );
}

function Conclusion({ title, status }: { title: string; status: OperationalStatus }) { return <article className="card card-pad"><span>{title}</span><strong>{statusLabel(status)}</strong><StatusBadge status={statusLabel(status)} /></article>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }

function AlertAction({ row, busy, send }: { row: AlertRow; busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [action, setAction] = useState("ACKNOWLEDGE"); const [reason, setReason] = useState(""); const [silencedUntil, setSilencedUntil] = useState("");
  return <div className="ops-inline-action"><select aria-label={`Action for ${row.titleSafe}`} value={action} onChange={(event) => setAction(event.target.value)}><option>ACKNOWLEDGE</option><option>INVESTIGATE</option><option>SILENCE</option><option>RESOLVE</option><option>CLOSE</option></select>{["SILENCE", "RESOLVE", "CLOSE"].includes(action) ? <input aria-label="Privacy-safe reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Privacy-safe reason" /> : null}{action === "SILENCE" ? <input aria-label="Silence expires" type="datetime-local" value={silencedUntil} onChange={(event) => setSilencedUntil(event.target.value)} /> : null}<button disabled={busy} onClick={() => void send(`/api/technical-operations/alerts/${row.publicKey}/workflow`, { action, reason, silencedUntil: silencedUntil ? new Date(silencedUntil).toISOString() : undefined, expectedVersion: row.version })}>Apply</button></div>;
}

function IncidentAction({ row, busy, send }: { row: IncidentRow; busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [action, setAction] = useState("INVESTIGATE"); const [note, setNote] = useState(""); const [post, setPost] = useState("");
  return <div className="ops-inline-action"><select aria-label={`Action for ${row.incidentNumber}`} value={action} onChange={(event) => setAction(event.target.value)}><option>INVESTIGATE</option><option>MITIGATE</option><option>RESOLVE</option><option>CLOSE</option></select><input aria-label="Privacy-safe incident note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Privacy-safe note" />{action === "CLOSE" ? <input aria-label="Post-incident summary" value={post} onChange={(event) => setPost(event.target.value)} placeholder="Post-incident summary" /> : null}<button disabled={busy} onClick={() => void send(`/api/technical-operations/incidents/${row.publicKey}/workflow`, { action, note, postIncidentSummary: post, expectedVersion: row.version })}>Apply</button></div>;
}

function IncidentForm({ alerts, busy, send }: { alerts: AlertRow[]; busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [alertPublicKey, setAlertPublicKey] = useState(""); const [title, setTitle] = useState(""); const [summary, setSummary] = useState("");
  if (!open) return <button className="secondary" onClick={() => setOpen(true)}>Create incident</button>;
  return <form className="ops-maintenance-form" onSubmit={(event) => { event.preventDefault(); void send("/api/technical-operations/incidents", alertPublicKey ? { alertPublicKey } : { domain: "CORE_APPLICATION_HEALTH", severity: "WARNING", title, summary, runbookPath: "/docs/runbooks/OBS_INCIDENT_RESPONSE_RUNBOOK.md" }); }}><h3>Create privacy-safe incident</h3><label>Source alert (optional)<select value={alertPublicKey} onChange={(event) => setAlertPublicKey(event.target.value)}><option value="">Manual incident</option>{alerts.map((row) => <option key={row.publicKey} value={row.publicKey}>{row.titleSafe}</option>)}</select></label>{!alertPublicKey ? <><label>Title<input required minLength={8} value={title} onChange={(event) => setTitle(event.target.value)} /></label><label>Summary<input required minLength={8} value={summary} onChange={(event) => setSummary(event.target.value)} /></label></> : null}<div className="page-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy}>Create incident</button></div></form>;
}

function MaintenanceAction({ row, busy, send }: { row: MaintenanceRow; busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [note, setNote] = useState(""); const action = row.status === "PLANNED" ? "START" : "COMPLETE";
  return <div className="ops-inline-action"><input aria-label={`Note for ${friendlyCode(row.domain)} maintenance`} minLength={5} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Privacy-safe note"/><button disabled={busy || note.trim().length < 5} onClick={() => void send(`/api/technical-operations/maintenance/${row.publicKey}/workflow`, { action, note, expectedVersion: row.version })}>{friendlyCode(action)}</button>{row.status === "PLANNED" ? <button className="secondary" disabled={busy || note.trim().length < 5} onClick={() => void send(`/api/technical-operations/maintenance/${row.publicKey}/workflow`, { action: "CANCEL", note, expectedVersion: row.version })}>Cancel</button> : null}</div>;
}

function MaintenanceForm({ busy, send }: { busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false); const [checkKey, setCheckKey] = useState("jobs.outboxes"); const [reason, setReason] = useState(""); const [impact, setImpact] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  if (!open) return <button className="secondary" onClick={() => setOpen(true)}>Plan maintenance</button>;
  return <form className="ops-maintenance-form" onSubmit={(event) => { event.preventDefault(); void send("/api/technical-operations/maintenance", { domain: "BACKGROUND_WORK_HEALTH", checkKeys: [checkKey], reason, expectedImpact: impact, plannedStartAt: new Date(start).toISOString(), plannedEndAt: new Date(end).toISOString() }); }}><h3>Plan exact-domain maintenance</h3><label>Exact check key<input required pattern="[a-z0-9.-]{3,80}" value={checkKey} onChange={(event) => setCheckKey(event.target.value)} /></label><label>Reason<input required minLength={8} value={reason} onChange={(event) => setReason(event.target.value)} /></label><label>Expected service impact<input required minLength={8} value={impact} onChange={(event) => setImpact(event.target.value)} /></label><label>Planned start<input required type="datetime-local" value={start} onChange={(event) => setStart(event.target.value)} /></label><label>Planned end<input required type="datetime-local" value={end} onChange={(event) => setEnd(event.target.value)} /></label><div className="page-actions"><button type="button" className="secondary" onClick={() => setOpen(false)}>Cancel</button><button disabled={busy}>Create window</button></div></form>;
}

function ClientPolicyForm({ release, busy, send }: { release: Dashboard["release"]; busy: boolean; send: (url: string, body: Record<string, unknown>) => Promise<void> }) {
  const [currentVersion, setCurrentVersion] = useState(release.policyCurrentVersion ?? release.serverVersion); const [minimumSupportedVersion, setMinimumSupportedVersion] = useState(release.minimumSupportedVersion ?? release.serverVersion); const [updateAvailableVersion, setUpdateAvailableVersion] = useState(release.updateAvailableVersion ?? ""); const [updateMessage, setUpdateMessage] = useState("");
  return <form className="ops-maintenance-form" onSubmit={(event) => { event.preventDefault(); void send("/api/technical-operations/client-policy", { environment: release.environment, currentVersion, minimumSupportedVersion, updateAvailableVersion: updateAvailableVersion || undefined, updateMessage, enforcementMode: "ADVISORY", expectedVersion: release.policyVersion ?? undefined }); }}><h3>Advisory client-version policy</h3><p>No forced reload or lockout is permitted in this phase.</p><label>Current version<input required value={currentVersion} onChange={(event) => setCurrentVersion(event.target.value)} /></label><label>Minimum supported version<input required value={minimumSupportedVersion} onChange={(event) => setMinimumSupportedVersion(event.target.value)} /></label><label>Available update (optional)<input value={updateAvailableVersion} onChange={(event) => setUpdateAvailableVersion(event.target.value)} /></label><label>Safe update message<input value={updateMessage} onChange={(event) => setUpdateMessage(event.target.value)} /></label><button disabled={busy}>Save advisory policy</button></form>;
}

function statusLabel(status: string) { return friendlyCode(status).replace("Not Configured", "Not configured"); }
function friendlyCode(value: string) { return value.toLowerCase().split("_").map((word) => word ? word[0].toUpperCase() + word.slice(1) : "").join(" "); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function shortValue(value: string) { return value.length > 16 ? value.slice(0, 12) : value; }
