import { createEmailProvider, createSmsProvider } from "@/lib/sms-email-provider";
import { canonicalContact } from "@/lib/sms-email-consents";
import { renderSmsEmailTemplate } from "@/lib/sms-email-templates";
import { assertSmsEmailBatchSnapshotsCurrent } from "@/lib/sms-email-batches";

export async function recoverStaleSmsEmailClaims(client: any, now = new Date()) {
  const stale = new Date(now.getTime() - 15 * 60_000);
  const result = await client.smsEmailDelivery.updateMany({
    where: { status: "SENDING", claimedAt: { lt: stale } },
    data: {
      status: "FAILED",
      claimedAt: null,
      nextRetryAt: null,
      retryable: false,
      failedAt: now,
      failureCode: "STALE_SEND_OUTCOME_UNKNOWN",
      failureCategory: "NEEDS_RECONCILIATION",
      failureMessageSafe: "The provider outcome is unknown; reconcile before any manual resend."
    }
  });
  if (result.count) {
    const profiles = await client.smsEmailIntegrationProfile.findMany({ where: { status: { in: ["ACTIVE", "CONFIGURED"] } }, select: { id: true } });
    for (const profile of profiles) await client.smsEmailOperationalEvent.upsert({
      where: { eventKey: `SEND_RECONCILIATION_REQUIRED:${profile.id}:${now.toISOString().slice(0, 13)}` },
      update: {},
      create: {
        integrationProfileId: profile.id,
        eventKey: `SEND_RECONCILIATION_REQUIRED:${profile.id}:${now.toISOString().slice(0, 13)}`,
        eventType: "SEND_RECONCILIATION_REQUIRED",
        safeReason: `${result.count} stale send claim(s) require reconciliation before resend.`
      }
    });
  }
  return result.count;
}

export async function processSmsEmailQueue(client: any, options: { limit?: number; now?: Date; channel?: "SMS" | "EMAIL" } = {}) {
  // Process-local only: multi-instance deployment still requires a shared lease.
  if (smsEmailQueueRunActive) throw new Error("SMS_EMAIL_QUEUE_PROCESSOR_BUSY");
  smsEmailQueueRunActive = true;
  try {
    return await processSmsEmailQueueUnlocked(client, options);
  } finally {
    smsEmailQueueRunActive = false;
  }
}

let smsEmailQueueRunActive = false;

