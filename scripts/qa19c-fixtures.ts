import { prisma } from "@/lib/prisma";
import {
  approveNotificationCampaign,
  createNotificationCampaign,
  publishOrScheduleNotificationCampaign,
  submitNotificationCampaign
} from "@/lib/notification-campaigns";
import {
  approveSmsEmailBatch,
  createSmsEmailBatch,
  overrideSmsEmailCostCap,
  previewSmsEmailBatch,
  queueSmsEmailBatch,
  retrySmsEmailBatch,
  submitSmsEmailBatch
} from "@/lib/sms-email-batches";
import { recordSmsEmailConsent, optOutSmsEmailConsent } from "@/lib/sms-email-consents";
import { signMockSmsEmailWebhook } from "@/lib/sms-email-provider";
import { processSmsEmailWebhook, safeSmsEmailWebhookFixture } from "@/lib/sms-email-webhooks";
import { processSmsEmailQueue } from "@/lib/sms-email-worker";

const MARKER = "QA19C";

async function cleanup() {
  const profiles = await prisma.smsEmailIntegrationProfile.findMany({
    where: { profileCode: { startsWith: MARKER } }, select: { id: true }
  });
  const profileIds = profiles.map((row) => row.id);
  const batches = await prisma.smsEmailOutboundBatch.findMany({
    where: { integrationProfileId: { in: profileIds } }, select: { id: true }
  });
  const batchIds = batches.map((row) => row.id);
  const deliveries = await prisma.smsEmailDelivery.findMany({
    where: { batchId: { in: batchIds } }, select: { id: true }
  });
  const deliveryIds = deliveries.map((row) => row.id);
  const consentRows = await prisma.smsEmailConsent.findMany({
    where: { OR: [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }] },
    select: { id: true }
  });
  const consentIds = consentRows.map((row) => row.id);

  await prisma.smsEmailWebhookEvent.deleteMany({ where: { OR: [{ integrationProfileId: { in: profileIds } }, { deliveryId: { in: deliveryIds } }] } });
  await prisma.smsEmailDeliveryAttempt.deleteMany({ where: { deliveryId: { in: deliveryIds } } });
  await prisma.smsEmailOperationalEvent.deleteMany({ where: { OR: [{ integrationProfileId: { in: profileIds } }, { batchId: { in: batchIds } }] } });
  await prisma.smsEmailDelivery.deleteMany({ where: { id: { in: deliveryIds } } });
  await prisma.smsEmailOutboundBatch.deleteMany({ where: { id: { in: batchIds } } });
  await prisma.smsEmailConsentEvent.deleteMany({ where: { consentId: { in: consentIds } } });
  await prisma.smsEmailConsent.deleteMany({ where: { id: { in: consentIds } } });
  await prisma.smsEmailSuppression.deleteMany({ where: { OR: [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }] } });
  await prisma.smsEmailCostRate.deleteMany({ where: { integrationProfileId: { in: profileIds } } });
  await prisma.smsEmailTemplateMapping.deleteMany({ where: { integrationProfileId: { in: profileIds } } });
  await prisma.smsEmailIntegrationProfile.deleteMany({ where: { id: { in: profileIds } } });

  const campaignIds = (await prisma.notificationCampaign.findMany({
    where: { title: { startsWith: MARKER } }, select: { id: true }
  })).map((row) => row.id);
  const recipientIds = (await prisma.notificationRecipient.findMany({
    where: { campaignId: { in: campaignIds } }, select: { id: true }
  })).map((row) => row.id);
  await prisma.notificationEvent.deleteMany({ where: { OR: [{ campaignId: { in: campaignIds } }, { recipientId: { in: recipientIds } }] } });
  await prisma.notificationSkippedRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationRecipient.deleteMany({ where: { campaignId: { in: campaignIds } } });
  await prisma.notificationCampaign.deleteMany({ where: { id: { in: campaignIds } } });

  await prisma.guardian.updateMany({
    where: { id: "qa19a-guardian-linked" },
    data: { primaryMobile: "9000001911", email: null }
  });
  await prisma.guardian.updateMany({
    where: { id: "qa19a-guardian-unrelated" },
    data: { primaryMobile: "9000001912", email: null }
  });
  await prisma.staffMember.updateMany({
    where: { id: "qa19a-staff-teacher" },
    data: { mobile: null, email: null }
  });
}

