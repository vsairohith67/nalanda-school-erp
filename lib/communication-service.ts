import { createHash, randomUUID } from "node:crypto";
import type { CommunicationProviderAdapter, SyntheticDeliveryOutcome } from "@/lib/communication-adapters";
import { createCommunicationAdapter } from "@/lib/communication-adapters";
import { communicationFeatureAvailability, isQuietHours, optionalPreferenceMaySuppress, purposeDeliveryPolicy, validateActionPath, validateAudienceSize } from "@/lib/communication-policy";
import { recheckDispatchDestination, resolveCommunicationRecipients, type RecipientPolicy } from "@/lib/communication-recipients";
import { renderCommunicationTemplate, resolveCommunicationTemplate } from "@/lib/communication-templates";
import { canApplyProviderState, COMMUNICATION_PRIORITIES, isCommunicationChannel, isCommunicationPurpose, type CommunicationChannel, type CommunicationIntentInput, type CommunicationOutboxState, type ResolvedCommunicationRecipient } from "@/lib/communication-types";

const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/;
const MODULES = new Set(["IDENTITY_ACCESS", "FINANCE", "ACADEMICS", "CLASSWORK", "PARENT_MEETINGS", "SUPPORT", "SAFE_EXIT", "ATTENDANCE", "LIBRARY", "OFFLINE_SYNC", "BIOMETRIC_ATTENDANCE", "TECHNICAL_OPERATIONS"]);
type CommunicationIntentAuthority = {
  sourceRecordType: string;
  sourceRecordId: string;
  sourceEventId: string;
  recipientPolicy: string;
  maximumAudience: number;
  authorityReference: string;
};

