import { notFound } from "next/navigation";
import { SmsEmailActionButton, SmsEmailBatchWorkflow } from "@/components/sms-email-forms";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";

export default async function SmsEmailBatchPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("VIEW_SMS_EMAIL_CENTRE"), permissions = await getCurrentUserEffectivePermissions(), id = (await params).id;
  const row = await prisma.smsEmailOutboundBatch.findUnique({ where: { id }, include: { integrationProfile: true, templateMapping: true, notificationCampaign: true, deliveries: { orderBy: { createdAt: "asc" } } } });
  if (!row) notFound();
  const canDetails = permissionSetCan(permissions, "VIEW_SMS_EMAIL_DELIVERIES");
  return <div className="page sms-email-page"><PageHeader title={row.batchNumber} description={`${row.channel} • ${row.notificationCampaign.campaignNumber} • ${row.integrationProfile.mode}`} />
    <div className="notice warning">Estimates only. Gmail API ACCEPTED is not final delivery. No Expense, Budget, Payment, Cash Book or Miscellaneous Income mutation occurs.</div>
    <div className="grid three"><StatCard label="Status" value={row.status} /><StatCard label="Eligible / skipped" value={`${row.totalEligibleContacts} / ${row.totalSkipped}`} /><StatCard label="Queued / failed" value={`${row.totalQueued} / ${row.totalFailed}`} /><StatCard label="Accepted / delivered" value={`${row.totalAccepted} / ${row.totalDelivered}`} /><StatCard label="SMS segments" value={String(row.estimatedSegments ?? "—")} /><StatCard label="Estimate (minor units)" value={String(row.estimatedMaximumCostMinor ?? "Not configured")} /></div>
    <SmsEmailBatchWorkflow id={row.id} channel={row.channel} status={row.status} permissions={[...permissions]} />
    {permissionSetCan(permissions, "PROCESS_SMS_EMAIL_QUEUE") ? <section className="card card-pad"><h3>Database-backed queue</h3><SmsEmailActionButton label="Process Queue" title="Process SMS/Email Queue" description="Claims a bounded chunk. MOCK makes no network request; final contact and consent are rechecked." url="/api/sms-email/process" body={{ limit: row.integrationProfile.workerChunkSize }} /></section> : null}
    {canDetails ? <section className="card"><div className="table-wrap"><table><thead><tr><th>Subject</th><th>Masked contact</th><th>Status</th><th>Attempts</th><th>Safe failure</th><th>Evidence</th></tr></thead><tbody>{row.deliveries.map((delivery) => <tr key={delivery.id}><td>{delivery.subjectType}</td><td>{delivery.contactMasked}</td><td><StatusBadge status={delivery.status} /></td><td>{delivery.retryCount}</td><td>{delivery.failureCode ?? "—"}<br /><small>{delivery.failureMessageSafe ?? ""}</small></td><td>{delivery.channel === "EMAIL" && delivery.status === "ACCEPTED" ? "API acceptance only" : delivery.deliveredAt ? "Provider delivery evidence" : "No delivery evidence"}</td></tr>)}{!row.deliveries.length ? <tr><td colSpan={6}>No deliveries. Preview intentionally creates none.</td></tr> : null}</tbody></table></div></section> : <div className="notice">Masked delivery detail requires VIEW_SMS_EMAIL_DELIVERIES. Aggregate totals remain visible.</div>}
  </div>;
}
