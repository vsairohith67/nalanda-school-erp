import { normalizeWhatsAppPhone } from "@/lib/whatsapp-phone";
import { createWhatsAppProvider } from "@/lib/whatsapp-provider";
import { assertWhatsAppProfileCanSend } from "@/lib/whatsapp-profiles";
import { refreshWhatsAppBatchCounts } from "@/lib/whatsapp-deliveries";
import { redactWhatsAppText } from "@/lib/whatsapp-redaction";
import { indiaLimitPeriod, operationalEventKey, recordWhatsAppOperationalEvent } from "@/lib/whatsapp-operational-events";

export type WhatsAppWorkerSummary = {
  claimed: number;
  accepted: number;
  retryScheduled: number;
  failed: number;
  skipped: number;
  rateLimited: number;
  recoveredStale: number;
  batchIds: string[];
};

let whatsAppQueueRunActive = false;

export async function processWhatsAppQueue(client: any, options: { limit?: number; now?: Date } = {}) {
  // Process-local only: multi-instance deployment still requires a shared lease.
  if (whatsAppQueueRunActive) throw new Error("WHATSAPP_QUEUE_PROCESSOR_BUSY");
  whatsAppQueueRunActive = true;
  try {
    return await processWhatsAppQueueUnlocked(client, options);
  } finally {
    whatsAppQueueRunActive = false;
  }
}

async function processWhatsAppQueueUnlocked(client: any, options: { limit?: number; now?: Date } = {}) {
  const now = options.now ?? new Date();
  const staleBefore = new Date(now.getTime() - 10 * 60_000);
  const recovered = await client.whatsAppDelivery.updateMany({
    where: { status: "SENDING", claimedAt: { lt: staleBefore } },
    data: {
      status: "FAILED",
      failedAt: now,
      nextAttemptAt: null,
      claimedAt: null,
      retryable: false,
      providerErrorCategory: "NEEDS_RECONCILIATION",
      providerErrorCode: "STALE_SEND_OUTCOME_UNKNOWN",
      failureMessageSafe: "The provider outcome is unknown; reconcile before any manual resend."
    }
  });
  await client.whatsAppDelivery.updateMany({
    where: { status: "SCHEDULED", nextAttemptAt: { lte: now }, batch: { status: "SCHEDULED" } },
    data: { status: "QUEUED" }
  });
  const candidates = await client.whatsAppDelivery.findMany({
    where: {
      status: { in: ["QUEUED", "RETRY_PENDING"] },
      OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      batch: { status: { in: ["QUEUED", "PROCESSING", "SCHEDULED"] }, integrationProfile: { status: "ACTIVE" } }
    },
    include: { batch: { include: { integrationProfile: true } } },
    orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }],
    take: Math.min(100, Math.max(1, options.limit ?? 25))
  });
  const summary: WhatsAppWorkerSummary = {
    claimed: 0, accepted: 0, retryScheduled: 0, failed: 0, skipped: 0, rateLimited: 0,
    recoveredStale: recovered.count, batchIds: []
  };
  const locallyBlockedBatches = new Set<string>();
  for (const candidate of candidates) {
    if (locallyBlockedBatches.has(candidate.batchId)) continue;
    const claimed = await client.whatsAppDelivery.updateMany({
      where: { id: candidate.id, status: candidate.status },
      data: { status: "SENDING", claimedAt: now, nextAttemptAt: null }
    });
    if (claimed.count !== 1) continue;
    summary.claimed += 1;
    summary.batchIds.push(candidate.batchId);
    const outcome = await processClaimedDelivery(client, candidate.id, now, summary);
    if (outcome === "RATE_BLOCKED") locallyBlockedBatches.add(candidate.batchId);
  }
  for (const batchId of [...new Set(summary.batchIds)]) await refreshWhatsAppBatchCounts(client, batchId);
  summary.batchIds = [...new Set(summary.batchIds)];
  return summary;
}