export async function createCommunicationIntent(client: any, input: CommunicationIntentInput, options: {
  pepper: string;
  authorizeIntent: (client: any, input: CommunicationIntentInput) => Promise<CommunicationIntentAuthority>;
  resolveRecipients?: typeof resolveCommunicationRecipients;
  now?: Date;
}) {
  const now = options.now ?? new Date();
  validateIntentInput(input, now);
  const policy = purposeDeliveryPolicy(input.purpose);
  if (!policy.allowed) throw new Error("COMMUNICATION_PURPOSE_PROHIBITED");
  for (const channel of [...new Set(input.eligibleChannels)]) {
    const template = resolveCommunicationTemplate({ templateKey: input.templateKey, version: input.templateVersion, locale: input.localePreference, channel });
    if (template.eventType !== input.eventType || template.purpose !== input.purpose || template.module !== input.module) {
      throw new Error("COMMUNICATION_TEMPLATE_CLASSIFICATION_MISMATCH");
    }
  }
  const authority = await options.authorizeIntent(client, input);
  if (
    authority.sourceRecordType !== input.sourceRecordType ||
    authority.sourceRecordId !== input.sourceRecordId ||
    authority.sourceEventId !== input.sourceEventId ||
    authority.recipientPolicy !== input.recipientPolicy ||
    !Number.isInteger(authority.maximumAudience) || authority.maximumAudience < 1 || authority.maximumAudience > 2_000 ||
    !IDENTIFIER.test(authority.authorityReference)
  ) throw new Error("COMMUNICATION_SOURCE_AUTHORITY_MISMATCH");
  const resolve = options.resolveRecipients ?? resolveCommunicationRecipients;
  const existing = await client.communicationIntent.findUnique({ where: { idempotencyKey: input.idempotencyKey }, include: { items: true } });
  if (existing) {
    const requestedHash = logicalIntentHash(input);
    const existingHash = logicalIntentHash({
      eventType: existing.eventType, purpose: existing.purpose, module: existing.module,
      sourceRecordType: existing.sourceRecordType, sourceRecordId: existing.sourceRecordId, sourceEventId: existing.sourceEventId,
      recipientPolicy: existing.recipientPolicy, recipientScope: parseObject(existing.recipientScopeJson),
      eligibleChannels: parseArray(existing.eligibleChannelsJson), templateKey: existing.templateKey, templateVersion: existing.templateVersion,
      localePreference: existing.localePreference, priority: existing.priority, notBefore: existing.notBefore, expiresAt: existing.expiresAt,
      deduplicationKey: existing.deduplicationKey, idempotencyKey: existing.idempotencyKey,
      initiatingActorId: existing.initiatingActorId, authorizingContext: parseObject(existing.authorizingContextJson)
    } as CommunicationIntentInput);
    if (requestedHash !== existingHash) throw new Error("COMMUNICATION_IDEMPOTENCY_CONTENT_MISMATCH");
    return { intent: existing, items: existing.items, idempotent: true };
  }
  const recipients = await resolve(client, { policy: input.recipientPolicy as RecipientPolicy, scope: input.recipientScope, actorUserId: input.initiatingActorId, now });
  if (recipients.length > authority.maximumAudience) throw new Error("COMMUNICATION_SOURCE_AUDIENCE_LIMIT_EXCEEDED");
  validateAudienceSize({ count: recipients.length, approved: Boolean(input.authorizingContext.largeAudienceApproved), stepUpGrantId: stringOrNull(input.authorizingContext.stepUpGrantId) });
  const audienceSnapshotHash = createHash("sha256").update(JSON.stringify(recipients.map((row) => ({ subjectType: row.subjectType, subjectReferenceId: row.subjectReferenceId, userId: row.userId })).sort((a, b) => `${a.subjectType}:${a.subjectReferenceId}`.localeCompare(`${b.subjectType}:${b.subjectReferenceId}`)))).digest("hex");
  return client.$transaction(async (tx: any) => {
    const intent = await tx.communicationIntent.create({ data: {
      eventType: input.eventType,
      purpose: input.purpose,
      module: input.module,
      sourceRecordType: input.sourceRecordType,
      sourceRecordId: input.sourceRecordId,
      sourceEventId: input.sourceEventId,
      recipientPolicy: input.recipientPolicy,
      recipientPolicyVersion: 1,
      recipientScopeJson: boundedJson(input.recipientScope, 20_000),
      eligibleChannelsJson: JSON.stringify(input.eligibleChannels),
      templateKey: input.templateKey,
      templateVersion: input.templateVersion,
      localePreference: input.localePreference ?? null,
      priority: input.priority,
      notBefore: input.notBefore ?? null,
      expiresAt: input.expiresAt ?? null,
      deduplicationKey: input.deduplicationKey,
      idempotencyKey: input.idempotencyKey,
      initiatingActorId: input.initiatingActorId,
      authorizingContextJson: boundedJson({ ...input.authorizingContext, serverAuthorityReference: authority.authorityReference }, 10_000),
      audienceSnapshotHash,
      state: recipients.length ? "RESOLVED" : "NO_ELIGIBLE_RECIPIENTS"
    } });
    const items = [];
    for (const recipient of recipients) for (const channel of [...new Set(input.eligibleChannels)]) {
      items.push(await createOutboxItem(tx, intent, recipient, channel, input, options.pepper, now));
    }
    await tx.communicationAuditEvent.create({ data: { intentId: intent.id, eventType: "INTENT_CREATED", newState: intent.state, actorUserId: input.initiatingActorId, safeReason: recipients.length ? "Server-owned recipient policy resolved the audience." : "No currently eligible recipient was resolved.", safeMetadataJson: JSON.stringify({ purpose: input.purpose, module: input.module, channels: input.eligibleChannels, recipientCount: recipients.length }) } });
    return { intent, items, idempotent: false };
  });
}