async function setup() {
  await cleanup();
  const [director, principal, admin, parent, unrelatedParent, teacher] = await Promise.all([
    user("qa19a-director"), user("qa19a-principal"), user("qa19a-admin"),
    user("qa19a-parent"), user("qa19a-parent-unrelated"), user("qa19a-teacher")
  ]);
  if (!parent.guardianId || !unrelatedParent.guardianId) throw new Error("QA19A Parent ownership fixtures are missing.");

  await prisma.guardian.update({
    where: { id: parent.guardianId },
    data: { primaryMobile: "+919100001901", email: "qa19c.parent@example.invalid" }
  });
  await prisma.guardian.update({
    where: { id: unrelatedParent.guardianId },
    data: { primaryMobile: "+919100001902", email: "qa19c.unrelated@example.invalid" }
  });
  await prisma.staffMember.update({
    where: { id: "qa19a-staff-teacher" },
    data: { mobile: "+919100001903", email: "qa19c.teacher@example.invalid" }
  });

  const sms = await prisma.smsEmailIntegrationProfile.create({ data: {
    profileCode: "QA19C_MOCK_SMS", channel: "SMS", providerKind: "MOCK_SMS",
    displayName: "QA19C deterministic MOCK SMS", mode: "MOCK", status: "ACTIVE",
    defaultCountryCode: "+91", timezone: "Asia/Kolkata", quietHoursStart: "21:00", quietHoursEnd: "06:00",
    hourlyLimit: 10, dailyLimit: 50, workerChunkSize: 10, maximumRetryCount: 3,
    liveSendingEnabled: false, costCapEnabled: true, maximumEstimatedBatchCostMinor: 1,
    costCapCurrency: "INR", dltPrincipalEntityReference: "QA19C-PE", dltHeaderReference: "NALNDA",
    lastHealthCheckAt: new Date(), lastHealthCheckStatus: "SUCCESS",
    lastHealthCheckMessage: "Deterministic MOCK SMS provider is ready."
  } });
  const email = await prisma.smsEmailIntegrationProfile.create({ data: {
    profileCode: "QA19C_MOCK_EMAIL", channel: "EMAIL", providerKind: "MOCK_EMAIL",
    displayName: "QA19C deterministic MOCK Email", mode: "MOCK", status: "ACTIVE",
    senderIdentityMasked: "q***@nalandaps.com", senderDomain: "nalandaps.com",
    timezone: "Asia/Kolkata", quietHoursStart: "21:00", quietHoursEnd: "06:00",
    hourlyLimit: 10, dailyLimit: 50, workerChunkSize: 10, maximumRetryCount: 3,
    liveSendingEnabled: false, costCapEnabled: true, maximumEstimatedBatchCostMinor: 1,
    costCapCurrency: "INR", spfStatus: "UNKNOWN", dkimStatus: "UNKNOWN",
    dmarcStatus: "UNKNOWN", senderAliasStatus: "UNKNOWN",
    lastHealthCheckAt: new Date(), lastHealthCheckStatus: "SUCCESS",
    lastHealthCheckMessage: "Deterministic MOCK Email provider is ready."
  } });

  const [smsMapping, emailMapping] = await Promise.all([
    prisma.smsEmailTemplateMapping.create({ data: {
      mappingCode: "QA19C_SMS_GENERAL", integrationProfileId: sms.id, channel: "SMS",
      notificationCategory: "GENERAL", internalPurpose: "QA19C school operational update",
      status: "ACTIVE", providerStatus: "APPROVED", smsPrincipalEntityReference: "QA19C-PE",
      smsHeader: "NALNDA", smsDltTemplateId: "QA19C-DLT-1", smsTemplateCategory: "SERVICE",
      smsTemplateText: "{{schoolName}}: {{notificationTitle}}. {{safeInternalPortalLabel}}",
      parameterDefinitionJson: JSON.stringify(["schoolName", "notificationTitle", "safeInternalPortalLabel"]),
      createdByUserId: admin.id, activatedByUserId: principal.id
    } }),
    prisma.smsEmailTemplateMapping.create({ data: {
      mappingCode: "QA19C_EMAIL_GENERAL", integrationProfileId: email.id, channel: "EMAIL",
      notificationCategory: "GENERAL", internalPurpose: "QA19C school operational update",
      status: "ACTIVE", providerStatus: "APPROVED", emailSenderAlias: "qa19c@nalandaps.com",
      emailSubjectTemplate: "{{schoolName}}: {{notificationTitle}}",
      emailTextTemplate: "{{notificationBody}}\n\nPlease use {{safeInternalPortalLabel}} for school details.",
      parameterDefinitionJson: JSON.stringify(["schoolName", "notificationTitle", "notificationBody", "safeInternalPortalLabel"]),
      createdByUserId: admin.id, activatedByUserId: principal.id
    } })
  ]);

  for (const channel of ["SMS", "EMAIL"] as const) {
    await recordSmsEmailConsent(prisma, {
      channel, subjectType: "GUARDIAN", guardianId: parent.guardianId,
      explicitlyAgreed: true, consentSource: "PAPER_FORM", evidenceReference: `${MARKER}-${channel}-PARENT`
    }, director as never);
    await recordSmsEmailConsent(prisma, {
      channel, subjectType: "STAFF", staffMemberId: "qa19a-staff-teacher",
      explicitlyAgreed: true, consentSource: "PAPER_FORM", evidenceReference: `${MARKER}-${channel}-STAFF`
    }, director as never);
    const optedOut = await recordSmsEmailConsent(prisma, {
      channel, subjectType: "GUARDIAN", guardianId: unrelatedParent.guardianId,
      explicitlyAgreed: true, consentSource: "SCHOOL_OFFICE", evidenceReference: `${MARKER}-${channel}-OPTOUT`
    }, director as never);
    await optOutSmsEmailConsent(prisma, optedOut.id, director as never, `${MARKER} fixture opted out`);
  }

  const campaign = await createNotificationCampaign(prisma, {
    category: "GENERAL", priority: "NORMAL", title: `${MARKER} One-Way Operational Update`,
    body: `${MARKER} approved in-app source for deterministic SMS and Email MOCK QA.`,
    audienceType: "SPECIFIC_USERS", audienceDefinition: { userIds: [parent.id, unrelatedParent.id, teacher.id] },
    acknowledgmentRequired: false
  }, director as never);
  await submitNotificationCampaign(prisma, campaign.id, admin as never);
  await approveNotificationCampaign(prisma, campaign.id, principal as never);
  const published = await publishOrScheduleNotificationCampaign(prisma, campaign.id, director as never, "publish", null);

  await prisma.smsEmailCostRate.createMany({ data: [
    { integrationProfileId: sms.id, channel: "SMS", providerKind: "MOCK_SMS", market: "India", messageCategory: "SERVICE", encodingType: "GSM_COMPATIBLE", currency: "INR", rateMinor: 2, unit: "SMS_SEGMENT", rateVersion: "QA19C-R1", effectiveFrom: new Date("2026-07-18T00:00:00Z"), sourceReviewDate: new Date("2026-07-18T00:00:00Z"), notes: "QA estimate only" },
    { integrationProfileId: email.id, channel: "EMAIL", providerKind: "MOCK_EMAIL", market: "India", messageCategory: "OPERATIONAL", currency: "INR", rateMinor: 2, unit: "EMAIL_ACCEPTED", rateVersion: "QA19C-R1", effectiveFrom: new Date("2026-07-18T00:00:00Z"), sourceReviewDate: new Date("2026-07-18T00:00:00Z"), notes: "QA estimate only" }
  ] });

  const smsBatch = await createSmsEmailBatch(prisma, {
    notificationCampaignId: published.id, integrationProfileId: sms.id, templateMappingId: smsMapping.id
  }, admin as never);
  const emailBatch = await createSmsEmailBatch(prisma, {
    notificationCampaignId: published.id, integrationProfileId: email.id, templateMappingId: emailMapping.id
  }, admin as never);
  const [smsPreview, emailPreview] = await Promise.all([
    previewSmsEmailBatch(prisma, smsBatch.id),
    previewSmsEmailBatch(prisma, emailBatch.id)
  ]);

  console.log(JSON.stringify({
    marker: MARKER,
    credentials: { usernames: ["qa19a-director", "qa19a-principal", "qa19a-admin", "qa19a-viewer", "qa19a-parent", "qa19a-parent-unrelated", "qa19a-teacher"], password: "Qa19aNotify@2026" },
    profiles: [{ id: sms.id, code: sms.profileCode }, { id: email.id, code: email.profileCode }],
    mappings: [{ id: smsMapping.id, code: smsMapping.mappingCode }, { id: emailMapping.id, code: emailMapping.mappingCode }],
    campaign: { id: published.id, number: published.campaignNumber },
    batches: [{ id: smsBatch.id, number: smsBatch.batchNumber, preview: smsPreview }, { id: emailBatch.id, number: emailBatch.batchNumber, preview: emailPreview }],
    liveSendingEnabled: false
  }, null, 2));
}

