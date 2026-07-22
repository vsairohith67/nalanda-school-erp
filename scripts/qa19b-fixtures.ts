import { prisma } from "@/lib/prisma";
import { approveNotificationCampaign, createNotificationCampaign, publishOrScheduleNotificationCampaign, submitNotificationCampaign } from "@/lib/notification-campaigns";
import {
  approveWhatsAppBatch,
  createWhatsAppBatch,
  overrideWhatsAppCostCap,
  previewWhatsAppBatch,
  queueWhatsAppBatch,
  submitWhatsAppBatch
} from "@/lib/whatsapp-batches";
import { recordWhatsAppConsent, optOutWhatsAppConsent } from "@/lib/whatsapp-consents";
import { ensureWhatsAppRateReferences } from "@/lib/whatsapp-costs";

const MARKER = "QA19B";
const PROFILE = "QA19B_MOCK";

async function cleanup() {
  const profileIds = (await prisma.whatsAppIntegrationProfile.findMany({ where: { profileCode: { startsWith: MARKER } }, select: { id: true } })).map((row) => row.id);
  const batchIds = (await prisma.whatsAppOutboundBatch.findMany({ where: { integrationProfileId: { in: profileIds } }, select: { id: true } })).map((row) => row.id);
  const deliveryIds = (await prisma.whatsAppDelivery.findMany({ where: { batchId: { in: batchIds } }, select: { id: true } })).map((row) => row.id);
  await prisma.whatsAppOperationalEvent.deleteMany({ where: { OR: [{ integrationProfileId: { in: profileIds } }, { batchId: { in: batchIds } }] } });
  await prisma.whatsAppWebhookEvent.deleteMany({ where: { OR: [{ integrationProfileId: { in: profileIds } }, { deliveryId: { in: deliveryIds } }] } });
  await prisma.whatsAppDeliveryAttempt.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await prisma.whatsAppDelivery.deleteMany({ where: { id: { in: deliveryIds } } });
  await prisma.whatsAppOutboundBatch.deleteMany({ where: { id: { in: batchIds } } });
  const qaConsentSubjects = [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19b-" } }];
  await prisma.whatsAppConsentEvent.deleteMany({ where: { consent: { OR: qaConsentSubjects } } });
  await prisma.whatsAppConsent.deleteMany({ where: { OR: qaConsentSubjects } });
  await prisma.whatsAppTemplateMapping.deleteMany({ where: { integrationProfileId: { in: profileIds } } });
  await prisma.whatsAppRateReference.deleteMany({ where: { integrationProfileId: { in: profileIds } } });
  await prisma.whatsAppIntegrationProfile.deleteMany({ where: { id: { in: profileIds } } });
  await prisma.staffMember.deleteMany({ where: { id: { startsWith: "qa19b-" } } });
  const campaigns = await prisma.notificationCampaign.findMany({ where: { title: { startsWith: MARKER } }, select: { id: true } });
  const campaignIds = campaigns.map((row) => row.id);
  await prisma.notificationEvent.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationSkippedRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationCampaign.deleteMany({ where: { id: { in: campaignIds } } });
}

async function setup() {
  await cleanup();
  const [director, principal, admin, accountant, parent, unrelatedParent, teacher] = await Promise.all([
    user("qa19a-director"), user("qa19a-principal"), user("qa19a-admin"), user("qa19a-accountant"), user("qa19a-parent"), user("qa19a-parent-unrelated"), user("qa19a-teacher")
  ]);
  await prisma.staffMember.update({ where: { id: "qa19a-staff-teacher" }, data: { mobile: "+919000001914" } });
  await prisma.staffMember.update({ where: { id: "qa19a-staff-peer" }, data: { mobile: "+919000001915" } });
  await prisma.staffMember.create({ data: {
    id: "qa19b-staff-accountant", staffCode: "QA19B-ACCOUNTANT", fullName: "QA19B Linked Accountant",
    designation: "Accountant", department: "Accounts", status: "ACTIVE", userId: accountant.id, mobile: "+919000001916"
  } });
  const profile = await prisma.whatsAppIntegrationProfile.create({ data: {
    profileCode: PROFILE, displayName: `${MARKER} deterministic mock`, provider: "META_CLOUD", mode: "MOCK",
    status: "ACTIVE", graphApiVersion: "v25.0", defaultCountryCode: "+91", timezone: "Asia/Kolkata",
    quietHoursStart: "21:00", quietHoursEnd: "06:00", maximumRetryCount: 3, workerChunkSize: 10,
    hourlyMessageLimit: 1, dailyMessageLimit: 10,
    costCapEnabled: true, maximumEstimatedBatchCostMinor: 1, costCapCurrency: "INR",
    liveSendingEnabled: false, lastHealthCheckAt: new Date(), lastHealthCheckStatus: "SUCCESS",
    lastHealthCheckMessage: "Deterministic MOCK provider ready"
  } });
  const mapping = await prisma.whatsAppTemplateMapping.create({ data: {
    mappingCode: "QA19B_GENERAL_UTILITY_EN", integrationProfileId: profile.id, notificationCategory: "GENERAL",
    internalPurpose: `${MARKER} operational fixture`, metaTemplateName: "qa19b_school_operational_update",
    metaTemplateLanguage: "en_US", metaTemplateCategory: "UTILITY", providerStatus: "APPROVED",
    parameterDefinitionJson: JSON.stringify(["school_name","campaign_title","recipient_label","child_context"]),
    status: "ACTIVE", createdByUserId: director.id, activatedByUserId: principal.id
  } });
  const parentConsent = await recordWhatsAppConsent(prisma, {
    subjectType: "GUARDIAN", explicitlyAgreed: true, confirmDefaultCountryCode: true, consentSource: "PAPER_FORM",
    guardianId: parent.guardianId, evidenceReference: `${MARKER}-PAPER-PARENT`
  }, director as never);
  const optedOut = await recordWhatsAppConsent(prisma, {
    subjectType: "GUARDIAN", explicitlyAgreed: true, confirmDefaultCountryCode: true, consentSource: "SCHOOL_OFFICE",
    guardianId: unrelatedParent.guardianId, evidenceReference: `${MARKER}-OFFICE-OPTOUT`
  }, admin as never);
  await optOutWhatsAppConsent(prisma, optedOut.id, director as never, `${MARKER} fixture opted out`);
  await recordWhatsAppConsent(prisma, {
    subjectType: "STAFF", explicitlyAgreed: true, confirmDefaultCountryCode: true, consentSource: "PAPER_FORM",
    staffMemberId: "qa19a-staff-teacher", evidenceReference: `${MARKER}-PAPER-STAFF`
  }, director as never);
  const campaign = await createNotificationCampaign(prisma, {
    category: "GENERAL", priority: "NORMAL", title: `${MARKER} One-Way Operational Update`,
    body: `${MARKER} approved in-app source; WhatsApp uses only the mapped template parameters.`,
    audienceType: "SPECIFIC_USERS", audienceDefinition: { userIds: [parent.id, unrelatedParent.id, teacher.id] },
    acknowledgmentRequired: false
  }, director as never);
  await submitNotificationCampaign(prisma, campaign.id, director as never);
  await approveNotificationCampaign(prisma, campaign.id, principal as never);
  const published = await publishOrScheduleNotificationCampaign(prisma, campaign.id, director as never, "publish", null);
  await ensureWhatsAppRateReferences(prisma, profile.id);
  const batch = await createWhatsAppBatch(prisma, {
    notificationCampaignId: published.id, integrationProfileId: profile.id, templateMappingId: mapping.id
  }, admin as never);
  const preview = await previewWhatsAppBatch(prisma, batch.id);
  console.log(JSON.stringify({
    marker: MARKER,
    profile: { id: profile.id, code: profile.profileCode, mode: profile.mode, liveSendingEnabled: profile.liveSendingEnabled },
    mapping: { id: mapping.id, code: mapping.mappingCode, status: mapping.status, providerStatus: mapping.providerStatus },
    campaign: { id: published.id, number: published.campaignNumber, status: published.status },
    batch: { id: batch.id, number: batch.batchNumber, status: "PREVIEWED" },
    parentConsent: parentConsent.id,
    preview,
    credentials: { usernames: ["qa19a-director","qa19a-principal","qa19a-admin","qa19a-accountant","qa19a-viewer","qa19a-parent","qa19a-parent-unrelated","qa19a-teacher","qa19a-teacher-unlinked"], password: "Qa19aNotify@2026" }
  }, null, 2));
}

async function inspect() {
  const profileIds = (await prisma.whatsAppIntegrationProfile.findMany({ where: { profileCode: { startsWith: MARKER } }, select: { id: true } })).map((row) => row.id);
  const batchIds = (await prisma.whatsAppOutboundBatch.findMany({ where: { integrationProfileId: { in: profileIds } }, select: { id: true } })).map((row) => row.id);
  const deliveryIds = (await prisma.whatsAppDelivery.findMany({ where: { batchId: { in: batchIds } }, select: { id: true } })).map((row) => row.id);
  const operationalEventBreakdown = await prisma.whatsAppOperationalEvent.groupBy({
    by: ["eventType"],
    where: { integrationProfileId: { in: profileIds } },
    _count: { _all: true },
    _sum: { occurrenceCount: true }
  });
  console.log(JSON.stringify({
    profiles: profileIds.length,
    mappings: await prisma.whatsAppTemplateMapping.count({ where: { integrationProfileId: { in: profileIds } } }),
    consents: await prisma.whatsAppConsent.count({ where: { OR: [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19b-" } }] } }),
    batches: batchIds.length,
    deliveries: deliveryIds.length,
    attempts: await prisma.whatsAppDeliveryAttempt.count({ where: { deliveryId: { in: deliveryIds } } }),
    webhooks: await prisma.whatsAppWebhookEvent.count({ where: { integrationProfileId: { in: profileIds } } }),
    operationalEvents: await prisma.whatsAppOperationalEvent.count({ where: { integrationProfileId: { in: profileIds } } }),
    operationalEventBreakdown,
    linkedAccountantStaff: await prisma.staffMember.count({ where: { id: { startsWith: "qa19b-" } } }),
    liveProfiles: await prisma.whatsAppIntegrationProfile.count({ where: { id: { in: profileIds }, mode: "LIVE" } }),
    finance: {
      payments: await prisma.payment.count({ where: { remarks: { contains: MARKER } } }),
      expenses: await prisma.expenseRecord.count({ where: { description: { contains: MARKER } } }),
      miscIncome: await prisma.miscIncomeReceipt.count({ where: { remarks: { contains: MARKER } } })
    }
  }, null, 2));
}

async function configureLimits() {
  const hourlyMessageLimit = nullablePositiveInteger(process.argv[3], "hourly limit");
  const dailyMessageLimit = nullablePositiveInteger(process.argv[4], "daily limit");
  const profile = await prisma.whatsAppIntegrationProfile.findUnique({ where: { profileCode: PROFILE } });
  if (!profile || profile.mode !== "MOCK" || profile.liveSendingEnabled) {
    throw new Error("QA19B limit configuration is allowed only for the expected MOCK profile with LIVE disabled.");
  }
  const updated = await prisma.whatsAppIntegrationProfile.update({
    where: { id: profile.id },
    data: { hourlyMessageLimit, dailyMessageLimit }
  });
  console.log(JSON.stringify({
    profileCode: updated.profileCode,
    mode: updated.mode,
    liveSendingEnabled: updated.liveSendingEnabled,
    hourlyMessageLimit: updated.hourlyMessageLimit,
    dailyMessageLimit: updated.dailyMessageLimit
  }, null, 2));
}

async function createQueuedBatch() {
  const label = String(process.argv[3] ?? "").trim();
  if (!/^QA19B[A-Z0-9_-]*$/i.test(label)) throw new Error("A QA19B-prefixed batch label is required.");
  const [profile, mapping, campaign, admin, director] = await Promise.all([
    prisma.whatsAppIntegrationProfile.findUnique({ where: { profileCode: PROFILE } }),
    prisma.whatsAppTemplateMapping.findFirst({ where: { mappingCode: { startsWith: MARKER }, status: "ACTIVE" } }),
    prisma.notificationCampaign.findFirst({ where: { title: { startsWith: MARKER }, status: "PUBLISHED" }, orderBy: { createdAt: "asc" } }),
    user("qa19a-admin"),
    user("qa19a-director")
  ]);
  if (!profile || profile.mode !== "MOCK" || profile.liveSendingEnabled || !mapping || !campaign) {
    throw new Error("Expected QA19B MOCK profile, mapping, and published campaign were not found.");
  }
  const batch = await createWhatsAppBatch(prisma, {
    notificationCampaignId: campaign.id,
    integrationProfileId: profile.id,
    templateMappingId: mapping.id
  }, admin as never);
  await previewWhatsAppBatch(prisma, batch.id);
  await submitWhatsAppBatch(prisma, batch.id);
  if (profile.costCapEnabled && profile.maximumEstimatedBatchCostMinor != null) {
    await overrideWhatsAppCostCap(prisma, batch.id, director as never, `${label} authorised MOCK cost-cap exercise`);
  }
  await approveWhatsAppBatch(prisma, batch.id, director as never, `${label} QA approval`);
  const queued = await queueWhatsAppBatch(prisma, batch.id, director as never);
  console.log(JSON.stringify({
    id: queued.id,
    batchNumber: queued.batchNumber,
    status: queued.status,
    label,
    mode: profile.mode,
    liveSendingEnabled: profile.liveSendingEnabled
  }, null, 2));
}

async function setAccountantLink() {
  const state = process.argv[3];
  if (!["on", "off"].includes(state)) throw new Error("Use accountant-link on or accountant-link off.");
  const accountant = await user("qa19a-accountant");
  const staff = await prisma.staffMember.findUnique({ where: { id: "qa19b-staff-accountant" } });
  if (!staff || !staff.staffCode?.startsWith(MARKER)) throw new Error("QA19B Accountant StaffMember was not found.");
  await prisma.staffMember.update({
    where: { id: staff.id },
    data: { userId: state === "on" ? accountant.id : null }
  });
  console.log(JSON.stringify({ staffMemberId: staff.id, accountantUsername: accountant.username, linked: state === "on" }, null, 2));
}

function nullablePositiveInteger(value: string | undefined, label: string) {
  if (value === "null") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer or null.`);
  return parsed;
}

async function user(username: string) {
  const row = await prisma.user.findUnique({ where: { username }, select: { id: true, name: true, username: true, email: true, role: true, guardianId: true } });
  if (!row) throw new Error(`Run pnpm.cmd qa19a:fixtures setup first; ${username} is missing.`);
  return row;
}
async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") await cleanup();
  else if (action === "inspect") await inspect();
  else if (action === "configure-limits") await configureLimits();
  else if (action === "create-queued") await createQueuedBatch();
  else if (action === "accountant-link") await setAccountantLink();
  else throw new Error("Use setup, inspect, cleanup, configure-limits, create-queued, or accountant-link.");
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "QA19B fixture failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
