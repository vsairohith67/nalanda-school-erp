import { hasUserPermission, requirePermission } from "@/lib/auth";
import { getReleaseOperationsView } from "@/lib/release-operations-view";
import { PageHeader, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ReleaseOperationsPage() {
  const user = await requirePermission("VIEW_RELEASE_OPERATIONS_SUMMARY");
  const full = await hasUserPermission(user, "VIEW_RELEASE_OPERATIONS");
  const view = getReleaseOperationsView({ summaryOnly: !full });
  const candidate = view.candidate;
  return (
    <main className="page release-operations-page">
      <PageHeader title="Release Operations" description="Private, provider-neutral release gates, client updates and rollback readiness. This interface never performs a public deployment." />
      <p id="release-operations-title" className="release-ops-live" role="status" aria-live="polite">{candidate ? `${candidate.status.replaceAll("_", " ")} · ${candidate.gateSummary.passed} of ${candidate.gateSummary.total} gates passed` : "No local release candidate is active."}</p>
      <section className="release-ops-summary" aria-label="Release summary">
        <Summary label="Current release" value={view.currentRelease} status="Current" />
        <Summary label="Target candidate" value={candidate?.targetRelease ?? "Not prepared"} status={candidate?.status ?? "Draft"} />
        <Summary label="Environment" value={candidate?.channel ?? "Local/private"} status="Restricted" />
        <Summary label="Rollback" value={candidate?.rollback.recommendation ?? "Prepare a candidate first"} status={candidate?.rollback.ready ? "Ready" : "Pending"} />
      </section>
      <section className="card card-pad">
        <div className="section-title"><div><h2>Approval and operational boundary</h2><p>{view.boundaries.message}</p></div><StatusBadge status="Not authorised" /></div>
        <dl className="ops-metrics ops-metrics-wide">
          <Metric label="Cloud/public deployment" value="Not authorised" /><Metric label="DNS change" value="Not authorised" /><Metric label="Provider activation" value="Not authorised" /><Metric label="Operational data in staging" value="Not authorised" />
        </dl>
      </section>
      {candidate ? <>
        <section className="card card-pad"><h2>Candidate readiness</h2><dl className="ops-metrics ops-metrics-wide"><Metric label="Status" value={candidate.status.replaceAll("_", " ")} /><Metric label="Current phase" value={candidate.phase.replaceAll("-", " ")} /><Metric label="Migration" value={candidate.migrationClassification.replaceAll("_", " ")} /><Metric label="Gates" value={`${candidate.gateSummary.passed} passed · ${candidate.gateSummary.failed} failed · ${candidate.gateSummary.pending} pending`} /><Metric label="Backup" value={candidate.backupReady ? "Ready" : "Pending"} /><Metric label="Restore proof" value={candidate.restoreReady ? "Ready" : "Pending"} /><Metric label="Synthetic staging" value={candidate.stagingAccepted ? "Accepted" : "Pending"} /><Metric label="Client update" value={candidate.client.updateSeverity} /></dl></section>
        <section className="card card-pad"><h2>Maintenance and rollback</h2><p>{candidate.maintenance.active ? `Maintenance active: ${candidate.maintenance.reasonSafe ?? "Governed release window"}` : "No active release maintenance window."}</p><p><strong>Rollback owner:</strong> {candidate.rollback.owner ?? "Must be named before release"}</p><p><strong>Point of no return:</strong> {candidate.pointOfNoReturnReached ? "Reached" : "Not reached"}</p></section>
      </> : null}
      {full ? <>
        <section className="card card-pad"><h2>Validation gates</h2>{view.gates.length ? <div className="table-wrap"><table><thead><tr><th>Gate</th><th>Status</th><th>Privacy-safe evidence</th><th>Checked</th></tr></thead><tbody>{view.gates.map((gate) => <tr key={gate.key}><td>{gate.key.replaceAll("-", " ")}</td><td><StatusBadge status={gate.status} /></td><td>{gate.evidenceSafe ?? "Pending"}</td><td>{gate.checkedAt ? formatDate(gate.checkedAt) : "—"}</td></tr>)}</tbody></table></div> : <p>Prepare the candidate with the local release runner to populate gates.</p>}</section>
        <section className="card card-pad"><h2>Server-governed feature flags</h2><div className="table-wrap"><table><thead><tr><th>Flag</th><th>Environment</th><th>State</th><th>Version</th><th>Owner</th></tr></thead><tbody>{view.featureFlags.map((flag) => <tr key={flag.key}><td>{flag.key}</td><td>{flag.environment}</td><td><StatusBadge status={flag.enabled ? "Enabled" : "Disabled"} /></td><td>{flag.version}</td><td>{flag.owner}</td></tr>)}</tbody></table></div></section>
        <section className="card card-pad"><h2>Append-only local release history</h2>{view.history.length ? <ol className="release-history">{view.history.map((event) => <li key={event.sequence}><strong>{event.eventType.replaceAll("_", " ")}</strong><span>{event.phase} · {formatDate(event.occurredAt)}</span><p>{event.summarySafe}</p></li>)}</ol> : <p>No local release events have been recorded.</p>}</section>
      </> : <section className="card card-pad"><h2>Director summary boundary</h2><p>Technical gates, feature-flag detail and append-only evidence require the separate non-delegable Super Admin release permission.</p></section>}
    </main>
  );
}

function Summary({ label, value, status }: { label: string; value: string; status: string }) { return <article className="card card-pad"><span>{label}</span><strong>{value}</strong><StatusBadge status={status} /></article>; }
function Metric({ label, value }: { label: string; value: string | number }) { return <div><dt>{label}</dt><dd>{value}</dd></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
