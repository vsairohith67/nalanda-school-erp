import { notFound } from "next/navigation";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { WhatsAppBatchWorkflow, WhatsAppActionButton } from "@/components/whatsapp-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { WHATSAPP_COST_WARNING } from "@/lib/whatsapp-costs";

export default async function WhatsAppBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_WHATSAPP_CENTRE"), permissions = await getEffectivePermissions(prisma, user.role), id = (await params).id;
  const row = await prisma.whatsAppOutboundBatch.findUnique({ where: { id }, include: {
    integrationProfile: true, templateMapping: true, notificationCampaign: true,
    deliveries: { include: { attempts: { orderBy: { attemptNumber: "desc" } } }, orderBy: { createdAt: "asc" } }
  } });
  if (!row) notFound();
  const canDetails = permissionSetCan(permissions, "VIEW_WHATSAPP_DELIVERIES");
  return <div className="page whatsapp-page"><PageHeader title={row.batchNumber} description={`${row.notificationCampaign.campaignNumber} · ${row.notificationCampaign.title}`} action={<StatusBadge status={row.status} />} />
    <div className="notice warning">{WHATSAPP_COST_WARNING} Estimated eligible maximum: {row.estimatedCostMinor == null ? "Not calculated" : `INR ${(row.estimatedCostMinor / 100).toFixed(2)}`}. Configured cap: {row.integrationProfile.costCapEnabled && row.integrationProfile.maximumEstimatedBatchCostMinor != null ? `INR ${(row.integrationProfile.maximumEstimatedBatchCostMinor / 100).toFixed(2)}` : "disabled"}. Override: {row.costCapOverrideSnapshotHash ? "authorised for this exact current estimate snapshot" : "none"}. No finance record is created.</div>
    <div className="grid three"><StatCard label="Eligible" value={String(row.totalEligibleContacts)} /><StatCard label="Skipped" value={String(row.totalSkipped)} /><StatCard label="Queued / processing" value={String(row.totalQueued)} /><StatCard label="Accepted" value={String(row.totalAccepted)} /><StatCard label="Delivered" value={String(row.totalDelivered + row.totalRead)} /><StatCard label="Failed" value={String(row.totalFailed)} /></div>
    <section className="card card-pad"><h3>Immutable snapshots</h3><dl className="detail-grid"><div><dt>Mode</dt><dd>{row.integrationProfile.mode} · {row.integrationProfile.profileCode}</dd></div><div><dt>Template</dt><dd>{row.templateMapping.metaTemplateName} · {row.templateMapping.metaTemplateLanguage}</dd></div><div><dt>Meta category</dt><dd>{row.templateMapping.metaTemplateCategory}</dd></div><div><dt>Campaign</dt><dd>{row.notificationCampaign.category} · {row.notificationCampaign.priority}</dd></div></dl></section>
    <WhatsAppBatchWorkflow id={row.id} status={row.status} permissions={[...permissions]} />
    {permissionSetCan(permissions, "PROCESS_WHATSAPP_QUEUE") ? <section className="card card-pad"><h3>Database-backed queue</h3><WhatsAppActionButton label="Process Queue" title="Process WhatsApp Queue" description="Claims a bounded chunk transactionally. MOCK sends make no network request; live remains environment-gated." url="/api/whatsapp/process" body={{ limit: row.integrationProfile.workerChunkSize }} /></section> : null}
    {canDetails ? <section className="card"><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Masked phone</th><th>Status</th><th>Attempts</th><th>Safe failure</th><th>Timestamps</th></tr></thead><tbody>{row.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.subjectType}<br /><small>{delivery.safeDisplayLabel}</small></td><td>{delivery.countryCode ?? ""} ******{delivery.phoneLast4}</td><td><StatusBadge status={delivery.status} /></td><td>{delivery.attemptCount}</td><td>{delivery.providerErrorCategory ?? "—"}<br /><small>{delivery.failureMessageSafe ?? ""}</small></td><td>Accepted {delivery.acceptedAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}<br />Delivered {delivery.deliveredAt?.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) ?? "—"}</td></tr>)}{!row.deliveries.length ? <tr><td colSpan={6}>No delivery rows. Preview intentionally creates none.</td></tr> : null}</tbody></table></div></section> : <div className="notice">Individual masked delivery rows require VIEW_WHATSAPP_DELIVERIES. Aggregate counts remain available.</div>}
  </div>;
}