async function createOutboxItem(tx: any, intent: any, recipient: ResolvedCommunicationRecipient, channel: CommunicationChannel, input: CommunicationIntentInput, pepper: string, now: Date) {
  const rendered = renderCommunicationTemplate({ templateKey: input.templateKey, version: input.templateVersion, locale: input.localePreference ?? recipient.locale, channel, substitutions: { schoolDisplayName: "Nalanda School Management System" } });
  const availability = communicationFeatureAvailability(channel);
  let state: CommunicationOutboxState = channel === "IN_APP" && availability.enabled ? "DELIVERED" : availability.enabled ? "QUEUED" : "SUPPRESSED";
  let scheduledAt = input.notBefore ?? now;
  let destinationDigest: string | null = null, destinationMasked: string | null = null, contactPointId: string | null = null, contactVersion: number | null = null;
  const preference = recipient.userId ? await tx.communicationPreference.findUnique({ where: { userId_category_channel: { userId: recipient.userId, category: input.purpose, channel } } }) : null;
  if (preference && optionalPreferenceMaySuppress(input.purpose) && !preference.optionalEnabled) state = "SUPPRESSED";
  if (state !== "SUPPRESSED" && preference && optionalPreferenceMaySuppress(input.purpose) && isQuietHours({ now: scheduledAt, start: preference.quietHoursStart, end: preference.quietHoursEnd, timeZone: preference.timezone })) {
    scheduledAt = firstMinuteOutsideQuietHours(scheduledAt, preference.quietHoursStart, preference.quietHoursEnd, preference.timezone);
    state = "SCHEDULED";
  }
  if (channel !== "IN_APP") {
    const contact = await recheckDispatchDestination(tx, { channel, recipientUserId: recipient.userId, recipientSubjectType: recipient.subjectType, recipientSubjectReferenceId: recipient.subjectReferenceId }, pepper);
    if (!contact.eligible) state = "SUPPRESSED";
    else { destinationDigest = contact.digest; destinationMasked = contact.masked; contactPointId = contact.contactPointId; contactVersion = contact.contactVersion; }
    const consent = await currentConsent(tx, recipient, channel, input.purpose, now, contactVersion);
    if (purposeDeliveryPolicy(input.purpose).consentRequired && !consent) state = "SUPPRESSED";
  }
  const idempotencyKey = hash(`${input.idempotencyKey}\u0000${recipient.subjectType}\u0000${recipient.subjectReferenceId}\u0000${channel}`);
  const deduplicationKey = hash(`${input.deduplicationKey}\u0000${recipient.subjectType}\u0000${recipient.subjectReferenceId}\u0000${channel}`);
  return tx.communicationOutboxItem.create({ data: {
    intentId: intent.id,
    recipientUserId: recipient.userId,
    recipientSubjectType: recipient.subjectType,
    recipientSubjectReferenceId: recipient.subjectReferenceId,
    channel,
    contactPointId,
    contactVersion,
    destinationDigest,
    destinationMasked,
    locale: rendered.locale,
    templateKey: input.templateKey,
    templateVersion: input.templateVersion,
    substitutionsJson: JSON.stringify({ schoolDisplayName: "Nalanda School Management System" }),
    contentHash: rendered.contentHash,
    deduplicationKey,
    idempotencyKey,
    state,
    priority: input.priority,
    scheduledAt,
    expiresAt: input.expiresAt ?? null,
    nextAttemptAt: ["DELIVERED", "SUPPRESSED"].includes(state) ? null : scheduledAt,
    deliveredAt: state === "DELIVERED" ? now : null,
    lastSafeErrorCode: state === "SUPPRESSED" ? availability.enabled ? "POLICY_OR_RECIPIENT_SUPPRESSED" : "CHANNEL_DISABLED" : null,
    lastSafeErrorMessage: state === "SUPPRESSED" ? "The item is suppressed by server-owned eligibility or channel policy." : null
  } });
}

