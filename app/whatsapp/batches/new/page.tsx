import { PageHeader } from "@/components/ui";
import { WhatsAppBatchCreateForm } from "@/components/whatsapp-forms";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewWhatsAppBatchPage() {
  await requirePermission("CREATE_WHATSAPP_BATCHES");
  const [campaigns, profiles, mappings] = await Promise.all([
    prisma.notificationCampaign.findMany({ where: { status: "PUBLISHED", publishedAt: { not: null } }, orderBy: { publishedAt: "desc" } }),
    prisma.whatsAppIntegrationProfile.findMany({ where: { status: { in: ["ACTIVE", "CONFIGURED", "DRAFT"] } }, orderBy: { profileCode: "asc" } }),
    prisma.whatsAppTemplateMapping.findMany({ where: { status: "ACTIVE", providerStatus: "APPROVED" }, orderBy: { mappingCode: "asc" } })
  ]);
  return <div className="page whatsapp-page"><PageHeader title="Create WhatsApp Batch" description="Select an immutable published Prompt 19A campaign, active profile, and approved exact-category Meta template mapping." />
    <WhatsAppBatchCreateForm campaigns={campaigns.map((row) => ({ id: row.id, label: `${row.campaignNumber} · ${row.category} · ${row.title}` }))} profiles={profiles.map((row) => ({ id: row.id, label: `${row.profileCode} · ${row.mode} · ${row.status}` }))} mappings={mappings.map((row) => ({ id: row.id, profileId: row.integrationProfileId, label: `${row.mappingCode} · ${row.metaTemplateCategory} · ${row.metaTemplateLanguage}` }))} />
  </div>;
}
