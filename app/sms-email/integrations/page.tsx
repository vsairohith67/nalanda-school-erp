import { PageHeader, StatusBadge } from "@/components/ui";
import { SmsEmailProfileActions, SmsEmailProfileCreateForm } from "@/components/sms-email-forms";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";
import { ensureSmsEmailMockProfiles } from "@/lib/sms-email-profiles";

export default async function SmsEmailIntegrationsPage() {
  const user = await requirePermission("VIEW_SMS_EMAIL_CENTRE"), permissions = await getEffectivePermissions(prisma, user.role);
  await ensureSmsEmailMockProfiles(prisma);
  const profiles = await prisma.smsEmailIntegrationProfile.findMany({ orderBy: [{ channel: "asc" }, { createdAt: "desc" }] });
  const manage = permissionSetCan(permissions, "MANAGE_SMS_EMAIL_INTEGRATIONS");
  return <div className="page sms-email-page"><PageHeader title="SMS and Email Integrations" description="Non-secret metadata and readiness only. OAuth tokens, API keys and passwords are environment-only." />
    <div className="notice warning">LIVE activation is disabled during Prompt 19C. SMS LIVE health reports “SMS provider selection required.”</div>
    {manage ? <SmsEmailProfileCreateForm /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Profile</th><th>Channel / provider</th><th>Mode</th><th>Readiness</th><th>Limits</th><th>Actions</th></tr></thead><tbody>{profiles.map((row) => <tr key={row.id}><td>{row.displayName}<br /><small>{row.profileCode}</small></td><td>{row.channel}<br /><small>{row.providerKind}</small></td><td><StatusBadge status={row.mode} /><br /><StatusBadge status={row.status} /></td><td>{row.channel === "SMS" ? <>PE {row.dltPrincipalEntityReference ? "recorded" : "missing"}<br />Header {row.dltHeaderReference ? "recorded" : "missing"}</> : <>SPF {row.spfStatus}<br />DKIM {row.dkimStatus}<br />DMARC {row.dmarcStatus}</>}</td><td>{row.hourlyLimit ?? "—"} / hour<br />{row.dailyLimit ?? "—"} / day</td><td>{manage ? <SmsEmailProfileActions id={row.id} code={row.profileCode} channel={row.channel} status={row.status} /> : "Read only"}</td></tr>)}</tbody></table></div></section>
  </div>;
}