async function processClaimedDelivery(client: any, id: string, now: Date, summary: WhatsAppWorkerSummary) {
  const delivery = await client.whatsAppDelivery.findUnique({
    where: { id }, include: { batch: { include: { integrationProfile: true, templateMapping: true } } }
  });
  if (!delivery || delivery.status !== "SENDING") return;
  try {
    await assertWhatsAppProfileCanSend(delivery.batch.integrationProfile);
    if (delivery.batch.status === "CANCELLED") throw new PermanentSkip("BATCH_CANCELLED", "Batch was cancelled before delivery.");
    if (delivery.batch.templateMapping.status !== "ACTIVE" || delivery.batch.templateMapping.providerStatus !== "APPROVED") {
      throw new PermanentSkip("TEMPLATE_NOT_SENDABLE", "Template mapping is no longer active and approved.");
    }
    await assertRateLimits(client, delivery.batch.integrationProfile, delivery.batchId, now);
    const source = delivery.subjectType === "GUARDIAN"
      ? await client.guardian.findUnique({ where: { id: delivery.subjectReferenceId }, select: { primaryMobile: true } })
      : await client.staffMember.findUnique({ where: { id: delivery.subjectReferenceId }, select: { mobile: true } });
    const phoneSource = delivery.subjectType === "GUARDIAN" ? source?.primaryMobile : source?.mobile;
    const phone = normalizeWhatsAppPhone(phoneSource, {
      defaultCountryCode: delivery.batch.integrationProfile.defaultCountryCode,
      allowDefaultCountryCode: true
    });
    if (phone.phoneHash !== delivery.phoneHash) {
      throw new PermanentSkip("PHONE_CHANGED", "Authoritative phone changed; fresh consent is required.");
    }
    const consent = await client.whatsAppConsent.findUnique({ where: { id: delivery.consentId } });
    if (!consent || consent.status !== "OPTED_IN" || consent.phoneHash !== phone.phoneHash || (consent.expiresAt && consent.expiresAt <= now)) {
      throw new PermanentSkip("CONSENT_NOT_ACTIVE", "Active phone-bound consent was not found at send time.");
    }
    const provider = createWhatsAppProvider(delivery.batch.integrationProfile.mode);
    const attemptNumber = delivery.attemptCount + 1;
    const started = Date.now();
    const result = await provider.sendApprovedTemplate({
      to: phone.e164,
      templateName: delivery.templateNameSnapshot,
      languageCode: delivery.templateLanguageSnapshot,
      parameters: JSON.parse(delivery.renderedParametersJson),
      requestFingerprint: delivery.requestFingerprint,
      opaqueCallbackData: delivery.id
    });
    await client.$transaction(async (tx: any) => {
      await tx.whatsAppDeliveryAttempt.create({ data: {
        deliveryId: delivery.id,
        attemptNumber,
        requestFingerprint: delivery.requestFingerprint,
        providerMessageId: result.providerMessageId,
        resultStatus: result.accepted ? "ACCEPTED" : result.retryable ? "RETRYABLE_FAILURE" : "PERMANENT_FAILURE",
        retryable: result.retryable,
        errorCategory: result.errorCategory ?? null,
        errorCode: result.errorCode ?? null,
        safeErrorMessage: redactWhatsAppText(result.safeMessage),
        completedAt: new Date(),
        startedAt: new Date(started)
      } });
      const canRetry = result.retryable && attemptNumber <= delivery.batch.integrationProfile.maximumRetryCount;
      if (!result.accepted && result.errorCategory === "RATE_LIMIT") {
        const nextEligibleAt = retryAt(attemptNumber, now);
        await recordWhatsAppOperationalEvent(tx, {
          integrationProfileId: delivery.batch.integrationProfileId, batchId: delivery.batchId,
          eventKey: operationalEventKey(["PROVIDER_RATE_LIMIT_RECEIVED", delivery.id, attemptNumber]),
          eventType: "PROVIDER_RATE_LIMIT_RECEIVED",
          nextEligibleAt,
          retryAfterSeconds: Math.max(0, Math.round((nextEligibleAt.getTime() - now.getTime()) / 1000)),
          safeReason: result.safeMessage ?? "Provider rate limit received."
        });
      }
      await tx.whatsAppDelivery.update({ where: { id: delivery.id }, data: result.accepted ? {
        status: "ACCEPTED",
        providerMessageId: result.providerMessageId,
        acceptedAt: new Date(),
        attemptCount: attemptNumber,
        claimedAt: null,
        retryable: false,
        providerErrorCategory: null,
        providerErrorCode: null,
        failureMessageSafe: null
      } : {
        status: canRetry ? "RETRY_PENDING" : "FAILED",
        failedAt: canRetry ? null : new Date(),
        nextAttemptAt: canRetry ? retryAt(attemptNumber, now) : null,
        attemptCount: attemptNumber,
        claimedAt: null,
        retryable: canRetry,
        providerErrorCategory: result.errorCategory ?? "PROVIDER",
        providerErrorCode: result.errorCode ?? null,
        failureMessageSafe: redactWhatsAppText(result.safeMessage)
      } });
    });
    if (result.accepted) summary.accepted += 1;
    else if (result.retryable && attemptNumber <= delivery.batch.integrationProfile.maximumRetryCount) summary.retryScheduled += 1;
    else summary.failed += 1;
  } catch (error) {
    if (error instanceof LocalRateLimitError) {
      await client.whatsAppDelivery.update({ where: { id }, data: {
        status: "RETRY_PENDING", nextAttemptAt: error.nextEligibleAt, claimedAt: null,
        retryable: true, providerErrorCategory: null, providerErrorCode: null, failureMessageSafe: null
      } });
      summary.rateLimited += 1;
      return "RATE_BLOCKED" as const;
    }
    const permanent = error instanceof PermanentSkip;
    await client.whatsAppDelivery.update({ where: { id }, data: {
      status: permanent && error.code === "CONSENT_NOT_ACTIVE" ? "OPTED_OUT" : "FAILED",
      failedAt: new Date(),
      optedOutAt: permanent && error.code === "CONSENT_NOT_ACTIVE" ? new Date() : null,
      claimedAt: null,
      retryable: false,
      providerErrorCategory: permanent ? "LOCAL_POLICY" : "WORKER",
      providerErrorCode: permanent ? error.code : "WORKER_ERROR",
      failureMessageSafe: redactWhatsAppText(error instanceof Error ? error.message : "Worker error")
    } });
    summary.skipped += permanent ? 1 : 0;
    summary.failed += permanent ? 0 : 1;
  }
  return "DONE" as const;
}