async function processSmsEmailQueueUnlocked(client: any, options: { limit?: number; now?: Date; channel?: "SMS" | "EMAIL" } = {}) {
  const now = options.now ?? new Date();
  await recoverStaleSmsEmailClaims(client, now);
  await client.smsEmailDelivery.updateMany({ where: { status: "QUEUED", nextRetryAt: { gt: now } }, data: {} });
  const due = await client.smsEmailDelivery.findMany({
    where: { status: "QUEUED", ...(options.channel ? { channel: options.channel } : {}), OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    take: Math.max(1, Math.min(options.limit ?? 25, 100)),
    orderBy: { createdAt: "asc" },
    include: { batch: { include: { integrationProfile: true, templateMapping: true, notificationCampaign: true } }, consent: true }
  });
  const results: any[] = [];
  for (const candidate of due) {
    const claimed = await client.smsEmailDelivery.updateMany({ where: { id: candidate.id, status: "QUEUED" }, data: { status: "SENDING", claimedAt: now } });
    if (!claimed.count) continue;
    results.push(await processClaimed(client, candidate.id, now));
  }
  return { inspected: due.length, processed: results.length, results };
}

async function processClaimed(client: any, id: string, now: Date) {
  const delivery = await client.smsEmailDelivery.findUnique({
    where: { id },
    include: { batch: { include: { integrationProfile: true, templateMapping: true, notificationCampaign: true } }, consent: true }
  });
  if (!delivery || delivery.status !== "SENDING") return { id, status: "SKIPPED" };
  const { batch } = delivery;
  try {
    await revalidateSmsEmailDelivery(client, delivery);
    await enforceLimits(client, delivery, now);
    const source = delivery.subjectType === "GUARDIAN"
      ? await client.guardian.findUnique({ where: { id: delivery.guardianId }, select: { primaryMobile: true, email: true } })
      : await client.staffMember.findUnique({ where: { id: delivery.staffMemberId }, select: { mobile: true, email: true, status: true } });
    if (!source || (delivery.subjectType === "STAFF" && source.status !== "ACTIVE")) throw new PermanentFailure("OWNERSHIP_CHANGED", "Authoritative subject is unavailable.");
    const rawContact = delivery.channel === "SMS" ? (source as any).primaryMobile ?? (source as any).mobile : source.email;
    const contact = canonicalContact(delivery.channel, rawContact, { defaultCountryCode: batch.integrationProfile.defaultCountryCode, allowDefaultCountryCode: true });
    if (contact.contactHash !== delivery.contactHash) throw new PermanentFailure("CONTACT_CHANGED_AFTER_CONSENT", "Authoritative contact changed after approval.");
    const rendered = renderApprovedSmsEmailDelivery(delivery);
    const provider = delivery.channel === "SMS" ? createSmsProvider(batch.integrationProfile.mode) : createEmailProvider(batch.integrationProfile.mode);
    const started = Date.now();
    const result = delivery.channel === "SMS"
      ? await (provider as ReturnType<typeof createSmsProvider>).sendApprovedTemplate({
        to: contact.canonical,
        renderedText: rendered.body,
        dltPrincipalEntityReference: rendered.templateSnapshot.smsPrincipalEntityReference!,
        dltHeader: rendered.templateSnapshot.smsHeader!,
        dltTemplateId: rendered.templateSnapshot.smsDltTemplateId!,
        requestFingerprint: delivery.requestFingerprint
      })
      : await (provider as ReturnType<typeof createEmailProvider>).sendPlainText({
        to: contact.canonical,
        from: rendered.templateSnapshot.emailSenderAlias!,
        replyTo: rendered.templateSnapshot.emailReplyToAlias,
        subject: rendered.subject!,
        text: rendered.body,
        requestFingerprint: delivery.requestFingerprint
      });
    const attemptNumber = delivery.retryCount + 1;
    await client.$transaction(async (tx: any) => {
      await tx.smsEmailDeliveryAttempt.create({ data: {
        deliveryId: delivery.id, attemptNumber, providerMode: batch.integrationProfile.mode,
        requestFingerprint: delivery.requestFingerprint, providerMessageId: result.providerMessageId,
        result: result.accepted ? result.status : result.retryable ? "RETRYABLE_FAILURE" : "PERMANENT_FAILURE",
        providerHttpStatus: result.providerHttpStatus ?? null, providerErrorCode: result.providerErrorCode ?? null,
        safeErrorMessage: result.safeMessage.slice(0, 500), durationMs: Date.now() - started
      } });
      if (result.accepted) {
        await tx.smsEmailDelivery.update({ where: { id }, data: {
          status: result.status, providerMessageId: result.providerMessageId, retryCount: attemptNumber,
          claimedAt: null, nextRetryAt: null, retryable: false,
          acceptedAt: new Date(), sentAt: result.status === "SENT" ? new Date() : null
        } });
      } else {
        const exhausted = attemptNumber >= batch.integrationProfile.maximumRetryCount;
        await tx.smsEmailDelivery.update({ where: { id }, data: {
          status: "FAILED", retryCount: attemptNumber, claimedAt: null,
          retryable: result.retryable && !exhausted,
          nextRetryAt: result.retryable && !exhausted ? retryAt(attemptNumber, now) : null,
          failureCode: result.providerErrorCode, failureCategory: result.retryable ? "TRANSIENT" : "PERMANENT",
          failureMessageSafe: result.safeMessage.slice(0, 500), failedAt: new Date()
        } });
      }
    });
  } catch (error) {
    const retryable = error instanceof RetryableFailure;
    const code = error instanceof PermanentFailure || error instanceof RetryableFailure ? error.code : "WORKER_ERROR";
    const attemptNumber = delivery.retryCount + 1;
    await client.$transaction([
      client.smsEmailDeliveryAttempt.create({ data: {
        deliveryId: delivery.id, attemptNumber, providerMode: batch.integrationProfile.mode,
        requestFingerprint: delivery.requestFingerprint, result: retryable ? "RETRYABLE_FAILURE" : "PERMANENT_FAILURE",
        providerErrorCode: code, safeErrorMessage: safeError(error)
      } }),
      client.smsEmailDelivery.update({ where: { id }, data: {
        status: "FAILED", retryCount: attemptNumber, claimedAt: null,
        retryable: retryable && attemptNumber < batch.integrationProfile.maximumRetryCount,
        nextRetryAt: retryable && attemptNumber < batch.integrationProfile.maximumRetryCount ? retryAt(attemptNumber, now) : null,
        failureCode: code, failureCategory: retryable ? "TRANSIENT" : "PERMANENT",
        failureMessageSafe: safeError(error), failedAt: new Date()
      } })
    ]);
  }
  await refreshSmsEmailBatch(client, batch.id);
  return client.smsEmailDelivery.findUnique({ where: { id }, select: { id: true, status: true, retryable: true, retryCount: true } });
}

export async function revalidateSmsEmailDelivery(client: any, delivery: any) {
  if (delivery.batch.status === "CANCELLED") throw new PermanentFailure("CANCELLED", "Batch was cancelled.");
  if (delivery.batch.integrationProfile.status !== "ACTIVE") throw new PermanentFailure("PROFILE_INACTIVE", "Integration profile is not active.");
  if (delivery.batch.integrationProfile.mode === "LIVE" && !delivery.batch.integrationProfile.liveSendingEnabled) throw new PermanentFailure("LIVE_SENDING_DISABLED", "LIVE sending is disabled.");
  if (delivery.batch.templateMapping.status !== "ACTIVE" || delivery.batch.templateMapping.providerStatus !== "APPROVED") {
    throw new PermanentFailure("TEMPLATE_NOT_SENDABLE", "Template mapping is no longer active and approved.");
  }
  if (delivery.batch.notificationCampaign.status !== "PUBLISHED" || !delivery.batch.notificationCampaign.publishedAt) {
    throw new PermanentFailure("CAMPAIGN_NOT_SENDABLE", "Notification campaign is no longer published.");
  }
  try { assertSmsEmailBatchSnapshotsCurrent(delivery.batch); }
  catch { throw new PermanentFailure("APPROVED_SNAPSHOT_CHANGED", "Approved campaign or template changed after approval."); }
  if (delivery.consent.status !== "OPTED_IN" || delivery.consent.contactHash !== delivery.contactHash || (delivery.consent.expiresAt && delivery.consent.expiresAt <= new Date())) throw new PermanentFailure("NO_CONSENT", "Current contact-bound consent is unavailable.");
  const subjectWhere = delivery.subjectType === "GUARDIAN" ? { guardianId: delivery.guardianId } : { staffMemberId: delivery.staffMemberId };
  const suppression = await client.smsEmailSuppression.findFirst({ where: { channel: delivery.channel, contactHash: delivery.contactHash, status: "ACTIVE", ...subjectWhere } });
  if (suppression) throw new PermanentFailure("SUPPRESSED_CONTACT", "Contact is suppressed.");
}

async function enforceLimits(client: any, delivery: any, now: Date) {
  const profile = delivery.batch.integrationProfile;
  const hour = new Date(now.getTime() - 60 * 60_000), day = new Date(now.getTime() - 24 * 60 * 60_000);
  const [hourly, daily] = await Promise.all([
    profile.hourlyLimit ? client.smsEmailDelivery.count({ where: { batch: { integrationProfileId: profile.id }, acceptedAt: { gte: hour } } }) : 0,
    profile.dailyLimit ? client.smsEmailDelivery.count({ where: { batch: { integrationProfileId: profile.id }, acceptedAt: { gte: day } } }) : 0
  ]);
  if (profile.hourlyLimit && hourly >= profile.hourlyLimit) throw new RetryableFailure("LOCAL_HOURLY_LIMIT_BLOCKED", "Local hourly limit reached.");
  if (profile.dailyLimit && daily >= profile.dailyLimit) throw new RetryableFailure("LOCAL_DAILY_LIMIT_BLOCKED", "Local daily limit reached.");
}

export async function refreshSmsEmailBatch(client: any, batchId: string) {
  const rows = await client.smsEmailDelivery.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } });
  const counts = Object.fromEntries(rows.map((row: any) => [row.status, row._count._all]));
  const active = (counts.QUEUED ?? 0) + (counts.SENDING ?? 0);
  const failed = counts.FAILED ?? 0;
  const terminalFailures = failed + (counts.BOUNCED ?? 0) + (counts.COMPLAINED ?? 0) + (counts.SUPPRESSED ?? 0);
  const total = rows.reduce((sum: number, row: any) => sum + row._count._all, 0);
  const status = active ? "PROCESSING"
    : terminalFailures ? terminalFailures === total ? "FAILED" : "PARTIALLY_FAILED"
    : total ? "COMPLETED" : "FAILED";
  return client.smsEmailOutboundBatch.update({ where: { id: batchId }, data: {
    status, totalQueued: active, totalAccepted: counts.ACCEPTED ?? 0, totalSent: counts.SENT ?? 0,
    totalDelivered: counts.DELIVERED ?? 0, totalBounced: counts.BOUNCED ?? 0,
    totalComplained: counts.COMPLAINED ?? 0, totalSuppressed: counts.SUPPRESSED ?? 0,
    totalFailed: failed, completedAt: active ? null : new Date()
  } });
}

