import Link from "next/link";
import { PageHeader, StatCard, StatusBadge } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSmsEmailMockProfiles, emailDomainReadiness, smsDltReadiness } from "@/lib/sms-email-profiles";

export default async function SmsEmailCentrePage() {
  await requirePermission("VIEW_SMS_EMAIL_CENTRE");
  await ensureSmsEmailMockProfiles(prisma);
  const [profiles, consentCount, mappings, batches, queued, suppressions] = await Promise.all([
    prisma.smsEmailIntegrationProfile.findMany({ orderBy: [{ channel: "asc" }, { createdAt: "desc" }] }),
    prisma.smsEmailConsent.count({ where: { status: "OPTED_IN" } }),
    prisma.smsEmailTemplateMapping.count({ where: { status: "ACTIVE", providerStatus: "APPROVED" } }),
    prisma.smsEmailOutboundBatch.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
    prisma.smsEmailDelivery.count({ where: { status: { in: ["QUEUED", "SENDING"] } } }),
    prisma.smsEmailSuppression.count({ where: { status: "ACTIVE" } })
  ]);
  const sms = profiles.find((row) => row.channel === "SMS"), email = profiles.find((row) => row.channel === "EMAIL");
  return <div className="page sms-email-page"><PageHeader title="SMS and Email One-Way Communication" description="Independent consented operational channels using Prompt 19A snapshots, masked contacts, approved templates and a persistent queue." action={<div className="page-actions"><Link className="button" href="/sms-email/batches/new">Create Batch</Link><Link className="button secondary" href="/sms-email/reports">Reports</Link></div>} />
    <div className="notice warning"><strong>LIVE SMS and Email are disabled.</strong> Prompt 19C QA uses deterministic MOCK providers only. No credential field or live-send shortcut exists.</div>
    <div className="grid three"><StatCard label="Opted-in channel contacts" value={String(consentCount)} /><StatCard label="Approved mappings" value={String(mappings)} /><StatCard label="Queued / processing" value={String(queued)} /><StatCard label="Active suppressions" value={String(suppressions)} /></div>
    <section className="card card-pad"><h3>Operations</h3><div className="page-actions"><Link className="button secondary" href="/sms-email/integrations">Integrations</Link><Link className="button secondary" href="/sms-email/templates">Templates</Link><Link className="button secondary" href="/sms-email/consents">Consents</Link><Link className="button secondary" href="/sms-email/batches">Batches</Link></div></section>
    <section className="grid two"><article className="card card-pad"><h3>SMS DLT readiness</h3><p><StatusBadge status={sms?.mode ?? "NOT_CONFIGURED"} /> Live sending disabled.</p><pre className="safe-json">{JSON.stringify(sms ? smsDltReadiness(sms) : { ready: false }, null, 2)}</pre><p>{sms?.providerKind === "SELECTED_DLT_SMS" ? "Selected adapter metadata exists." : "SMS provider selection required."}</p></article>
      <article className="card card-pad"><h3>Email domain readiness</h3><p><StatusBadge status={email?.mode ?? "NOT_CONFIGURED"} /> Gmail API acceptance would not prove delivery.</p><pre className="safe-json">{JSON.stringify(email ? emailDomainReadiness(email) : { ready: false }, null, 2)}</pre></article></section>
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Recent batch</th><th>Channel</th><th>Status</th><th>Eligible</th><th>Accepted / delivered</th></tr></thead><tbody>{batches.map((row) => <tr key={row.id}><td><Link href={`/sms-email/batches/${row.id}`}>{row.batchNumber}</Link></td><td>{row.channel}</td><td><StatusBadge status={row.status} /></td><td>{row.totalEligibleContacts}</td><td>{row.totalAccepted} / {row.totalDelivered}</td></tr>)}{!batches.length ? <tr><td colSpan={5}>No SMS/Email batches yet.</td></tr> : null}</tbody></table></div></section>
  </div>;
}