async function inspect() {
  const profileIds = (await prisma.smsEmailIntegrationProfile.findMany({
    where: { profileCode: { startsWith: MARKER } }, select: { id: true }
  })).map((row) => row.id);
  const batchIds = (await prisma.smsEmailOutboundBatch.findMany({
    where: { integrationProfileId: { in: profileIds } }, select: { id: true }
  })).map((row) => row.id);
  const deliveryIds = (await prisma.smsEmailDelivery.findMany({
    where: { batchId: { in: batchIds } }, select: { id: true }
  })).map((row) => row.id);
  console.log(JSON.stringify({
    profiles: profileIds.length,
    liveProfiles: await prisma.smsEmailIntegrationProfile.count({ where: { id: { in: profileIds }, mode: "LIVE" } }),
    liveSendingEnabled: await prisma.smsEmailIntegrationProfile.count({ where: { id: { in: profileIds }, liveSendingEnabled: true } }),
    mappings: await prisma.smsEmailTemplateMapping.count({ where: { integrationProfileId: { in: profileIds } } }),
    consents: await prisma.smsEmailConsent.count({ where: { OR: [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }] } }),
    suppressions: await prisma.smsEmailSuppression.count({ where: { OR: [{ guardianId: { startsWith: "qa19a-" } }, { staffMemberId: { startsWith: "qa19a-" } }] } }),
    batches: batchIds.length,
    deliveries: deliveryIds.length,
    attempts: await prisma.smsEmailDeliveryAttempt.count({ where: { deliveryId: { in: deliveryIds } } }),
    webhooks: await prisma.smsEmailWebhookEvent.count({ where: { integrationProfileId: { in: profileIds } } }),
    operationalEvents: await prisma.smsEmailOperationalEvent.count({ where: { integrationProfileId: { in: profileIds } } }),
    finance: {
      payments: await prisma.payment.count({ where: { remarks: { contains: MARKER } } }),
      expenses: await prisma.expenseRecord.count({ where: { description: { contains: MARKER } } }),
      miscIncome: await prisma.miscIncomeReceipt.count({ where: { remarks: { contains: MARKER } } })
    }
  }, null, 2));
}

