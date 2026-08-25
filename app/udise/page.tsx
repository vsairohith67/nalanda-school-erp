import Link from "next/link";
import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { CHECKLIST_STATUS_LABELS, loadUdiseChecklist } from "@/lib/udise-checklist";

export default async function UdisePage() {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const [report, permissions] = await Promise.all([loadUdiseChecklist(prisma), getCurrentUserEffectivePermissions()]);
  const canViewRows = permissionSetCan(permissions, "VIEW_UDISE_MASKED_ROWS");
  const canExport = permissionSetCan(permissions, "EXPORT_UDISE_CHECKLIST");
  const indicators = [
    ["ERP data presence", `${report.indicators.erpDataPresence.presentCandidates} present candidates · ${report.indicators.erpDataPresence.partiallyTrackedCandidates} partial/review · ${report.indicators.erpDataPresence.missingOrNotTrackedCandidates} missing/not tracked`],
    ["School verification", "Not implemented in 1C · no verified-value claim"],
    ["Official evidence coverage", `${report.indicators.officialEvidenceCoverage.attributedGroups}/${report.indicators.officialEvidenceCoverage.totalGroups} groups attributed · supporting manuals/code lists partial`],
    ["Applicability resolution", `${report.indicators.applicabilityResolution.resolvedGroups} resolved · ${report.indicators.applicabilityResolution.unresolvedGroups} unresolved`],
    ["Portal verification", `${report.indicators.portalVerification.pendingGroups} pending groups · 0 verified in ERP`]
  ] as const;
  const action = canExport ? <div className="udise-quick-links">
    <a className="button" href="/api/udise/export">Export masked rows</a>
    <a className="button secondary" href="/api/udise/export?kind=source-register">Export source register</a>
  </div> : undefined;

  return <div className="page udise-page">
    <PageHeader title="UDISE+ Planning Checklist" description="Compare internal ERP evidence with the pinned 2026-27 public field schedule without changing school records." action={action} />
    <section className="card card-pad" aria-labelledby="udise-evidence-basis">
      <div className="section-title"><h2 id="udise-evidence-basis">UDISE+ Evidence Basis</h2><span className="badge warn">{report.evidence.evidenceStatus}</span></div>
      <dl className="udise-summary-list">
        <div><dt>Cycle</dt><dd>{report.evidence.academicCycle}</dd></div>
        <div><dt>National source</dt><dd>{report.evidence.title}</dd></div>
        <div><dt>Version</dt><dd>Public filename v3 · internal v{report.evidence.internalVersion} dated 15 July 2026</dd></div>
        <div><dt>Reviewed</dt><dd>{report.evidence.reviewedDate}</dd></div>
        <div><dt>Scope</dt><dd>{report.evidence.scope}</dd></div>
        <div><dt>ERP cycle comparison</dt><dd>{report.cycleStatus === "CURRENT_CYCLE_MATCH" ? "Current ERP cycle matches the pinned evidence cycle" : report.cycleStatus === "SOURCE_CONFLICT" ? `Source conflict: ERP cycle ${report.schoolAcademicYear} does not match ${report.academicYear}` : "Official School Settings source is missing; no fallback values are counted"}</dd></div>
      </dl>
      <p className="muted">{report.evidence.versionConflict}</p>
    </section>
    <div className="notice-warning udise-warning"><strong>{report.warning}</strong><span>{report.verificationWarning}</span></div>
    {report.limits.studentRowsTruncated || report.limits.staffRowsTruncated ? <div className="notice-warning udise-warning"><strong>Bounded review</strong><span>Counts use at most 2,000 Student and 500 Staff candidates. Matched and loaded totals remain visible in the compact summary.</span></div> : null}
    <UdiseNav current="overview" showRows={canViewRows} />
    <section className="lifecycle-stats" aria-label="Separate UDISE planning indicators">
      {indicators.map(([label, value]) => <div className="stat-card" key={label}><span>{label}</span><strong>{value}</strong></div>)}
    </section>
    <section className="responsive-grid" aria-label="ERP candidate-status counts">
      {Object.entries(report.categoryCounts).map(([category, counts]) => <article className="card card-pad udise-category" key={category}>
        <h3>{category}</h3>
        <dl>
          <div><dt>{CHECKLIST_STATUS_LABELS.ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED}</dt><dd>{counts.ERP_VALUE_PRESENT_NOT_OFFICIALLY_VERIFIED}</dd></div>
          <div><dt>{CHECKLIST_STATUS_LABELS.PARTIALLY_TRACKED}</dt><dd>{counts.PARTIALLY_TRACKED}</dd></div>
          <div><dt>{CHECKLIST_STATUS_LABELS.TRACKED_BUT_REQUIRES_VERIFICATION}</dt><dd>{counts.TRACKED_BUT_REQUIRES_VERIFICATION}</dd></div>
          <div><dt>{CHECKLIST_STATUS_LABELS.MISSING}</dt><dd>{counts.MISSING}</dd></div>
          <div><dt>{CHECKLIST_STATUS_LABELS.NOT_TRACKED}</dt><dd>{counts.NOT_TRACKED}</dd></div>
          <div><dt>{CHECKLIST_STATUS_LABELS.SENSITIVE_CONDITIONAL}</dt><dd>{counts.SENSITIVE_CONDITIONAL}</dd></div>
        </dl>
      </article>)}
    </section>
    <section className="card card-pad">
      <h3>Detailed reviews</h3>
      <div className="udise-quick-links">
        <Link href="/udise/register">Review the source-attributed 75-group register</Link>
        {canViewRows ? <Link href="/udise/students">Review masked Student gaps</Link> : null}
        {canViewRows ? <Link href="/udise/staff">Review masked Staff gaps</Link> : null}
        <Link href="/udise/summary">Open compact planning summary</Link>
      </div>
    </section>
  </div>;
}
