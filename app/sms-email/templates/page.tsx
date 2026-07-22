import { PageHeader, StatusBadge } from "@/components/ui";
import { SmsEmailActionButton, SmsEmailTemplateCreateForm } from "@/components/sms-email-forms";
import { requirePermission } from "@/lib/auth";
import { getEffectivePermissions, permissionSetCan } from "@/lib/role-permissions";
import { prisma } from "@/lib/prisma";

export default async function SmsEmailTemplatesPage() {
  const user = await requirePermission("VIEW_SMS_EMAIL_CENTRE"), permissions = await getEffectivePermissions(prisma, user.role);
  const [profiles, mappings] = await Promise.all([
    prisma.smsEmailIntegrationProfile.findMany({ orderBy: { profileCode: "asc" } }),
    prisma.smsEmailTemplateMapping.findMany({ include: { integrationProfile: true }, orderBy: { createdAt: "desc" } })
  ]);
  const manage = permissionSetCan(permissions, "MANAGE_SMS_EMAIL_TEMPLATES");
  return <div className="page sms-email-page"><PageHeader title="SMS and Email Template Mappings" description="Exact DLT-safe SMS text and allowlisted plain-text Email mappings. No arbitrary HTML, attachments or remote resources." />
    {manage ? <SmsEmailTemplateCreateForm profiles={profiles.map((row) => ({ id: row.id, channel: row.channel, label: `${row.profileCode} (${row.mode})` }))} /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Mapping</th><th>Channel</th><th>Identity</th><th>Template</th><th>Status</th><th>Action</th></tr></thead><tbody>{mappings.map((row) => <tr key={row.id}><td>{row.mappingCode}<br /><small>{row.notificationCategory}</small></td><td>{row.channel}</td><td>{row.channel === "SMS" ? `${row.smsHeader ?? "No header"} / ${row.smsDltTemplateId ?? "No DLT ID"}` : row.emailSenderAlias ?? "No alias"}</td><td>{row.channel === "SMS" ? row.smsTemplateText : <>{row.emailSubjectTemplate}<br /><small>{row.emailTextTemplate?.slice(0, 80)}</small></>}</td><td><StatusBadge status={row.status} /><br /><StatusBadge status={row.providerStatus} /></td><td>{manage && row.status !== "ACTIVE" ? <SmsEmailActionButton label="Activate" title={`Activate ${row.channel} Template Mapping`} description="Activation revalidates the exact DLT or plain-text allowlist. It does not enable LIVE sending." url={`/api/sms-email/templates/${row.id}/workflow`} body={{ action: "activate" }} /> : "—"}</td></tr>)}{!mappings.length ? <tr><td colSpan={6}>No mappings yet.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