export async function assertWhatsAppLocalRateLimits(client: any, profile: any, batchId: string, now: Date) {
  const hour = indiaLimitPeriod(now, "HOUR");
  const day = indiaLimitPeriod(now, "DAY");
  if (profile.hourlyMessageLimit) {
    const count = await client.whatsAppDeliveryAttempt.count({ where: { startedAt: { gte: hour.start, lt: hour.end }, delivery: { batch: { integrationProfileId: profile.id } } } });
    if (count >= profile.hourlyMessageLimit) {
      await persistLocalLimit(client, profile, batchId, "LOCAL_HOURLY_LIMIT_BLOCKED", profile.hourlyMessageLimit, count, hour, now);
      throw new LocalRateLimitError("Hourly WhatsApp profile rate limit reached.", hour.end);
    }
  }
  if (profile.dailyMessageLimit) {
    const count = await client.whatsAppDeliveryAttempt.count({ where: { startedAt: { gte: day.start, lt: day.end }, delivery: { batch: { integrationProfileId: profile.id } } } });
    if (count >= profile.dailyMessageLimit) {
      await persistLocalLimit(client, profile, batchId, "LOCAL_DAILY_LIMIT_BLOCKED", profile.dailyMessageLimit, count, day, now);
      throw new LocalRateLimitError("Daily WhatsApp profile rate limit reached.", day.end);
    }
  }
}
const assertRateLimits = assertWhatsAppLocalRateLimits;
async function persistLocalLimit(client: any, profile: any, batchId: string, eventType: "LOCAL_HOURLY_LIMIT_BLOCKED" | "LOCAL_DAILY_LIMIT_BLOCKED", limitValue: number, currentUsage: number, period: { start: Date; end: Date }, now: Date) {
  await recordWhatsAppOperationalEvent(client, {
    integrationProfileId: profile.id, batchId,
    eventKey: operationalEventKey([eventType, profile.id, batchId, period.start]),
    eventType, limitValue, currentUsage, periodStart: period.start, periodEnd: period.end,
    nextEligibleAt: period.end,
    retryAfterSeconds: Math.max(0, Math.round((period.end.getTime() - now.getTime()) / 1000)),
    safeReason: eventType === "LOCAL_HOURLY_LIMIT_BLOCKED" ? "Local hourly WhatsApp limit reached." : "Local daily WhatsApp limit reached."
  });
}
function retryAt(attempt: number, now: Date) {
  return new Date(now.getTime() + Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000);
}
class PermanentSkip extends Error {
  constructor(public readonly code: string, message: string) { super(message); }
}
class LocalRateLimitError extends Error {
  constructor(message: string, public readonly nextEligibleAt: Date) { super(message); }
}