export async function processCommunicationOutbox(client: any, input: {
  channel: Exclude<CommunicationChannel, "IN_APP">;
  workerId: string;
  limit?: number;
  now?: Date;
  pepper: string;
  adapter?: CommunicationProviderAdapter;
  simulation?: SyntheticDeliveryOutcome;
}) {
  const now = input.now ?? new Date();
  if (!communicationFeatureAvailability(input.channel).enabled) throw new Error("COMMUNICATION_CHANNEL_DISABLED");
  if (!IDENTIFIER.test(input.workerId)) throw new Error("COMMUNICATION_WORKER_ID_INVALID");
  const limit = Math.max(1, Math.min(100, Math.floor(input.limit ?? 25)));
  const leaseExpiresAt = new Date(now.getTime() + 60_000);
  const candidates = await client.communicationOutboxItem.findMany({
    where: { channel: input.channel, OR: [
      { state: { in: ["QUEUED", "FAILED_RETRYABLE"] }, nextAttemptAt: { lte: now } },
      { state: { in: ["CLAIMED", "SENDING"] }, leaseExpiresAt: { lte: now } }
    ] }, orderBy: [{ createdAt: "asc" }], take: limit * 3
  });
  candidates.sort((a: any, b: any) => priorityRank(a.priority) - priorityRank(b.priority) || +new Date(a.createdAt) - +new Date(b.createdAt));
  const summary = { claimed: 0, accepted: 0, delivered: 0, retrying: 0, deadLetter: 0, suppressed: 0, expired: 0, uncertain: 0 };
  for (const candidate of candidates.slice(0, limit)) {
    const leaseToken = randomUUID();
    const claim = await client.communicationOutboxItem.updateMany({ where: { id: candidate.id, state: candidate.state, updatedAt: candidate.updatedAt }, data: { state: "CLAIMED", leaseOwner: input.workerId, leaseToken, claimedAt: now, leaseExpiresAt } });
    if (claim.count !== 1) continue;
    summary.claimed++;
    if (candidate.expiresAt && candidate.expiresAt <= now) { await finish(client, candidate.id, leaseToken, "EXPIRED", now, { lastSafeErrorCode: "COMMUNICATION_EXPIRED" }); summary.expired++; continue; }
    const destination = await recheckDispatchDestination(client, candidate, input.pepper);
    if (!destination.eligible) { await finish(client, candidate.id, leaseToken, "SUPPRESSED", now, { lastSafeErrorCode: destination.reason, lastSafeErrorMessage: "Dispatch-time recipient or contact eligibility changed." }); summary.suppressed++; continue; }
    const intent = await client.communicationIntent.findUnique({ where: { id: candidate.intentId } });
    const consent = intent
      ? await currentConsent(client, { subjectType: candidate.recipientSubjectType, subjectReferenceId: candidate.recipientSubjectReferenceId, userId: candidate.recipientUserId }, input.channel, intent.purpose, now, destination.contactVersion)
      : null;
    if (!intent || (purposeDeliveryPolicy(intent.purpose).consentRequired && !consent)) { await finish(client, candidate.id, leaseToken, "SUPPRESSED", now, { lastSafeErrorCode: "CONSENT_UNAVAILABLE" }); summary.suppressed++; continue; }
    const rendered = renderCommunicationTemplate({ templateKey: candidate.templateKey, version: candidate.templateVersion, locale: candidate.locale, channel: input.channel, substitutions: parseObject(candidate.substitutionsJson) });
    if (rendered.contentHash !== candidate.contentHash) { await finish(client, candidate.id, leaseToken, "FAILED_PERMANENT", now, { lastSafeErrorCode: "CONTENT_HASH_MISMATCH", lastSafeErrorMessage: "Approved rendered content changed." }); continue; }
    const prior = await client.communicationAttempt.findFirst({ where: { outboxItemId: candidate.id, resultState: { in: ["ACCEPTED_BY_PROVIDER", "SENT", "DELIVERED"] } }, orderBy: { attemptNumber: "desc" } });
    if (prior) { await finish(client, candidate.id, leaseToken, prior.resultState, now, { providerMessageId: prior.providerMessageId }); prior.resultState === "DELIVERED" ? summary.delivered++ : summary.accepted++; continue; }
    const profile = candidate.providerProfileCode ? await client.communicationProviderProfile.findUnique({ where: { profileCode: candidate.providerProfileCode } }) : null;
    const adapter = input.adapter ?? createCommunicationAdapter(profile?.operationalEnabled === true && profile.status === "ACTIVE" ? profile.adapterKind : "DISABLED");
    if (profile?.circuitState === "OPEN" && (!profile.circuitRetryAt || profile.circuitRetryAt > now)) { await scheduleRetry(client, candidate, leaseToken, now, "CIRCUIT_OPEN", "Provider circuit is open."); summary.retrying++; continue; }
    if (profile?.circuitState === "OPEN") await client.communicationProviderProfile.updateMany({ where: { id: profile.id, circuitState: "OPEN", circuitRetryAt: { lte: now } }, data: { circuitState: "HALF_OPEN" } });
    const estimate = adapter.estimateCost({ channel: input.channel, destination: destination.destination, destinationDigest: destination.digest, destinationMasked: destination.masked, idempotencyKey: candidate.idempotencyKey, contentHash: candidate.contentHash, title: rendered.title, subject: rendered.subject, body: rendered.body, actionPath: rendered.actionPath });
    const costPolicy = parseObject(profile?.costPolicyJson ?? "{}");
    const maximumItemCostMinor = positiveInteger(costPolicy.maximumItemCostMinor, 100);
    if (estimate.costMinor > maximumItemCostMinor) { await finish(client, candidate.id, leaseToken, "FAILED_PERMANENT", now, { lastSafeErrorCode: "COST_CAP_REACHED", lastSafeErrorMessage: "The provider-neutral item cost cap was reached.", estimatedCostMinor: estimate.costMinor, estimatedCostCurrency: estimate.currency }); continue; }
    const ratePolicy = parseObject(profile?.ratePolicyJson ?? "{}");
    const perMinute = positiveInteger(ratePolicy.perMinute, 20);
    if (profile && await client.communicationAttempt.count({ where: { startedAt: { gte: new Date(now.getTime() - 60_000) }, outboxItem: { providerProfileCode: profile.profileCode } } }) >= perMinute) { await scheduleRetry(client, candidate, leaseToken, now, "RATE_LIMIT_POLICY", "The shared provider profile rate limit was reached.", 60_000); summary.retrying++; continue; }
    await client.communicationOutboxItem.updateMany({ where: { id: candidate.id, leaseToken, state: "CLAIMED" }, data: { state: "SENDING" } });
    const attemptNumber = candidate.attemptCount + 1;
    let result;
    try {
      result = await adapter.send({ channel: input.channel, destination: destination.destination, destinationDigest: destination.digest, destinationMasked: destination.masked, idempotencyKey: candidate.idempotencyKey, contentHash: candidate.contentHash, title: rendered.title, subject: rendered.subject, body: rendered.body, actionPath: rendered.actionPath, simulation: input.simulation });
    } catch (error) {
      const classified = adapter.classifyError(error);
      await client.communicationAttempt.create({ data: { outboxItemId: candidate.id, attemptNumber, adapterKind: adapter.kind, requestHash: candidate.contentHash, resultState: classified.retryable ? "FAILED_RETRYABLE" : "FAILED_PERMANENT", retryable: classified.retryable, safeErrorCode: classified.safeCode, safeErrorMessage: "Provider adapter failed without exposing private response content.", startedAt: now, completedAt: now } });
      await updateProviderCircuit(client, profile, classified.retryable, false, now);
      if (classified.retryable && attemptNumber < candidate.maximumAttempts) { await scheduleRetry(client, { ...candidate, attemptCount: attemptNumber }, leaseToken, now, classified.safeCode, "Provider adapter failed safely."); summary.retrying++; }
      else { await finish(client, candidate.id, leaseToken, attemptNumber >= candidate.maximumAttempts ? "DEAD_LETTER" : "FAILED_PERMANENT", now, { attemptCount: attemptNumber, lastSafeErrorCode: classified.safeCode, lastSafeErrorMessage: "Provider adapter failed safely." }); if (attemptNumber >= candidate.maximumAttempts) summary.deadLetter++; }
      continue;
    }
    await client.communicationAttempt.create({ data: { outboxItemId: candidate.id, attemptNumber, adapterKind: adapter.kind, requestHash: candidate.contentHash, resultState: result.uncertain ? "ACCEPTED_BY_PROVIDER" : result.state, providerMessageId: result.providerMessageId, retryable: result.retryable && !result.uncertain, safeErrorCode: result.safeCode, safeErrorMessage: result.safeMessage, retryAfterAt: result.retryAfterMs ? new Date(now.getTime() + result.retryAfterMs) : null, startedAt: now, completedAt: now } });
    await updateProviderCircuit(client, profile, result.retryable && !result.uncertain, result.accepted || result.uncertain, now);
    if (result.uncertain) { await finish(client, candidate.id, leaseToken, "ACCEPTED_BY_PROVIDER", now, { attemptCount: attemptNumber, providerMessageId: result.providerMessageId, lastSafeErrorCode: result.safeCode, lastSafeErrorMessage: result.safeMessage }); summary.uncertain++; continue; }
    if (result.accepted) {
      await finish(client, candidate.id, leaseToken, result.state, now, { attemptCount: attemptNumber, providerMessageId: result.providerMessageId, acceptedAt: now, ...(result.state === "DELIVERED" ? { deliveredAt: now, sentAt: now } : {}) });
      result.state === "DELIVERED" ? summary.delivered++ : summary.accepted++;
      continue;
    }
    if (result.retryable && attemptNumber < candidate.maximumAttempts) { await scheduleRetry(client, { ...candidate, attemptCount: attemptNumber }, leaseToken, now, result.safeCode, result.safeMessage, result.retryAfterMs); summary.retrying++; }
    else { await finish(client, candidate.id, leaseToken, attemptNumber >= candidate.maximumAttempts ? "DEAD_LETTER" : "FAILED_PERMANENT", now, { attemptCount: attemptNumber, failedAt: now, lastSafeErrorCode: result.safeCode, lastSafeErrorMessage: result.safeMessage }); if (attemptNumber >= candidate.maximumAttempts) summary.deadLetter++; }
  }
  return summary;
}

