import { PageHeader } from "@/components/ui";
import { UdiseNav } from "@/components/udise-nav";
import { UdiseStatusBadge } from "@/components/udise-status-badge";
import { getCurrentUserEffectivePermissions, requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";
import { loadUdiseChecklist } from "@/lib/udise-checklist";
import { UDISE_REGISTER_TOTALS } from "@/lib/udise-evidence-register";

export default async function UdiseSummaryPage() {
  await requirePermission("VIEW_UDISE_CHECKLIST");
  const [report, permissions] = await Promise.all([loadUdiseChecklist(prisma), getCurrentUserEffectivePermissions()]);
  return <div className="page udise-page print-document">
    <PageHeader title="UDISE+ Compact Planning Summary" description={report.warning} />
    <UdiseNav current="summary" showRows={permissionSetCan(permissions, "VIEW_UDISE_MASKED_ROWS")} />
    <div className="notice-warning udise-warning"><strong>{report.evidence.evidenceStatus} · cycle {report.evidence.academicCycle}</strong><span>{report.verificationWarning}</span></div>
    <section className="card card-pad"><h3>Evidence and School candidates</h3><p>{report.evidence.title} · public filename {report.evidence.publicFilename} · internal v{report.evidence.internalVersion} · reviewed {report.evidence.reviewedDate}.</p><p>ERP cycle comparison: {report.cycleStatus}. School name: <UdiseStatusBadge status={report.school.schoolNameStatus} />. Address/PIN: <UdiseStatusBadge status={report.school.addressStatus} />. Phone: <UdiseStatusBadge status={report.school.phoneStatus} />. Official identifiers: <UdiseStatusBadge status={report.school.officialFieldsStatus} />.</p></section>
    <section className="card card-pad"><h3>Separate planning indicators</h3><dl className="udise-summary-list">
      <div><dt>ERP data presence</dt><dd>{report.indicators.erpDataPresence.presentCandidates} present candidates, {report.indicators.erpDataPresence.partiallyTrackedCandidates} partial/review, {report.indicators.erpDataPresence.missingOrNotTrackedCandidates} missing/not tracked</dd></div>
      <div><dt>School verification</dt><dd>Not implemented in 1C; zero verified-value claims</dd></div>
      <div><dt>Official evidence coverage</dt><dd>{report.indicators.officialEvidenceCoverage.attributedGroups}/{report.indicators.officialEvidenceCoverage.totalGroups} groups attributed; manuals/code lists partial</dd></div>
      <div><dt>Applicability resolution</dt><dd>{report.indicators.applicabilityResolution.resolvedGroups} resolved, {report.indicators.applicabilityResolution.unresolvedGroups} unresolved</dd></div>
      <div><dt>Portal verification</dt><dd>{report.indicators.portalVerification.pendingGroups} pending, zero verified by an authorised human in ERP</dd></div>
      <div><dt>Bounded Student rows</dt><dd>{report.limits.studentRowsLoaded} loaded of {report.limits.studentRowsMatched} matched{report.limits.studentRowsTruncated ? " - truncated" : ""}</dd></div>
      <div><dt>Bounded Staff rows</dt><dd>{report.limits.staffRowsLoaded} loaded of {report.limits.staffRowsMatched} matched{report.limits.staffRowsTruncated ? " - truncated" : ""}</dd></div>
    </dl></section>
    <section className="card card-pad"><h3>75-group reconciliation</h3><p>{UDISE_REGISTER_TOTALS.total} unique groups: 18 School, 15 Facility, 27 Student, 14 Staff and 1 Block.</p><p>Primary statuses: 8 tracked, 21 partially tracked, 23 not tracked, 17 sensitive/conditional and 6 portal-only/unverified.</p></section>
    <section className="card card-pad"><h3>Internal review totals</h3><dl className="udise-summary-list">{Object.entries(report.summary).map(([key, value]) => <div key={key}><dt>{key.replace(/([A-Z])/g, " $1")}</dt><dd>{value}</dd></div>)}</dl></section>
  </div>;
}
