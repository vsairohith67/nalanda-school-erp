import { createHash, randomUUID } from "node:crypto";
import type { AuthUser } from "@/lib/auth";
import { resolveSmsEmailAudience, safeSmsEmailPreview } from "@/lib/sms-email-audiences";
import { assertSmsEmailProfileCanSend, emailDomainReadiness, smsDltReadiness } from "@/lib/sms-email-profiles";
import { estimateSmsSegments, renderSmsEmailTemplate } from "@/lib/sms-email-templates";

const WORKFLOW: Record<string, readonly string[]> = {
  DRAFT: ["preview", "cancel"],
  PREVIEWED: ["preview", "submit", "cancel", "override-cost-cap"],
  READY_FOR_APPROVAL: ["approve", "cancel", "override-cost-cap"],
  APPROVED: ["send", "schedule", "cancel"],
  SCHEDULED: ["cancel"],
  QUEUED: ["cancel"],
  PROCESSING: ["cancel"],
  PARTIALLY_FAILED: ["retry", "cancel"],
  FAILED: ["retry", "cancel"]
};

export function newSmsEmailBatchNumber(channel: string, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).format(now).replaceAll("-", "");
  return `${channel === "SMS" ? "SMS" : "EML"}-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export async function createSmsEmailBatch(client: any, input: any, actor: AuthUser) {
  const [campaign, profile, mapping] = await Promise.all([
    client.notificationCampaign.findUnique({ where: { id: required(input?.notificationCampaignId, "Notification campaign") } }),
    client.smsEmailIntegrationProfile.findUnique({ where: { id: required(input?.integrationProfileId, "Integration profile") } }),
    client.smsEmailTemplateMapping.findUnique({ where: { id: required(input?.templateMappingId, "Template mapping") } })
  ]);
  if (!campaign || campaign.status !== "PUBLISHED" || !campaign.publishedAt) throw new Error("Only a published Prompt 19A campaign can be used.");
  if (!profile || !mapping || mapping.integrationProfileId !== profile.id || mapping.channel !== profile.channel) throw new Error("Profile and template mapping must match.");
  assertMappingReady(mapping, campaign);
  const readiness = profile.channel === "SMS" ? smsDltReadiness(profile, mapping) : emailDomainReadiness(profile, mapping);
  return client.smsEmailOutboundBatch.create({ data: {
    batchNumber: newSmsEmailBatchNumber(profile.channel),
    channel: profile.channel,
    integrationProfileId: profile.id,
    notificationCampaignId: campaign.id,
    notificationCampaignSnapshotJson: JSON.stringify({
      campaignNumber: campaign.campaignNumber, category: campaign.category, priority: campaign.priority,
      title: campaign.title, body: campaign.body, audienceType: campaign.audienceType, audienceSnapshotJson: campaign.audienceSnapshotJson,
      publishedAt: campaign.publishedAt.toISOString()
    }),
    templateMappingId: mapping.id,
    templateSnapshotJson: JSON.stringify(templateSnapshot(mapping)),
    profileSnapshotJson: JSON.stringify(profileSnapshot(profile)),
    readinessSnapshotJson: JSON.stringify(readiness),
    status: "DRAFT", createdByUserId: actor.id
  } });
}

export async function previewSmsEmailBatch(client: any, id: string) {
  const batch = await batchWithRelations(client, id);
  assertAction(batch, "preview");
  assertSmsEmailBatchSnapshotsCurrent(batch);
  assertMappingReady(batch.templateMapping, batch.notificationCampaign);
  const audience = await resolveSmsEmailAudience(client, batch.notificationCampaignId, batch.integrationProfileId, batch.channel);
  const estimate = await estimateBatch(client, batch, audience);
  await client.smsEmailOutboundBatch.update({ where: { id }, data: {
    status: "PREVIEWED",
    totalCampaignRecipients: audience.campaign.recipients.length,
    totalEligibleContacts: audience.eligible.length,
    totalSkipped: audience.skipped.length,
    skipReasonCountsJson: JSON.stringify(reasonCounts(audience.skipped)),
    estimatedSegments: estimate.segments,
    estimatedMaximumCostMinor: estimate.costMinor,
    estimatedCostCurrency: estimate.currency,
    rateVersion: estimate.rateVersion
  } });
  return { ...safeSmsEmailPreview(audience), estimate };
}

export async function submitSmsEmailBatch(client: any, id: string) {
  const batch = await requiredBatch(client, id); assertAction(batch, "submit");
  return client.smsEmailOutboundBatch.update({ where: { id }, data: { status: "READY_FOR_APPROVAL" } });
}

export async function approveSmsEmailBatch(client: any, id: string, actor: AuthUser, notes?: unknown) {
  const batch = await batchWithRelations(client, id); assertAction(batch, "approve");
  if (batch.createdByUserId === actor.id) throw new Error("The creator cannot approve their own external batch.");
  assertSmsEmailBatchSnapshotsCurrent(batch);
  const current = await currentSnapshot(client, batch);
  assertCostCap(batch, current);
  return client.smsEmailOutboundBatch.update({ where: { id }, data: {
    status: "APPROVED", approvedByUserId: actor.id, approvedAt: new Date(), approvalNotes: optional(notes),
    totalCampaignRecipients: current.audience.campaign.recipients.length,
    totalEligibleContacts: current.audience.eligible.length, totalSkipped: current.audience.skipped.length,
    skipReasonCountsJson: JSON.stringify(reasonCounts(current.audience.skipped)),
    estimatedSegments: current.estimate.segments, estimatedMaximumCostMinor: current.estimate.costMinor,
    estimatedCostCurrency: current.estimate.currency, rateVersion: current.estimate.rateVersion
  } });
}

export async function overrideSmsEmailCostCap(client: any, id: string, actor: AuthUser, reason: unknown) {
  if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can override an estimated-cost cap.");
  const batch = await batchWithRelations(client, id); assertAction(batch, "override-cost-cap");
  const safeReason = required(reason, "Override reason").slice(0, 500);
  const current = await currentSnapshot(client, batch);
  const limit = batch.integrationProfile.maximumEstimatedBatchCostMinor;
  if (!batch.integrationProfile.costCapEnabled || limit == null || current.estimate.costMinor == null || current.estimate.costMinor <= limit) throw new Error("Current estimate does not exceed an enabled cost cap.");
  const snapshot = { hash: current.hash, reason: safeReason, estimateMinor: current.estimate.costMinor, limitMinor: limit, currency: current.estimate.currency, rateVersion: current.estimate.rateVersion, at: new Date().toISOString(), actorId: actor.id };
  await client.smsEmailOperationalEvent.upsert({
    where: { eventKey: `COST_CAP_OVERRIDE:${batch.id}:${current.hash}` },
    update: {},
    create: { integrationProfileId: batch.integrationProfileId, batchId: batch.id, eventKey: `COST_CAP_OVERRIDE:${batch.id}:${current.hash}`, eventType: "COST_CAP_OVERRIDE_USED", safeReason, snapshotJson: JSON.stringify({ estimateMinor: snapshot.estimateMinor, limitMinor: snapshot.limitMinor, currency: snapshot.currency }), recordedByUserId: actor.id }
  });
  return client.smsEmailOutboundBatch.update({ where: { id }, data: { costCapOverrideSnapshotJson: JSON.stringify(snapshot) } });
}

export async function queueSmsEmailBatch(client: any, id: string, actor: AuthUser, input: any = {}) {
  const batch = await batchWithRelations(client, id); assertAction(batch, input?.scheduledFor ? "schedule" : "send");
  assertSmsEmailBatchSnapshotsCurrent(batch);
  await assertSmsEmailProfileCanSend(batch.integrationProfile, batch.templateMapping);
  assertMappingReady(batch.templateMapping, batch.notificationCampaign);
  const scheduledFor = input?.scheduledFor ? new Date(input.scheduledFor) : null;
  if (scheduledFor && (!Number.isFinite(scheduledFor.getTime()) || scheduledFor <= new Date())) throw new Error("Scheduled time must be in the future.");
  const effectiveAt = scheduledFor ?? new Date();
  const quiet = isSmsEmailQuietHours(batch.integrationProfile, effectiveAt);
  const emergency = Boolean(input?.emergencyOverride);
  if (quiet && !emergency) {
    await event(client, batch, "QUIET_HOURS_BLOCKED", "Normal delivery blocked during configured India-local quiet hours.", actor.id);
    throw new Error("Normal delivery cannot begin during configured quiet hours.");
  }
  if (emergency) {
    if (!["SUPER_ADMIN", "DIRECTOR"].includes(actor.role)) throw new Error("Only Director or Super Admin can override quiet hours.");
    if (!["URGENT", "EMERGENCY"].includes(batch.notificationCampaign.priority) && batch.notificationCampaign.category !== "EMERGENCY") throw new Error("Emergency override requires an urgent/emergency campaign.");
    if (!String(input?.emergencyOverrideReason ?? "").trim()) throw new Error("Emergency override reason is required.");
  }
  const audience = await resolveSmsEmailAudience(client, batch.notificationCampaignId, batch.integrationProfileId, batch.channel, { mutateInvalidations: true });
  const estimate = await estimateBatch(client, batch, audience);
  const current = snapshot(batch, audience, estimate);
  assertCostCap(batch, current);
  const deliveries = audience.eligible.map((contact: any) => {
    const rendered = renderSmsEmailTemplate(batch.templateMapping, batch.notificationCampaign, { childCount: Number(contact.safeContext?.childCount ?? 0) });
    const segment = batch.channel === "SMS" ? estimateSmsSegments(rendered.body) : null;
    return {
      batchId: batch.id, notificationRecipientId: contact.notificationRecipientId, channel: batch.channel,
      subjectType: contact.subjectType, guardianId: contact.guardianId, staffMemberId: contact.staffMemberId,
      contactHash: contact.contactHash, contactMasked: contact.contactMasked, consentId: contact.consentId,
      safeContextJson: JSON.stringify(contact.safeContext), renderedSubject: rendered.subject,
      renderedParametersSnapshotJson: JSON.stringify(rendered.parameters), smsSegmentCount: segment?.segments ?? null,
      requestFingerprint: createHash("sha256").update([batch.id, contact.subjectType, contact.subjectId, contact.contactHash, batch.templateSnapshotJson].join("|")).digest("hex"),
      status: "QUEUED", nextRetryAt: scheduledFor
    };
  });
  await client.$transaction(async (tx: any) => {
    for (const data of deliveries) await tx.smsEmailDelivery.upsert({ where: { requestFingerprint: data.requestFingerprint }, update: {}, create: data });
    await tx.smsEmailOutboundBatch.update({ where: { id }, data: {
      status: scheduledFor ? "SCHEDULED" : "QUEUED", scheduledFor, emergencyOverride: emergency,
      startedByUserId: actor.id, startedAt: scheduledFor ? null : new Date(),
      totalCampaignRecipients: audience.campaign.recipients.length, totalEligibleContacts: deliveries.length,
      totalSkipped: audience.skipped.length, totalQueued: deliveries.length,
      skipReasonCountsJson: JSON.stringify(reasonCounts(audience.skipped)), estimatedSegments: estimate.segments,
      estimatedMaximumCostMinor: estimate.costMinor, estimatedCostCurrency: estimate.currency, rateVersion: estimate.rateVersion
    } });
    if (emergency) await event(tx, batch, "EMERGENCY_OVERRIDE_USED", String(input.emergencyOverrideReason).trim().slice(0, 500), actor.id);
  });
  return client.smsEmailOutboundBatch.findUnique({ where: { id }, include: { deliveries: true } });
}

export async function cancelSmsEmailBatch(client: any, id: string, actor: AuthUser, reason: unknown) {
  const batch = await requiredBatch(client, id); assertAction(batch, "cancel");
  const cancellationReason = required(reason, "Cancellation reason").slice(0, 500);
  return client.$transaction(async (tx: any) => {
    await tx.smsEmailDelivery.updateMany({ where: { batchId: id, status: { in: ["QUEUED", "SENDING"] } }, data: { status: "CANCELLED", cancelledAt: new Date(), nextRetryAt: null, retryable: false } });
    return tx.smsEmailOutboundBatch.update({ where: { id }, data: { status: "CANCELLED", cancellationReason, cancelledByUserId: actor.id, cancelledAt: new Date(), completedAt: new Date(), totalQueued: 0 } });
  });
}

export async function retrySmsEmailBatch(client: any, id: string) {
  const batch = await batchWithRelations(client, id); assertAction(batch, "retry");
  const updated = await client.smsEmailDelivery.updateMany({ where: { batchId: id, status: "FAILED", retryable: true, retryCount: { lt: batch.integrationProfile.maximumRetryCount } }, data: { status: "QUEUED", nextRetryAt: new Date(), failedAt: null } });
  if (updated.count) await client.smsEmailOutboundBatch.update({ where: { id }, data: { status: "QUEUED", completedAt: null } });
  return updated;
}

export function isSmsEmailQuietHours(profile: any, at = new Date()) {
  if (!profile.quietHoursStart || !profile.quietHoursEnd) return false;
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: profile.timezone || "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const now = Number(parts.find((p) => p.type === "hour")?.value) * 60 + Number(parts.find((p) => p.type === "minute")?.value);
  const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const start = minutes(profile.quietHoursStart), end = minutes(profile.quietHoursEnd);
  return start === end || (start < end ? now >= start && now < end : now >= start || now < end);
}

async function estimateBatch(client: any, batch: any, audience: any) {
  const rendered = audience.eligible.map((row: any) => renderSmsEmailTemplate(batch.templateMapping, batch.notificationCampaign, { childCount: Number(row.safeContext?.childCount ?? 0) }));
  const segmentRows = batch.channel === "SMS" ? rendered.map((row: any) => estimateSmsSegments(row.body)) : [];
  const segments = batch.channel === "SMS" ? segmentRows.reduce((sum: number, row: any) => sum + row.segments, 0) : null;
  const encodings = new Set(segmentRows.map((row: any) => row.encoding));
  const rate = await client.smsEmailCostRate.findFirst({ where: {
    channel: batch.channel, providerKind: batch.integrationProfile.providerKind, status: "ACTIVE",
    ...(batch.channel === "SMS" && encodings.size === 1 ? { encodingType: [...encodings][0] } : {})
  }, orderBy: { effectiveFrom: "desc" } });
  const units = batch.channel === "SMS" ? segments ?? 0 : audience.eligible.length;
  return {
    segments,
    messages: audience.eligible.length,
    encoding: batch.channel === "SMS" ? encodings.size === 1 ? [...encodings][0] : encodings.size ? "MIXED" : null : null,
    costMinor: rate ? units * rate.rateMinor : null,
    currency: rate?.currency ?? "INR",
    rateVersion: rate?.rateVersion ?? null,
    warning: "Estimate only; provider billing and Google quotas are not guaranteed. No finance entry is created."
  };
}
function assertMappingReady(mapping: any, campaign: any) {
  if (mapping.status !== "ACTIVE" || mapping.providerStatus !== "APPROVED") throw new Error("Only an active approved SMS/Email template mapping can be used.");
  if (mapping.notificationCategory !== campaign.category) throw new Error("Template mapping category must exactly match the Prompt 19A campaign.");
  renderSmsEmailTemplate(mapping, campaign);
}
export function assertSmsEmailBatchSnapshotsCurrent(batch: any) {
  const expectedTemplate = JSON.stringify(templateSnapshot(batch.templateMapping));
  const expectedCampaign = JSON.stringify(campaignSnapshot(batch.notificationCampaign));
  if (batch.templateSnapshotJson !== expectedTemplate) {
    throw new Error("Approved template mapping changed after batch creation; create a new batch.");
  }
  if (batch.notificationCampaignSnapshotJson !== expectedCampaign) {
    throw new Error("Published Prompt 19A campaign changed after batch creation; create a new batch.");
  }
}
function assertAction(batch: any, action: string) { if (!WORKFLOW[batch.status]?.includes(action)) throw new Error(`Action ${action} is not allowed from ${batch.status}.`); }
async function requiredBatch(client: any, id: string) { const row = await client.smsEmailOutboundBatch.findUnique({ where: { id } }); if (!row) throw new Error("SMS/Email batch was not found."); return row; }
async function batchWithRelations(client: any, id: string) { const row = await client.smsEmailOutboundBatch.findUnique({ where: { id }, include: { integrationProfile: true, templateMapping: true, notificationCampaign: true } }); if (!row) throw new Error("SMS/Email batch was not found."); return row; }
async function currentSnapshot(client: any, batch: any) { const audience = await resolveSmsEmailAudience(client, batch.notificationCampaignId, batch.integrationProfileId, batch.channel); const estimate = await estimateBatch(client, batch, audience); return snapshot(batch, audience, estimate); }
function snapshot(batch: any, audience: any, estimate: any) {
  const hash = createHash("sha256").update(JSON.stringify({ campaign: batch.notificationCampaignSnapshotJson, template: batch.templateSnapshotJson, contacts: audience.eligible.map((r: any) => r.contactHash).sort(), estimate, cap: batch.integrationProfile.maximumEstimatedBatchCostMinor })).digest("hex");
  return { audience, estimate, hash };
}
function assertCostCap(batch: any, current: any) {
  const limit = batch.integrationProfile.maximumEstimatedBatchCostMinor, estimate = current.estimate.costMinor;
  if (!batch.integrationProfile.costCapEnabled || limit == null || estimate == null || estimate <= limit) return;
  let override: any = null; try { override = JSON.parse(batch.costCapOverrideSnapshotJson || "null"); } catch {}
  if (override?.hash === current.hash) return;
  throw new Error(`Estimated ${batch.channel} cost exceeds the configured safety cap.`);
}
async function event(client: any, batch: any, type: string, reason: string, actorId?: string | null) {
  const eventKey = `${type}:${batch.id}:${createHash("sha256").update(reason).digest("hex").slice(0, 16)}`;
  return client.smsEmailOperationalEvent.upsert({ where: { eventKey }, update: {}, create: { integrationProfileId: batch.integrationProfileId, batchId: batch.id, eventKey, eventType: type, safeReason: reason, recordedByUserId: actorId ?? null } });
}
function reasonCounts(rows: any[]) { return rows.reduce((acc: Record<string, number>, row) => { acc[row.reasonCode] = (acc[row.reasonCode] ?? 0) + 1; return acc; }, {}); }
function campaignSnapshot(row: any) { return { campaignNumber: row.campaignNumber, category: row.category, priority: row.priority, title: row.title, body: row.body, audienceType: row.audienceType, audienceSnapshotJson: row.audienceSnapshotJson, publishedAt: row.publishedAt.toISOString() }; }
function templateSnapshot(row: any) { return { mappingCode: row.mappingCode, channel: row.channel, providerStatus: row.providerStatus, smsPrincipalEntityReference: row.smsPrincipalEntityReference, smsHeader: row.smsHeader, smsDltTemplateId: row.smsDltTemplateId, smsTemplateText: row.smsTemplateText, emailSenderAlias: row.emailSenderAlias, emailSubjectTemplate: row.emailSubjectTemplate, emailTextTemplate: row.emailTextTemplate, emailReplyToAlias: row.emailReplyToAlias, parameterDefinitionJson: row.parameterDefinitionJson }; }
function profileSnapshot(row: any) { return { profileCode: row.profileCode, channel: row.channel, providerKind: row.providerKind, mode: row.mode, senderIdentityMasked: row.senderIdentityMasked, senderDomain: row.senderDomain, dltPrincipalEntityReference: row.dltPrincipalEntityReference, dltHeaderReference: row.dltHeaderReference, spfStatus: row.spfStatus, dkimStatus: row.dkimStatus, dmarcStatus: row.dmarcStatus, senderAliasStatus: row.senderAliasStatus }; }
function required(value: unknown, label: string) { const text = String(value ?? "").trim(); if (!text) throw new Error(`${label} is required.`); return text; }
function optional(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