export async function listOwnCommunicationNotifications(client: any, userId: string, options: { category?: string | null; before?: Date | null; limit?: number; archived?: boolean } = {}) {
  const limit = Math.max(1, Math.min(50, Math.floor(options.limit ?? 25)));
  const rows = await client.communicationOutboxItem.findMany({ where: {
    recipientUserId: userId, channel: "IN_APP", state: "DELIVERED",
    ...(options.archived ? { inAppArchivedAt: { not: null } } : { inAppArchivedAt: null }),
    ...(options.before ? { createdAt: { lt: options.before } } : {}),
    ...(options.category ? { intent: { purpose: options.category } } : {})
  }, include: { intent: { select: { purpose: true, module: true, expiresAt: true } } }, orderBy: { createdAt: "desc" }, take: limit + 1 });
  return { items: rows.slice(0, limit).map((row: any) => ({ id: row.id, title: renderStored(row).title, body: renderStored(row).body, actionPath: renderStored(row).actionPath, purpose: row.intent.purpose, module: row.intent.module, locale: row.locale, readAt: row.inAppReadAt, archivedAt: row.inAppArchivedAt, createdAt: row.createdAt, expired: Boolean(row.intent.expiresAt && row.intent.expiresAt <= new Date()) })), nextCursor: rows.length > limit ? rows[limit - 1].createdAt.toISOString() : null };
}