function retryAt(attempt: number, now: Date) { return new Date(now.getTime() + Math.min(60, 2 ** Math.max(0, attempt - 1)) * 60_000); }
function safeJson(value: string | null) { try { return JSON.parse(value || "{}"); } catch { return {}; } }
export function renderApprovedSmsEmailDelivery(delivery: any) {
  const templateSnapshot = requiredJsonObject(delivery.batch.templateSnapshotJson, "Template snapshot");
  const campaignSnapshot = requiredJsonObject(delivery.batch.notificationCampaignSnapshotJson, "Campaign snapshot");
  const rendered = renderSmsEmailTemplate(templateSnapshot, campaignSnapshot, {
    childCount: safeJson(delivery.safeContextJson)?.childCount
  });
  if (delivery.renderedSubject !== rendered.subject ||
    delivery.renderedParametersSnapshotJson !== JSON.stringify(rendered.parameters)) {
    throw new PermanentFailure("IMMUTABLE_RENDER_SNAPSHOT_MISMATCH", "Approved rendered content snapshot no longer matches.");
  }
  return { ...rendered, templateSnapshot };
}
function requiredJsonObject(value: string | null, label: string) {
  const parsed = safeJson(value);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) ||
    (!("mappingCode" in parsed) && !("campaignNumber" in parsed))) {
    throw new PermanentFailure("INVALID_APPROVAL_SNAPSHOT", `${label} is invalid.`);
  }
  return parsed;
}
function safeError(error: unknown) { const text = error instanceof Error ? error.message : "Worker failed."; return /(token|secret|authorization|credential|bearer)/i.test(text) ? "Provider request failed." : text.slice(0, 500); }
class PermanentFailure extends Error { constructor(public readonly code: string, message: string) { super(message); } }
class RetryableFailure extends Error { constructor(public readonly code: string, message: string) { super(message); } }