async function changeContacts() {
  await prisma.guardian.update({
    where: { id: "qa19a-guardian-linked" },
    data: { primaryMobile: "+919100001911", email: "qa19c.changed@example.invalid" }
  });
  console.log(JSON.stringify({
    guardianId: "qa19a-guardian-linked",
    phone: "+91 ••••••1911",
    email: "q***@example.invalid",
    realContactsUsed: false
  }, null, 2));
}

async function exercise() {
  const [director, principal] = await Promise.all([user("qa19a-director"), user("qa19a-principal")]);
  const batches = await prisma.smsEmailOutboundBatch.findMany({
    where: { integrationProfile: { profileCode: { startsWith: MARKER } } },
    include: { integrationProfile: true },
    orderBy: { channel: "asc" }
  });
  if (batches.length !== 2 || batches.some((row) => row.status !== "PREVIEWED")) {
    throw new Error("Run a fresh qa19c:fixtures setup before exercise.");
  }
  for (const batch of batches) {
    await submitSmsEmailBatch(prisma, batch.id);
    await overrideSmsEmailCostCap(prisma, batch.id, director as never, `${MARKER} deterministic cost-cap QA`);
    await approveSmsEmailBatch(prisma, batch.id, principal as never, `${MARKER} independent approval QA`);
    await queueSmsEmailBatch(prisma, batch.id, director as never);
  }
  const firstWorker = await processSmsEmailQueue(prisma, { limit: 10 });
  const repeatWorker = await processSmsEmailQueue(prisma, { limit: 10 });
  const deliveries = await prisma.smsEmailDelivery.findMany({
    where: { batchId: { in: batches.map((row) => row.id) } },
    orderBy: [{ channel: "asc" }, { createdAt: "asc" }]
  });
  const byChannel = {
    EMAIL: deliveries.filter((row) => row.channel === "EMAIL"),
    SMS: deliveries.filter((row) => row.channel === "SMS")
  };
  if (byChannel.EMAIL.length !== 2 || byChannel.SMS.length !== 2 || deliveries.some((row) => !row.providerMessageId)) {
    throw new Error("Expected two deterministic MOCK deliveries per channel.");
  }
  const webhook = async (profileCode: string, fixture: object) => {
    const raw = JSON.stringify(fixture);
    return processSmsEmailWebhook(prisma, profileCode, raw, signMockSmsEmailWebhook(raw));
  };
  await webhook("QA19C_MOCK_EMAIL", safeSmsEmailWebhookFixture("EMAIL", byChannel.EMAIL[0].providerMessageId!, "DELIVERED", "QA19C:EMAIL:DELIVERED"));
  await webhook("QA19C_MOCK_EMAIL", safeSmsEmailWebhookFixture("EMAIL", byChannel.EMAIL[1].providerMessageId!, "BOUNCED", "QA19C:EMAIL:BOUNCED"));
  await webhook("QA19C_MOCK_SMS", safeSmsEmailWebhookFixture("SMS", byChannel.SMS[0].providerMessageId!, "DELIVERED", "QA19C:SMS:DELIVERED"));
  await webhook("QA19C_MOCK_SMS", {
    events: [{
      eventKey: "QA19C:SMS:RETRYABLE", providerMessageId: byChannel.SMS[1].providerMessageId,
      status: "FAILED", retryable: true, reasonCode: "MOCK_TRANSIENT"
    }]
  });
  const smsBatch = batches.find((row) => row.channel === "SMS")!;
  const retried = await retrySmsEmailBatch(prisma, smsBatch.id);
  const retryWorker = await processSmsEmailQueue(prisma, { limit: 10 });
  const finalBatches = await prisma.smsEmailOutboundBatch.findMany({
    where: { id: { in: batches.map((row) => row.id) } },
    select: {
      batchNumber: true, channel: true, status: true, totalAccepted: true, totalSent: true,
      totalDelivered: true, totalBounced: true, totalFailed: true
    },
    orderBy: { channel: "asc" }
  });
  console.log(JSON.stringify({
    mockOnly: true,
    firstWorker: { inspected: firstWorker.inspected, processed: firstWorker.processed },
    repeatedWorker: { inspected: repeatWorker.inspected, processed: repeatWorker.processed },
    retry: { queued: retried.count, inspected: retryWorker.inspected, processed: retryWorker.processed },
    attempts: await prisma.smsEmailDeliveryAttempt.count({ where: { deliveryId: { in: deliveries.map((row) => row.id) } } }),
    webhooks: await prisma.smsEmailWebhookEvent.count({ where: { integrationProfileId: { in: batches.map((row) => row.integrationProfileId) } } }),
    suppressions: await prisma.smsEmailSuppression.count({ where: { guardianId: { startsWith: "qa19a-" } } }),
    batches: finalBatches
  }, null, 2));
}

async function user(username: string) {
  const row = await prisma.user.findUnique({
    where: { username },
    select: { id: true, name: true, username: true, email: true, role: true, guardianId: true }
  });
  if (!row) throw new Error(`Run pnpm.cmd qa19a:fixtures setup first; ${username} is missing.`);
  return row;
}

async function main() {
  const action = process.argv[2];
  if (action === "setup") await setup();
  else if (action === "cleanup") { await cleanup(); await inspect(); }
  else if (action === "inspect") await inspect();
  else if (action === "change-contacts") await changeContacts();
  else if (action === "exercise") await exercise();
  else throw new Error("Use setup, exercise, change-contacts, inspect, or cleanup.");
}

main()
  .catch((error) => { console.error(error instanceof Error ? error.message : "QA19C fixture failed."); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