export async function updateOwnCommunicationNotifications(client: any, userId: string, input: { action: "READ" | "ARCHIVE" | "MARK_ALL_READ"; itemId?: string | null }, now = new Date()) {
  if (input.action === "MARK_ALL_READ") return client.communicationOutboxItem.updateMany({ where: { recipientUserId: userId, channel: "IN_APP", state: "DELIVERED", inAppReadAt: null, inAppArchivedAt: null }, data: { inAppReadAt: now } });
  if (!input.itemId || !IDENTIFIER.test(input.itemId)) throw new Error("COMMUNICATION_NOTIFICATION_ID_INVALID");
  const row = await client.communicationOutboxItem.findFirst({ where: { id: input.itemId, recipientUserId: userId, channel: "IN_APP", state: "DELIVERED" } });
  if (!row) throw new Error("COMMUNICATION_NOTIFICATION_NOT_FOUND");
  return client.communicationOutboxItem.update({ where: { id: row.id }, data: input.action === "READ" ? { inAppReadAt: row.inAppReadAt ?? now } : { inAppArchivedAt: row.inAppArchivedAt ?? now, inAppReadAt: row.inAppReadAt ?? now } });
}

export async function saveOwnCommunicationPreference(client: any, userId: string, input: Record<string, unknown>) {
  const category = String(input.category ?? "INFORMATIONAL_OPTIONAL").toUpperCase(), channel = String(input.channel ?? "").toUpperCase();
  if (!isCommunicationPurpose(category) || !isCommunicationChannel(channel)) throw new Error("COMMUNICATION_PREFERENCE_SCOPE_INVALID");
  const locale = ["en-IN", "te-IN", "hi-IN"].includes(String(input.locale)) ? String(input.locale) : "en-IN";
  const quietHoursStart = clockOrNull(input.quietHoursStart), quietHoursEnd = clockOrNull(input.quietHoursEnd);
  if (Boolean(quietHoursStart) !== Boolean(quietHoursEnd)) throw new Error("COMMUNICATION_QUIET_HOURS_INVALID");
  const digestFrequency = ["IMMEDIATE", "DAILY", "WEEKLY"].includes(String(input.digestFrequency).toUpperCase()) ? String(input.digestFrequency).toUpperCase() : "IMMEDIATE";
  return client.communicationPreference.upsert({ where: { userId_category_channel: { userId, category, channel } }, create: { userId, category, channel, optionalEnabled: input.optionalEnabled === true, preferred: input.preferred === true, locale, quietHoursStart, quietHoursEnd, timezone: "Asia/Kolkata", digestFrequency, updatedByUserId: userId }, update: { optionalEnabled: input.optionalEnabled === true, preferred: input.preferred === true, locale, quietHoursStart, quietHoursEnd, digestFrequency, updatedByUserId: userId, version: { increment: 1 } } });
}

