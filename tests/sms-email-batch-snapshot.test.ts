import { describe, expect, it } from "vitest";
import { assertSmsEmailBatchSnapshotsCurrent } from "@/lib/sms-email-batches";

const publishedAt = new Date("2026-07-18T00:00:00.000Z");
const campaign = {
  campaignNumber: "NC-20260718-001", category: "GENERAL", priority: "NORMAL",
  title: "Operational update", audienceType: "SPECIFIC_USERS",
  audienceSnapshotJson: "{\"kind\":\"published\"}", publishedAt
};
const mapping = {
  mappingCode: "QA19C_SMS_GENERAL", channel: "SMS", providerStatus: "APPROVED",
  smsPrincipalEntityReference: "PE-1", smsHeader: "NALNDA", smsDltTemplateId: "DLT-1",
  smsTemplateText: "{{schoolName}}: {{notificationTitle}}", emailSenderAlias: null,
  emailSubjectTemplate: null, emailTextTemplate: null, emailReplyToAlias: null,
  parameterDefinitionJson: "[\"schoolName\",\"notificationTitle\"]"
};
const campaignSnapshot = JSON.stringify({
  campaignNumber: campaign.campaignNumber, category: campaign.category, priority: campaign.priority,
  title: campaign.title, audienceType: campaign.audienceType,
  audienceSnapshotJson: campaign.audienceSnapshotJson, publishedAt: publishedAt.toISOString()
});
const templateSnapshot = JSON.stringify({
  mappingCode: mapping.mappingCode, channel: mapping.channel, providerStatus: mapping.providerStatus,
  smsPrincipalEntityReference: mapping.smsPrincipalEntityReference, smsHeader: mapping.smsHeader,
  smsDltTemplateId: mapping.smsDltTemplateId, smsTemplateText: mapping.smsTemplateText,
  emailSenderAlias: null, emailSubjectTemplate: null, emailTextTemplate: null,
  emailReplyToAlias: null, parameterDefinitionJson: mapping.parameterDefinitionJson
});

describe("Prompt 19C immutable approval snapshots", () => {
  it("accepts unchanged published-campaign and approved-template snapshots", () => {
    expect(() => assertSmsEmailBatchSnapshotsCurrent({
      notificationCampaign: campaign, templateMapping: mapping,
      notificationCampaignSnapshotJson: campaignSnapshot, templateSnapshotJson: templateSnapshot
    })).not.toThrow();
  });

  it("blocks changed DLT content or identity after batch creation", () => {
    for (const templateMapping of [
      { ...mapping, smsTemplateText: "Changed content" },
      { ...mapping, smsHeader: "OTHER" },
      { ...mapping, smsDltTemplateId: "DLT-2" }
    ]) {
      expect(() => assertSmsEmailBatchSnapshotsCurrent({
        notificationCampaign: campaign, templateMapping,
        notificationCampaignSnapshotJson: campaignSnapshot, templateSnapshotJson: templateSnapshot
      })).toThrow(/template mapping changed/i);
    }
  });

  it("blocks published Prompt 19A campaign drift after batch creation", () => {
    expect(() => assertSmsEmailBatchSnapshotsCurrent({
      notificationCampaign: { ...campaign, title: "Changed update" }, templateMapping: mapping,
      notificationCampaignSnapshotJson: campaignSnapshot, templateSnapshotJson: templateSnapshot
    })).toThrow(/campaign changed/i);
  });
});
