import { createHash, randomUUID } from "node:crypto";
import type { AuthUser } from "@/lib/auth";
import { resolveWhatsAppAudience, safeWhatsAppAudiencePreview } from "@/lib/whatsapp-audiences";
import { ensureWhatsAppRateReferences, estimateWhatsAppBatchCost } from "@/lib/whatsapp-costs";
import { assertWhatsAppProfileCanSend } from "@/lib/whatsapp-profiles";
import { renderWhatsAppTemplateParameters } from "@/lib/whatsapp-template-mappings";
import { operationalEventKey, recordWhatsAppOperationalEvent } from "@/lib/whatsapp-operational-events";

export const WHATSAPP_SKIP_REASONS = [
  "NO_GUARDIAN_CONTEXT", "NO_STAFF_CONTEXT", "NO_PHONE", "INVALID_PHONE", "MISSING_COUNTRY_CODE",
  "AMBIGUOUS_PHONE", "NO_CONSENT", "OPTED_OUT", "CONSENT_EXPIRED", "PHONE_CHANGED_AFTER_CONSENT",
  "DUPLICATE_CONTACT", "TEMPLATE_NOT_APPROVED", "UNSUPPORTED_RECIPIENT", "PROFILE_INACTIVE",
  "LIVE_SENDING_DISABLED", "QUIET_HOURS", "RATE_LIMIT", "CANCELLED"
] as const;

const WORKFLOW: Record<string, readonly string[]> = {
  DRAFT: ["preview", "cancel"],
  PREVIEWED: ["preview", "submit", "cancel"],
  READY_FOR_APPROVAL: ["approve", "cancel"],
  APPROVED: ["send", "schedule", "cancel"],
  SCHEDULED: ["cancel"],
  QUEUED: ["cancel"],
  PROCESSING: ["cancel"],
  PARTIALLY_FAILED: ["retry", "cancel"],
  FAILED: ["retry", "cancel"]
};