export async function loadCommunicationOperations(client: any) {
  const [states, channels, providerProfiles, deadLetters] = await Promise.all([
    client.communicationOutboxItem.groupBy({ by: ["state"], _count: { _all: true } }),
    client.communicationOutboxItem.groupBy({ by: ["channel"], _count: { _all: true } }),
    client.communicationProviderProfile.findMany({ select: { profileCode: true, channel: true, adapterKind: true, status: true, operationalEnabled: true, circuitState: true, lastHealthStatus: true }, orderBy: { profileCode: "asc" } }),
    client.communicationOutboxItem.count({ where: { state: "DEAD_LETTER" } })
  ]);
  return { states: Object.fromEntries(states.map((row: any) => [row.state, row._count._all])), channels: Object.fromEntries(channels.map((row: any) => [row.channel, row._count._all])), providerProfiles, deadLetters, destinationsExposed: false, messageBodiesExposed: false };
}

export async function cancelCommunicationIntent(client: any, intentId: string, actorUserId: string, reason: string, now = new Date()) {
  if (!IDENTIFIER.test(intentId) || !String(reason).trim()) throw new Error("COMMUNICATION_CANCELLATION_EVIDENCE_REQUIRED");
  return client.$transaction(async (tx: any) => {
    const cancelled = await tx.communicationOutboxItem.updateMany({ where: { intentId, state: { in: ["DRAFT", "PENDING_APPROVAL", "QUEUED", "SCHEDULED", "FAILED_RETRYABLE"] } }, data: { state: "CANCELLED", cancelledAt: now, leaseOwner: null, leaseToken: null, leaseExpiresAt: null } });
    await tx.communicationIntent.update({ where: { id: intentId }, data: { state: "CANCELLED", cancellationReason: String(reason).slice(0, 500), cancelledByUserId: actorUserId, cancelledAt: now } });
    await tx.communicationAuditEvent.create({ data: { intentId, eventType: "INTENT_CANCELLED", newState: "CANCELLED", actorUserId, safeReason: String(reason).slice(0, 500), safeMetadataJson: JSON.stringify({ affectedCount: cancelled.count }) } });
    return { cancelled: cancelled.count };
  });
}

