import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWhatsAppReports } from "@/lib/whatsapp-reports";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function WhatsAppReportsPage() {
  const user = await requirePermission("VIEW_WHATSAPP_REPORTS");
  const [report, permissions] = await Promise.all([loadWhatsAppReports(prisma), getCurrentUserEffectivePermissions()]);
  return <div className="page whatsapp-page">
    <PageHeader title="WhatsApp Aggregate Reports" description="Privacy-safe operational totals only. No contact details, student private data, raw actor IDs, provider payloads, or individual read-surveillance." action={permissionSetCan(permissions, "EXPORT_WHATSAPP_REPORTS") ? <Link className="button" href="/api/whatsapp/reports/export">Export Safe CSV</Link> : undefined} />
    <div className="notice warning">{report.warning}</div>
    <div className="grid three">
      <StatCard label="Prompt 19A recipients" value={String(report.totalCampaignRecipients)} />
      <StatCard label="Eligible / skipped contacts" value={`${report.eligibleContacts} / ${report.skippedContacts}`} />
      <StatCard label="Delivery / aggregate read rate" value={`${report.deliveryRate}% / ${report.aggregateReadRate}%`} />
      <StatCard label="Pre-send maximum estimate" value={`INR ${(report.estimatedMaximumCostMinor / 100).toFixed(2)}`} />
      <StatCard label="Delivered-message estimate" value={`INR ${(report.estimatedDeliveredMessageCostMinor / 100).toFixed(2)}`} />
      <StatCard label="MOCK / LIVE batches" value={`${report.modeCounts.MOCK} / ${report.modeCounts.LIVE}`} />
    </div>
    <AggregateTable title="Consent coverage by subject type" columns={["Metric","Guardian","StaffMember"]} rows={Object.keys(report.consentCoverage.GUARDIAN).map((key) => [label(key), String((report.consentCoverage.GUARDIAN as any)[key]), String((report.consentCoverage.STAFF as any)[key])])} />
    <AggregateTable title="Exact contact-resolution skip reasons" columns={["Reason","Count"]} rows={Object.entries(report.skipReasonCounts).map(([key,value]) => [key,String(value)])} />
    <AggregateTable title="Delivery states" columns={["State","Count"]} rows={Object.entries(report.deliveryCounts).map(([key,value]) => [key,String(value)])} />
    <AggregateTable title="Retries and failures" columns={["Metric","Count"]} rows={Object.entries(report.attemptMetrics).map(([key,value]) => [label(key),String(value)])} />
    <AggregateTable title="Compliance, cost-cap and rate controls" columns={["Metric","Count"]} rows={Object.entries(report.controlMetrics).map(([key,value]) => [label(key),String(value)])} />
    <AggregateTable title="Webhook processing" columns={["Metric","Count"]} rows={Object.entries(report.webhookCounts).map(([key,value]) => [label(key),String(value)])} />
    <AggregateTable title="Profile mode and status" columns={["Profile","Mode","Status","Cost cap"]} rows={report.profiles.map((row: any) => [row.profileCode,row.mode,row.status,row.costCapEnabled && row.maximumEstimatedBatchCostMinor != null ? `${row.costCapCurrency} ${(row.maximumEstimatedBatchCostMinor / 100).toFixed(2)}` : "Disabled"])} />
    <AggregateTable title="Template readiness" columns={["Provider status","Mapping status","Count"]} rows={report.mappings.map((row: any) => [row.providerStatus,row.status,String(row._count._all)])} />
    <section className="card card-pad"><h3>Cost-rate reference</h3><p>{report.rateReference ? `${report.rateReference.market} · ${report.rateReference.category} · ${report.rateReference.currency} · ${report.rateReference.rateVersion} · reviewed ${new Date(report.rateReference.sourceReviewDate).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : "No active rate reference."}</p><p>Batches above configured cap: <strong>{report.batchesAboveConfiguredCap}</strong>. Authorised overrides: <strong>{report.controlMetrics.authorisedCostCapOverrides}</strong>. These controls do not create or mutate any finance record.</p></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Mode</th><th>Status</th><th>Campaign / Meta category</th><th>Eligible / skipped</th><th>Maximum estimate</th><th>Cap override</th></tr></thead><tbody>{report.batches.map((row: any) => <tr key={row.batchNumber}><td>{row.batchNumber}</td><td>{row.integrationProfile.mode}</td><td><StatusBadge status={row.status} /></td><td>{row.notificationCampaign.category} / {row.templateMapping.metaTemplateCategory}</td><td>{row.totalEligibleContacts} / {row.totalSkipped}</td><td>{row.estimatedCostMinor == null ? "—" : `${row.estimatedCostCurrency} ${(row.estimatedCostMinor / 100).toFixed(2)}`}</td><td>{row.costCapOverrideSnapshotHash ? "Authorised" : "No"}</td></tr>)}</tbody></table></div></section>
  </div>;
}

function AggregateTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return <section className="card"><h3 className="card-title">{title}</h3><div className="table-wrap"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.join("|")}>{row.map((cell,index) => <td key={`${index}-${cell}`}>{cell}</td>)}</tr>)}</tbody></table></div></section>;
}
function label(value: string) { return value.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
