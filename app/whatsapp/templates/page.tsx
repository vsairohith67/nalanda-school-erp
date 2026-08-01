import { PageHeader, StatusBadge } from "@/components/ui";
import { WhatsAppActionButton, WhatsAppTemplateCreateForm } from "@/components/whatsapp-forms";
import { requirePermission, getCurrentUserEffectivePermissions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { permissionSetCan } from "@/lib/role-permissions";

export default async function WhatsAppTemplatesPage() {
  const user = await requirePermission("VIEW_WHATSAPP_CENTRE"), permissions = await getCurrentUserEffectivePermissions();
  const [profiles, mappings] = await Promise.all([
    prisma.whatsAppIntegrationProfile.findMany({ orderBy: { profileCode: "asc" } }),
    prisma.whatsAppTemplateMapping.findMany({ include: { integrationProfile: true }, orderBy: { createdAt: "desc" } })
  ]);
  const manage = permissionSetCan(permissions, "MANAGE_WHATSAPP_TEMPLATE_MAPPINGS");
  return <div className="page whatsapp-page"><PageHeader title="Approved WhatsApp Template Mappings" description="Manual Meta setup and exact category recording. Prompt 19B sends approved text templates only—no free-form, media, authentication, or OTP." />
    {manage ? <WhatsAppTemplateCreateForm profiles={profiles.map((row) => ({ id: row.id, label: `${row.profileCode} · ${row.mode}` }))} /> : null}
    <section className="card"><div className="table-wrap"><table><thead><tr><th>Mapping</th><th>Profile</th><th>Campaign category</th><th>Meta template</th><th>Provider status</th><th>Local status</th><th>Actions</th></tr></thead><tbody>{mappings.map((row) => <tr key={row.id}><td>{row.mappingCode}</td><td>{row.integrationProfile.profileCode}</td><td>{row.notificationCategory}</td><td>{row.metaTemplateName}<br /><small>{row.metaTemplateLanguage} · {row.metaTemplateCategory}</small></td><td><StatusBadge status={row.providerStatus} /></td><td><StatusBadge status={row.status} /></td><td>{manage ? row.status === "ACTIVE" ? <WhatsAppActionButton label="Inactivate" title="Inactivate WhatsApp Template Mapping" description="New batches cannot use this mapping; historical snapshots are preserved." url={`/api/whatsapp/templates/${row.id}/workflow`} body={{ action: "inactivate" }} /> : <WhatsAppActionButton label="Activate" title="Activate WhatsApp Template Mapping" description="Activation requires the provider status to be APPROVED and the parameter allowlist to remain valid." url={`/api/whatsapp/templates/${row.id}/workflow`} body={{ action: "activate" }} /> : "View only"}</td></tr>)}{!mappings.length ? <tr><td colSpan={7}>No mappings configured.</td></tr> : null}</tbody></table></div></section>
  </div>;
}
