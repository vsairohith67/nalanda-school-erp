import Link from "next/link";
import { PageHeader, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WhatsAppBatchesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requirePermission("VIEW_WHATSAPP_CENTRE"); const query = await searchParams;
  const rows = await prisma.whatsAppOutboundBatch.findMany({
    where: query.status ? { status: query.status } : {},
    include: { integrationProfile: true, notificationCampaign: true, templateMapping: true },
    orderBy: { createdAt: "desc" }
  });
  return <div className="page whatsapp-page"><PageHeader title="WhatsApp Outbound Batches" description="Preview, separate approval, queued processing, capped retry, and immutable snapshots." action={<Link className="button" href="/whatsapp/batches/new">Create Batch</Link>} />
    <form className="card filter-grid"><label>Status<input name="status" defaultValue={query.status ?? ""} /></label><button>Apply Filter</button><Link className="button secondary" href="/whatsapp/batches">Clear</Link></form>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Campaign</th><th>Mode</th><th>Template</th><th>Status</th><th>Eligible / skipped</th><th>Accepted / delivered / failed</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/whatsapp/batches/${row.id}`}>{row.batchNumber}</Link><br /><small>{row.createdAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}</small></td><td>{row.notificationCampaign.campaignNumber}<br /><small>{row.notificationCampaign.title}</small></td><td>{row.integrationProfile.mode}</td><td>{row.templateMapping.mappingCode}</td><td><StatusBadge status={row.status} /></td><td>{row.totalEligibleContacts} / {row.totalSkipped}</td><td>{row.totalAccepted} / {row.totalDelivered + row.totalRead} / {row.totalFailed}</td></tr>)}{!rows.length ? <tr><td colSpan={7}>No batches match.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
