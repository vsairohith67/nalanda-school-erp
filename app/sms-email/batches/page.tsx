import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function SmsEmailBatchesPage() {
  await requirePermission("VIEW_SMS_EMAIL_CENTRE");
  const batches = await prisma.smsEmailOutboundBatch.findMany({ include: { integrationProfile: true, templateMapping: true, notificationCampaign: true }, orderBy: { createdAt: "desc" } });
  return <div className="page sms-email-page"><PageHeader title="SMS and Email Batches" description="One channel per batch. Prompt 19A campaigns, mappings and readiness are snapshotted before approval." action={<Link className="button" href="/sms-email/batches/new">Create Batch</Link>} />
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Channel / mode</th><th>Campaign</th><th>Mapping</th><th>Status</th><th>Eligible / skipped</th></tr></thead><tbody>{batches.map((row) => <tr key={row.id}><td><Link href={`/sms-email/batches/${row.id}`}>{row.batchNumber}</Link></td><td>{row.channel} / {row.integrationProfile.mode}</td><td>{row.notificationCampaign.campaignNumber}</td><td>{row.templateMapping.mappingCode}</td><td><StatusBadge status={row.status} /></td><td>{row.totalEligibleContacts} / {row.totalSkipped}</td></tr>)}{!batches.length ? <tr><td colSpan={6}>No batches.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
