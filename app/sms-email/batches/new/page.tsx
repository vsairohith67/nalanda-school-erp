import { SmsEmailBatchCreateForm } from "@/components/sms-email-forms";
import { PageHeader } from "@/components/ui";
import { requirePermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default async function NewSmsEmailBatchPage() {
  await requirePermission("CREATE_SMS_EMAIL_BATCHES");
  const [campaigns, profiles, mappings] = await Promise.all([
    prisma.notificationCampaign.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } }),
    prisma.smsEmailIntegrationProfile.findMany({ where: { status: { in: ["ACTIVE", "CONFIGURED"] } }, orderBy: { profileCode: "asc" } }),
    prisma.smsEmailTemplateMapping.findMany({ where: { status: "ACTIVE", providerStatus: "APPROVED" }, orderBy: { mappingCode: "asc" } })
  ]);
  return <div className="page sms-email-page"><PageHeader title="Create SMS or Email Batch" description="Published Prompt 19A audience snapshot only. Preview creates no deliveries or attempts." /><SmsEmailBatchCreateForm campaigns={campaigns.map((row) => ({ id: row.id, label: `${row.campaignNumber} — ${row.title}` }))} profiles={profiles.map((row) => ({ id: row.id, label: `${row.channel} — ${row.profileCode} (${row.mode})` }))} mappings={mappings.map((row) => ({ id: row.id, profileId: row.integrationProfileId, label: row.mappingCode }))} /></div>;
}