export function newWhatsAppBatchNumber(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(now).replaceAll("-", "");
  return `WA-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createWhatsAppBatch(client: any, input: any, actor: AuthUser) {
  const [campaign, profile, mapping] = await Promise.all([
    client.notificationCampaign.findUnique({ where: { id: required(input?.notificationCampaignId, "Notification campaign") } }),
    client.whatsAppIntegrationProfile.findUnique({ where: { id: required(input?.integrationProfileId, "Integration profile") } }),
    client.whatsAppTemplateMapping.findUnique({ where: { id: required(input?.templateMappingId, "Template mapping") } })
  ]);
  if (!campaign || campaign.status !== "PUBLISHED" || !campaign.publishedAt) throw new Error("Only a published Prompt 19A campaign can be used.");
  if (!profile) throw new Error("WhatsApp integration profile was not found.");
  if (!mapping || mapping.integrationProfileId !== profile.id) throw new Error("Template mapping does not belong to the selected profile.");
  assertMappingReady(mapping, campaign);
  const campaignSnapshot = {
    campaignNumber: campaign.campaignNumber,
    category: campaign.category,
    priority: campaign.priority,
    title: campaign.title,
    audienceType: campaign.audienceType,
    audienceSnapshotJson: campaign.audienceSnapshotJson,
    publishedAt: campaign.publishedAt.toISOString()
  };
  const mappingSnapshot = {
    mappingCode: mapping.mappingCode,
    metaTemplateName: mapping.metaTemplateName,
    metaTemplateLanguage: mapping.metaTemplateLanguage,
    metaTemplateCategory: mapping.metaTemplateCategory,
    parameterDefinitionJson: mapping.parameterDefinitionJson,
    providerStatus: mapping.providerStatus
  };
  return client.whatsAppOutboundBatch.create({ data: {
    batchNumber: newWhatsAppBatchNumber(),
    integrationProfileId: profile.id,
    notificationCampaignId: campaign.id,
    notificationCampaignSnapshotJson: JSON.stringify(campaignSnapshot),
    templateMappingId: mapping.id,
    templateMappingSnapshotJson: JSON.stringify(mappingSnapshot),
    status: "DRAFT",
    createdByUserId: actor.id
  } });
}

export async function previewWhatsAppBatch(client: any, id: string) {
  const batch = await requiredBatch(client, id);
  assertAction(batch, "preview");
  const result = await resolveWhatsAppAudience(client, batch.notificationCampaignId, batch.integrationProfileId);
  const mapping = await client.whatsAppTemplateMapping.findUnique({ where: { id: batch.templateMappingId } });
  if (!mapping) throw new Error("Template mapping was not found.");
  assertMappingReady(mapping, result.campaign);
  await ensureWhatsAppRateReferences(client, batch.integrationProfileId);
  const estimate = await estimateWhatsAppBatchCost(client, result.eligible.length, mapping.metaTemplateCategory);
  await client.whatsAppOutboundBatch.update({ where: { id }, data: {
    status: "PREVIEWED",
    totalCampaignRecipients: result.campaign.recipients.length,
    totalEligibleContacts: result.eligible.length,
    totalSkipped: result.skipped.length,
    skipReasonCountsJson: JSON.stringify(skipReasonCounts(result.skipped)),
    estimatedCostMinor: estimate.estimatedCostMinor,
    estimatedCostCurrency: estimate.currency,
    estimateRateVersion: estimate.rateVersion
  } });
  return { ...safeWhatsAppAudiencePreview(result), estimate };
}

export async function submitWhatsAppBatch(client: any, id: string) {
  const batch = await requiredBatch(client, id);
  assertAction(batch, "submit");
  return client.whatsAppOutboundBatch.update({ where: { id }, data: { status: "READY_FOR_APPROVAL" } });
}

export async function approveWhatsAppBatch(client: any, id: string, actor: AuthUser, notes?: unknown) {
  const batch = await requiredBatch(client, id);
  assertAction(batch, "approve");
  if (batch.createdByUserId && batch.createdByUserId === actor.id) {
    throw new Error("The creator cannot approve their own WhatsApp batch.");
  }
  const current = await calculateCurrentEstimate(client, batch);
  await assertWhatsAppCostCap(client, batch, current, actor.id);
  return client.whatsAppOutboundBatch.update({ where: { id }, data: {
    status: "APPROVED", approvedByUserId: actor.id, approvedAt: new Date(),
    approvalNotes: optional(notes),
    totalCampaignRecipients: current.audience.campaign.recipients.length,
    totalEligibleContacts: current.audience.eligible.length,
    totalSkipped: current.audience.skipped.length,
    skipReasonCountsJson: JSON.stringify(skipReasonCounts(current.audience.skipped)),
    estimatedCostMinor: current.estimate.estimatedCostMinor,
    estimatedCostCurrency: current.estimate.currency,
    estimateRateVersion: current.estimate.rateVersion
  } });
}

export async function overrideWhatsAppCostCap(client: any, id: string, actor: AuthUser, reason: unknown) {
  if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can override the estimated WhatsApp cost cap.");
  const batch = await requiredBatch(client, id);
  if (!["PREVIEWED", "READY_FOR_APPROVAL"].includes(batch.status)) throw new Error(`Cost-cap override is not allowed from ${batch.status}.`);
  const safeReason = required(reason, "Cost-cap override reason").slice(0, 500);
  const current = await calculateCurrentEstimate(client, batch);
  const cap = current.cap;
  if (!cap.enabled || cap.limitMinor == null || current.estimate.estimatedCostMinor == null || current.estimate.estimatedCostMinor <= cap.limitMinor) {
    throw new Error("The current estimated batch cost does not exceed an enabled cost cap.");
  }
  if (batch.costCapOverrideSnapshotHash === current.snapshotHash) return batch;
  return client.$transaction(async (tx: any) => {
    const updated = await tx.whatsAppOutboundBatch.update({ where: { id }, data: {
      costCapOverrideSnapshotHash: current.snapshotHash,
      costCapOverrideReason: safeReason,
      costCapOverrideEstimateMinor: current.estimate.estimatedCostMinor,
      costCapOverrideLimitMinor: cap.limitMinor,
      costCapOverrideCurrency: cap.currency,
      costCapOverrideRateVersion: current.estimate.rateVersion,
      costCapOverriddenAt: new Date(),
      costCapOverriddenByUserId: actor.id,
      estimatedCostMinor: current.estimate.estimatedCostMinor,
      estimatedCostCurrency: current.estimate.currency,
      estimateRateVersion: current.estimate.rateVersion,
      totalCampaignRecipients: current.audience.campaign.recipients.length,
      totalEligibleContacts: current.audience.eligible.length,
      totalSkipped: current.audience.skipped.length,
      skipReasonCountsJson: JSON.stringify(skipReasonCounts(current.audience.skipped))
    } });
    await recordWhatsAppOperationalEvent(tx, {
      integrationProfileId: batch.integrationProfileId, batchId: batch.id,
      eventKey: operationalEventKey(["COST_CAP_OVERRIDE_APPLIED", batch.id, current.snapshotHash]),
      eventType: "COST_CAP_OVERRIDE_APPLIED", safeReason,
      estimatedCostMinor: current.estimate.estimatedCostMinor, costCapMinor: cap.limitMinor,
      currency: cap.currency, rateVersion: current.estimate.rateVersion,
      snapshotHash: current.snapshotHash, recordedByUserId: actor.id
    });
    return updated;
  });
}

export async function queueWhatsAppBatch(client: any, id: string, actor: AuthUser, input: any = {}) {
  const batch = await client.whatsAppOutboundBatch.findUnique({
    where: { id }, include: { integrationProfile: true, templateMapping: true, notificationCampaign: true }
  });
  if (!batch) throw new Error("WhatsApp batch was not found.");
  const action = input?.scheduledFor ? "schedule" : "send";
  assertAction(batch, action);
  await assertWhatsAppProfileCanSend(batch.integrationProfile);
  assertMappingReady(batch.templateMapping, batch.notificationCampaign);
  const scheduledFor = input?.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledFor && (!Number.isFinite(scheduledFor.getTime()) || scheduledFor <= new Date())) {
    throw new Error("Scheduled time must be a valid future time.");
  }
  const effectiveTime = scheduledFor ?? new Date();
  const quiet = isWhatsAppQuietHours(batch.integrationProfile, effectiveTime);
  const emergency = Boolean(input?.emergencyOverride);
  if (quiet && !emergency) {
    await recordWhatsAppOperationalEvent(client, {
      integrationProfileId: batch.integrationProfileId, batchId: batch.id,
      eventKey: operationalEventKey(["QUIET_HOURS_BLOCKED", batch.id, effectiveTime.toISOString().slice(0, 13)]),
      eventType: "QUIET_HOURS_BLOCKED",
      safeReason: "Normal WhatsApp delivery was blocked during configured India-local quiet hours.",
      recordedByUserId: actor.id
    });
    throw new Error("Normal WhatsApp delivery cannot begin during configured quiet hours.");
  }
  if (emergency) {
    if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can override quiet hours.");
    if (!["URGENT", "EMERGENCY"].includes(batch.notificationCampaign.priority) && batch.notificationCampaign.category !== "EMERGENCY") {
      throw new Error("Emergency override is allowed only for an urgent or emergency campaign.");
    }
    if (!String(input?.emergencyOverrideReason ?? "").trim()) throw new Error("Emergency quiet-hours override reason is required.");
  }
  const audience = await resolveWhatsAppAudience(client, batch.notificationCampaignId, batch.integrationProfileId, { mutateInvalidations: true });
  await ensureWhatsAppRateReferences(client, batch.integrationProfileId);
  const estimate = await estimateWhatsAppBatchCost(client, audience.eligible.length, batch.templateMapping.metaTemplateCategory);
  const currentCost = costSnapshot(batch, audience, estimate);
  await assertWhatsAppCostCap(client, batch, currentCost, actor.id);
  const deliveries = audience.eligible.map((contact) => {
    const childCount = Number((contact.safeContext as any)?.childCount ?? 0);
    const parameters = renderWhatsAppTemplateParameters(batch.templateMapping, batch.notificationCampaign, {
      type: contact.subjectType, childCount
    });
    return {
      batchId: batch.id,
      subjectType: contact.subjectType,
      subjectReferenceId: contact.subjectReferenceId,
      safeDisplayLabel: contact.safeDisplayLabel,
      safeContextJson: JSON.stringify(contact.safeContext),
      phoneHash: contact.phoneHash,
      phoneLast4: contact.phoneLast4,
      countryCode: contact.countryCode,
      consentId: contact.consentId,
      templateNameSnapshot: batch.templateMapping.metaTemplateName,
      templateLanguageSnapshot: batch.templateMapping.metaTemplateLanguage,
      templateCategorySnapshot: batch.templateMapping.metaTemplateCategory,
      renderedParametersJson: JSON.stringify(parameters),
      requestFingerprint: createHash("sha256").update([
        batch.id, contact.subjectType, contact.subjectReferenceId, contact.phoneHash,
        batch.templateMapping.metaTemplateName, batch.templateMapping.metaTemplateLanguage
      ].join("|")).digest("hex"),
      status: scheduledFor ? "SCHEDULED" : "QUEUED",
      nextAttemptAt: scheduledFor
    };
  });
  await client.$transaction(async (tx: any) => {
    for (const data of deliveries) {
      await tx.whatsAppDelivery.upsert({
        where: { batchId_subjectType_subjectReferenceId: {
          batchId: batch.id, subjectType: data.subjectType, subjectReferenceId: data.subjectReferenceId
        } },
        update: {},
        create: data
      });
    }
    await tx.whatsAppOutboundBatch.update({ where: { id: batch.id }, data: {
      status: scheduledFor ? "SCHEDULED" : "QUEUED",
      scheduledFor,
      emergencyOverride: emergency,
      emergencyOverrideReason: emergency ? String(input.emergencyOverrideReason).trim().slice(0, 500) : null,
      startedByUserId: actor.id,
      startedAt: scheduledFor ? null : new Date(),
      totalCampaignRecipients: audience.campaign.recipients.length,
      totalEligibleContacts: deliveries.length,
      totalSkipped: audience.skipped.length,
      skipReasonCountsJson: JSON.stringify(skipReasonCounts(audience.skipped)),
      totalQueued: deliveries.length,
      estimatedCostMinor: estimate.estimatedCostMinor,
      estimatedCostCurrency: estimate.currency,
      estimateRateVersion: estimate.rateVersion
    } });
    if (emergency) {
      await recordWhatsAppOperationalEvent(tx, {
        integrationProfileId: batch.integrationProfileId, batchId: batch.id,
        eventKey: operationalEventKey(["EMERGENCY_OVERRIDE_USED", batch.id, effectiveTime]),
        eventType: "EMERGENCY_OVERRIDE_USED",
        safeReason: String(input.emergencyOverrideReason).trim().slice(0, 500),
        recordedByUserId: actor.id
      });
    }
  });
  return client.whatsAppOutboundBatch.findUnique({ where: { id }, include: { deliveries: true } });
}

export async function cancelWhatsAppBatch(client: any, id: string, actor: AuthUser, reason: unknown) {
  const batch = await requiredBatch(client, id);
  if (!WORKFLOW[batch.status]?.includes("cancel")) throw new Error(`Batch cannot be cancelled from ${batch.status}.`);
  const cancellationReason = required(reason, "Cancellation reason").slice(0, 500);
  return client.$transaction(async (tx: any) => {
    await tx.whatsAppDelivery.updateMany({
      where: { batchId: id, status: { in: ["SCHEDULED", "QUEUED", "RETRY_PENDING", "SENDING"] } },
      data: { status: "CANCELLED", cancelledAt: new Date(), nextAttemptAt: null, retryable: false }
    });
    return tx.whatsAppOutboundBatch.update({ where: { id }, data: {
      status: "CANCELLED", cancellationReason, cancelledByUserId: actor.id,
      cancelledAt: new Date(), completedAt: new Date(), totalQueued: 0
    } });
  });
}

export async function retryWhatsAppBatchFailures(client: any, id: string) {
  const batch = await requiredBatch(client, id);
  assertAction(batch, "retry");
  const updated = await client.whatsAppDelivery.updateMany({
    where: { batchId: id, status: "FAILED", retryable: true, attemptCount: { lt: batch.integrationProfile?.maximumRetryCount ?? 3 } },
    data: { status: "RETRY_PENDING", nextAttemptAt: new Date(), failedAt: null }
  });
  if (updated.count) await client.whatsAppOutboundBatch.update({ where: { id }, data: { status: "QUEUED", completedAt: null } });
  return updated;
}

export function isWhatsAppQuietHours(profile: any, at = new Date()) {
  if (!profile.quietHoursStart || !profile.quietHoursEnd) return false;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: profile.timezone || "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23"
  }).formatToParts(at);
  const current = Number(parts.find((part) => part.type === "hour")?.value) * 60
    + Number(parts.find((part) => part.type === "minute")?.value);
  const start = clockMinutes(profile.quietHoursStart);
  const end = clockMinutes(profile.quietHoursEnd);
  return start === end ? true : start < end ? current >= start && current < end : current >= start || current < end;
}

function assertMappingReady(mapping: any, campaign: any) {
  if (mapping.status !== "ACTIVE" || mapping.providerStatus !== "APPROVED") {
    throw new Error("Only an active, Meta-approved template mapping can be used.");
  }
  if (!["MARKETING", "UTILITY"].includes(mapping.metaTemplateCategory)) throw new Error("Template category is not supported in Prompt 19B.");
  if (mapping.notificationCategory !== campaign.category) throw new Error("Template mapping category must exactly match the Prompt 19A campaign.");
}
function assertAction(batch: any, action: string) {
  if (!WORKFLOW[batch.status]?.includes(action)) throw new Error(`Action ${action} is not allowed from ${batch.status}.`);
}
async function requiredBatch(client: any, id: string) {
  const row = await client.whatsAppOutboundBatch.findUnique({ where: { id }, include: { integrationProfile: true } });
  if (!row) throw new Error("WhatsApp batch was not found.");
  return row;
}
async function calculateCurrentEstimate(client: any, batch: any) {
  const audience = await resolveWhatsAppAudience(client, batch.notificationCampaignId, batch.integrationProfileId);
  const mapping = await client.whatsAppTemplateMapping.findUnique({ where: { id: batch.templateMappingId } });
  if (!mapping) throw new Error("Template mapping was not found.");
  assertMappingReady(mapping, audience.campaign);
  await ensureWhatsAppRateReferences(client, batch.integrationProfileId);
  const estimate = await estimateWhatsAppBatchCost(client, audience.eligible.length, mapping.metaTemplateCategory);
  return costSnapshot(batch, audience, estimate);
}
function costSnapshot(batch: any, audience: any, estimate: any) {
  const cap = {
    enabled: Boolean(batch.integrationProfile.costCapEnabled),
    limitMinor: batch.integrationProfile.maximumEstimatedBatchCostMinor == null ? null : Number(batch.integrationProfile.maximumEstimatedBatchCostMinor),
    currency: String(batch.integrationProfile.costCapCurrency ?? "INR")
  };
  const snapshotHash = createHash("sha256").update(JSON.stringify({
    campaignSnapshot: batch.notificationCampaignSnapshotJson,
    mappingSnapshot: batch.templateMappingSnapshotJson,
    audience: audience.eligible.map((row: any) => `${row.subjectType}:${row.subjectReferenceId}:${row.phoneHash}`).sort(),
    estimatedCostMinor: estimate.estimatedCostMinor,
    currency: estimate.currency,
    rateVersion: estimate.rateVersion,
    cap
  })).digest("hex");
  return { audience, estimate, cap, snapshotHash };
}
async function assertWhatsAppCostCap(client: any, batch: any, current: any, actorId?: string | null) {
  const estimate = current.estimate.estimatedCostMinor;
  const limit = current.cap.limitMinor;
  if (!current.cap.enabled || limit == null || estimate == null || estimate <= limit) return;
  if (batch.costCapOverrideSnapshotHash === current.snapshotHash) return;
  await recordWhatsAppOperationalEvent(client, {
    integrationProfileId: batch.integrationProfileId, batchId: batch.id,
    eventKey: operationalEventKey(["COST_CAP_BLOCKED", batch.id, current.snapshotHash]),
    eventType: "COST_CAP_BLOCKED",
    safeReason: "Estimated batch cost exceeded the configured safety cap.",
    estimatedCostMinor: estimate, costCapMinor: limit, currency: current.cap.currency,
    rateVersion: current.estimate.rateVersion, snapshotHash: current.snapshotHash,
    recordedByUserId: actorId ?? null
  });
  throw new Error(`Estimated WhatsApp cost ${formatMinor(estimate, current.cap.currency)} exceeds the configured cap ${formatMinor(limit, current.cap.currency)}. Director or Super Admin override is required.`);
}
function skipReasonCounts(rows: Array<{ reasonCode: string }>) {
  const counts = Object.fromEntries(WHATSAPP_SKIP_REASONS.map((reason) => [reason, 0])) as Record<string, number>;
  for (const row of rows) counts[row.reasonCode] = (counts[row.reasonCode] ?? 0) + 1;
  return counts;
}
function formatMinor(value: number, currency: string) { return `${currency} ${(value / 100).toFixed(2)}`; }
function clockMinutes(value: string) { const [hour, minute] = value.split(":").map(Number); return hour * 60 + minute; }
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); return text; }
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
