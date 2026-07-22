import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function WhatsAppCentrePage() {
  await requirePermission("VIEW_WHATSAPP_CENTRE");
  const [profiles, consentCount, mappings, batches, queued] = await Promise.all([
    prisma.whatsAppIntegrationProfile.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.whatsAppConsent.count({ where: { status: "OPTED_IN" } }),
    prisma.whatsAppTemplateMapping.count({ where: { status: "ACTIVE", providerStatus: "APPROVED" } }),
    prisma.whatsAppOutboundBatch.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
    prisma.whatsAppDelivery.count({ where: { status: { in: ["SCHEDULED", "QUEUED", "RETRY_PENDING", "SENDING"] } } })
  ]);
  return <div className="page whatsapp-page"><PageHeader title="WhatsApp Business One-Way Communication" description="Official Meta Cloud API foundation: approved text templates, explicit consent, masked delivery records, and a database-backed queue." action={<div className="page-actions"><Link className="button" href="/whatsapp/batches/new">Create Batch</Link><Link className="button secondary" href="/whatsapp/reports">Reports</Link></div>} />
    <div className="notice warning"><strong>LIVE external sending is disabled by default.</strong> QA uses the deterministic MOCK provider. Credentials are environment-only and never shown or stored here.</div>
    <div className="grid three"><StatCard label="Opted-in contacts" value={String(consentCount)} /><StatCard label="Approved mappings" value={String(mappings)} /><StatCard label="Queued / processing" value={String(queued)} /></div>
    <section className="card card-pad"><h3>Operations</h3><div className="page-actions"><Link className="button secondary" href="/whatsapp/integration">Integration</Link><Link className="button secondary" href="/whatsapp/templates">Templates</Link><Link className="button secondary" href="/whatsapp/consents">Consents</Link><Link className="button secondary" href="/whatsapp/batches">Batches</Link></div></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Mode</th><th>Status</th><th>Graph API</th><th>Health</th></tr></thead><tbody>{profiles.map((row) => <tr key={row.id}><td>{row.displayName}<br /><small>{row.profileCode}</small></td><td><StatusBadge status={row.mode} /></td><td><StatusBadge status={row.status} /></td><td>{row.graphApiVersion}</td><td>{row.lastHealthCheckStatus ?? "Not checked"}</td></tr>)}{!profiles.length ? <tr><td colSpan={5}>No profile configured. Create a MOCK profile first.</td></tr> : null}</tbody></table></div></section>
    <section className="card"><div className="section-title"><div><h3>Recent batches</h3><p>Source Prompt 19A campaigns remain immutable.</p></div></div><div className="table-wrap"><table><thead><tr><th>Batch</th><th>Status</th><th>Eligible</th><th>Skipped</th><th>Delivered / read</th></tr></thead><tbody>{batches.map((row) => <tr key={row.id}><td><Link href={`/whatsapp/batches/${row.id}`}>{row.batchNumber}</Link></td><td><StatusBadge status={row.status} /></td><td>{row.totalEligibleContacts}</td><td>{row.totalSkipped}</td><td>{row.totalDelivered} / {row.totalRead}</td></tr>)}{!batches.length ? <tr><td colSpan={5}>No WhatsApp batches yet.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