function validateIntentInput(input: CommunicationIntentInput, now: Date) {
  for (const [label, value] of Object.entries({ eventType: input.eventType, module: input.module, sourceRecordType: input.sourceRecordType, sourceRecordId: input.sourceRecordId, sourceEventId: input.sourceEventId, recipientPolicy: input.recipientPolicy, templateKey: input.templateKey, deduplicationKey: input.deduplicationKey, idempotencyKey: input.idempotencyKey, initiatingActorId: input.initiatingActorId })) if (!IDENTIFIER.test(String(value))) throw new Error(`COMMUNICATION_${label.toUpperCase()}_INVALID`);
  if (!isCommunicationPurpose(input.purpose) || !MODULES.has(input.module)) throw new Error("COMMUNICATION_PURPOSE_OR_MODULE_INVALID");
  if (!(COMMUNICATION_PRIORITIES as readonly string[]).includes(input.priority)) throw new Error("COMMUNICATION_PRIORITY_INVALID");
  if (!Array.isArray(input.eligibleChannels) || !input.eligibleChannels.length || input.eligibleChannels.some((channel) => !isCommunicationChannel(channel))) throw new Error("COMMUNICATION_CHANNEL_INVALID");
  if (!Number.isInteger(input.templateVersion) || input.templateVersion < 1) throw new Error("COMMUNICATION_TEMPLATE_VERSION_INVALID");
  if (input.expiresAt && input.expiresAt <= (input.notBefore ?? now)) throw new Error("COMMUNICATION_EXPIRY_INVALID");
  validateActionPath((input.authorizingContext as any).actionPath ?? null);
  boundedJson(input.recipientScope, 20_000); boundedJson(input.authorizingContext, 10_000);
}
function logicalIntentHash(input: CommunicationIntentInput) { const authorizingContext = { ...input.authorizingContext }; delete authorizingContext.serverAuthorityReference; return hash(JSON.stringify({ ...input, authorizingContext, notBefore: input.notBefore?.toISOString() ?? null, expiresAt: input.expiresAt?.toISOString() ?? null, eligibleChannels: [...input.eligibleChannels].sort() })); }
function hash(value: string) { return createHash("sha256").update(value).digest("hex"); }
function boundedJson(value: unknown, maximum: number) { const json = JSON.stringify(value); if (!json || json.length > maximum) throw new Error("COMMUNICATION_JSON_BUDGET_EXCEEDED"); return json; }
function parseObject(value: string) { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {}; } catch { return {}; } }
function parseArray(value: string) { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function stringOrNull(value: unknown) { const text = String(value ?? "").trim(); return text || null; }
function clockOrNull(value: unknown) { const text = String(value ?? "").trim(); if (!text) return null; if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(text)) throw new Error("COMMUNICATION_QUIET_HOURS_INVALID"); return text; }
function priorityRank(value: string) { const index = COMMUNICATION_PRIORITIES.indexOf(value as any); return index < 0 ? 99 : index; }
function positiveInteger(value: unknown, fallback: number) { const parsed = Number(value); return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100_000) : fallback; }
function firstMinuteOutsideQuietHours(now: Date, start: string | null, end: string | null, timeZone: string | null) { let candidate = new Date(now); for (let minute = 0; minute < 24 * 60; minute++) { candidate = new Date(candidate.getTime() + 60_000); if (!isQuietHours({ now: candidate, start, end, timeZone })) return candidate; } throw new Error("COMMUNICATION_QUIET_HOURS_RELEASE_UNRESOLVED"); }
function renderStored(row: any) { return renderCommunicationTemplate({ templateKey: row.templateKey, version: row.templateVersion, locale: row.locale, channel: "IN_APP", substitutions: parseObject(row.substitutionsJson) }); }
async function currentConsent(client: any, recipient: Pick<ResolvedCommunicationRecipient, "subjectType" | "subjectReferenceId" | "userId">, channel: CommunicationChannel, purpose: string, now: Date, contactVersion: number | null) {
  if (channel === "IN_APP" || !purposeDeliveryPolicy(purpose as any).consentRequired) return { status: "NOT_REQUIRED_BY_APPROVED_POLICY", contactVersion: null };
  if (contactVersion == null) return null;
  return client.communicationConsent.findFirst({ where: { subjectType: recipient.subjectType, subjectReferenceId: recipient.subjectReferenceId, channel, purpose, status: "GRANTED", contactVersion, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }, orderBy: { createdAt: "desc" } });
}
async function finish(client: any, id: string, leaseToken: string, state: string, now: Date, data: Record<string, unknown> = {}) { await client.communicationOutboxItem.updateMany({ where: { id, leaseToken, state: { in: ["CLAIMED", "SENDING"] } }, data: { state, leaseOwner: null, leaseToken: null, leaseExpiresAt: null, nextAttemptAt: null, ...(state === "FAILED_PERMANENT" || state === "DEAD_LETTER" ? { failedAt: now } : {}), ...data } }); }
async function scheduleRetry(client: any, candidate: any, leaseToken: string, now: Date, code: string, message: string, retryAfterMs?: number) { const attempt = candidate.attemptCount || 1; const base = retryAfterMs ?? Math.min(60 * 60_000, 15_000 * 2 ** Math.max(0, attempt - 1)); const jitter = Number.parseInt(hash(candidate.idempotencyKey).slice(0, 4), 16) % Math.max(1, Math.floor(base / 5)); await finish(client, candidate.id, leaseToken, "FAILED_RETRYABLE", now, { attemptCount: attempt, nextAttemptAt: new Date(now.getTime() + base + jitter), lastSafeErrorCode: code, lastSafeErrorMessage: message.slice(0, 500) }); }
async function updateProviderCircuit(client: any, profile: any, retryableFailure: boolean, accepted: boolean, now: Date) { if (!profile) return; if (accepted) { await client.communicationProviderProfile.updateMany({ where: { id: profile.id }, data: { circuitState: "CLOSED", consecutiveFailureCount: 0, circuitOpenedAt: null, circuitRetryAt: null, lastHealthAt: now, lastHealthStatus: "HEALTHY" } }); return; } if (!retryableFailure) return; const failures = Number(profile.consecutiveFailureCount ?? 0) + 1; await client.communicationProviderProfile.updateMany({ where: { id: profile.id }, data: { consecutiveFailureCount: failures, circuitState: failures >= 3 ? "OPEN" : profile.circuitState, circuitOpenedAt: failures >= 3 ? now : profile.circuitOpenedAt, circuitRetryAt: failures >= 3 ? new Date(now.getTime() + 60_000) : profile.circuitRetryAt, lastHealthAt: now, lastHealthStatus: "DEGRADED" } }); }
