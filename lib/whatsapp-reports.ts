import { schoolDateKey } from "@/lib/format";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp-phone";
import { WHATSAPP_COST_WARNING } from "@/lib/whatsapp-costs";
import { WHATSAPP_SKIP_REASONS } from "@/lib/whatsapp-batches";

const DELIVERY_STATES = ["QUEUED","SENDING","ACCEPTED","SENT","DELIVERED","READ","FAILED","OPTED_OUT","CANCELLED","UNKNOWN"] as const;

export async function loadWhatsAppReports(client: any) {
  const [
    profiles, consentRows, guardians, staffMembers, consentEvents, batches, deliveryGroups,
    deliveries, attempts, mappings, webhooks, operationalEvents, rates
  ] = await Promise.all([
    client.whatsAppIntegrationProfile.findMany({ select: {
      id: true, profileCode: true, mode: true, status: true, costCapEnabled: true,
      maximumEstimatedBatchCostMinor: true, costCapCurrency: true
    } }),
    client.whatsAppConsent.findMany({ orderBy: { createdAt: "desc" } }),
    client.guardian.findMany({ where: { status: { in: ["Active","ACTIVE"] } }, select: { id: true, primaryMobile: true } }),
    client.staffMember.findMany({ where: { status: "ACTIVE" }, select: { id: true, mobile: true } }),
    client.whatsAppConsentEvent.findMany({ select: { eventType: true } }),
    client.whatsAppOutboundBatch.findMany({
      select: {
        batchNumber: true, status: true, estimatedCostMinor: true, estimatedCostCurrency: true,
        estimateRateVersion: true, emergencyOverride: true, totalCampaignRecipients: true,
        totalEligibleContacts: true, totalSkipped: true, skipReasonCountsJson: true, createdAt: true,
        costCapOverrideSnapshotHash: true, integrationProfile: { select: {
          profileCode: true, mode: true, status: true, costCapEnabled: true,
          maximumEstimatedBatchCostMinor: true, costCapCurrency: true
        } },
        notificationCampaign: { select: { category: true } },
        templateMapping: { select: { mappingCode: true, metaTemplateCategory: true } }
      },
      orderBy: { createdAt: "desc" }
    }),
    client.whatsAppDelivery.groupBy({ by: ["status"], _count: { _all: true } }),
    client.whatsAppDelivery.findMany({ select: {
      status: true, attemptCount: true, retryable: true,
      batch: { select: { estimateRateVersion: true, templateMapping: { select: { metaTemplateCategory: true } }, integrationProfile: { select: { maximumRetryCount: true } } } }
    } }),
    client.whatsAppDeliveryAttempt.findMany({ select: { attemptNumber: true, resultStatus: true, retryable: true, errorCategory: true } }),
    client.whatsAppTemplateMapping.groupBy({ by: ["providerStatus", "status"], _count: { _all: true } }),
    client.whatsAppWebhookEvent.findMany({ select: { eventType: true, mappedStatus: true, processingStatus: true, duplicateReceiptCount: true } }),
    client.whatsAppOperationalEvent.findMany({ select: { eventType: true, occurrenceCount: true } }),
    client.whatsAppRateReference.findMany({ where: { status: "ACTIVE" }, orderBy: { effectiveDate: "desc" } })
  ]);

  const deliveryCounts = Object.fromEntries(DELIVERY_STATES.map((state) => [state, 0])) as Record<string, number>;
  for (const row of deliveryGroups) {
    const key = ["SCHEDULED","RETRY_PENDING"].includes(row.status) ? "QUEUED" : row.status;
    deliveryCounts[key] = (deliveryCounts[key] ?? 0) + row._count._all;
  }
  const operationalCounts = groupOccurrences(operationalEvents);
  const consentCoverage = {
    GUARDIAN: consentCoverageFor("GUARDIAN", guardians, consentRows),
    STAFF: consentCoverageFor("STAFF", staffMembers, consentRows)
  };
  const skipReasonCounts = Object.fromEntries(WHATSAPP_SKIP_REASONS.map((reason) => [reason, 0])) as Record<string, number>;
  for (const batch of batches) {
    for (const [reason, count] of Object.entries(parseCounts(batch.skipReasonCountsJson))) {
      skipReasonCounts[reason] = (skipReasonCounts[reason] ?? 0) + Number(count);
    }
  }
  const ratesByKey = new Map<string, any>();
  for (const rate of rates) {
    const key = `${rate.rateVersion}|${rate.templateCategory}`;
    if (!ratesByKey.has(key)) ratesByKey.set(key, rate);
  }
  const estimatedDeliveredMessageCostMinor = deliveries.reduce((sum: number, row: any) => {
    if (!["DELIVERED","READ"].includes(row.status)) return sum;
    const rate = ratesByKey.get(`${row.batch.estimateRateVersion}|${row.batch.templateMapping.metaTemplateCategory}`);
    return sum + (rate ? Math.round(Number(rate.ratePerDeliveredMessage) * 100) : 0);
  }, 0);
  const delivered = deliveryCounts.DELIVERED + deliveryCounts.READ;
  const sent = delivered + deliveryCounts.SENT;
  const webhookCounts = {
    received: webhooks.length + webhooks.reduce((sum: number, row: any) => sum + row.duplicateReceiptCount, 0)
      + (operationalCounts.WEBHOOK_INVALID_SIGNATURE ?? 0) + (operationalCounts.WEBHOOK_PROCESSING_FAILED ?? 0),
    processed: webhooks.filter((row: any) => row.processingStatus === "PROCESSED").length,
    ignoredDuplicates: webhooks.reduce((sum: number, row: any) => sum + row.duplicateReceiptCount, 0),
    invalidSignatures: operationalCounts.WEBHOOK_INVALID_SIGNATURE ?? 0,
    failedProcessing: operationalCounts.WEBHOOK_PROCESSING_FAILED ?? 0,
    unknownProviderMessageIds: webhooks.filter((row: any) => row.processingStatus === "IGNORED" && row.eventType !== "OPT_OUT_SIGNAL").length,
    optOutWebhookEvents: webhooks.filter((row: any) => row.eventType === "OPT_OUT_SIGNAL").length
  };
  const attemptMetrics = {
    retryableFailures: attempts.filter((row: any) => row.resultStatus === "RETRYABLE_FAILURE" || row.retryable).length,
    permanentFailures: attempts.filter((row: any) => row.resultStatus === "PERMANENT_FAILURE" || (row.resultStatus !== "ACCEPTED" && !row.retryable)).length,
    retryAttempts: attempts.filter((row: any) => row.attemptNumber > 1).length,
    deliveriesSucceedingAfterRetry: deliveries.filter((row: any) => row.attemptCount > 1 && ["ACCEPTED","SENT","DELIVERED","READ"].includes(row.status)).length,
    deliveriesExhaustingRetryLimit: deliveries.filter((row: any) => row.status === "FAILED" && row.attemptCount >= row.batch.integrationProfile.maximumRetryCount).length
  };
  const controlMetrics = {
    optOutEvents: consentEvents.filter((row: any) => row.eventType === "CONSENT_OPTED_OUT").length,
    phoneChangeInvalidations: consentEvents.filter((row: any) => row.eventType === "CONSENT_INVALIDATED_PHONE_CHANGE").length,
    quietHourBlocks: operationalCounts.QUIET_HOURS_BLOCKED ?? 0,
    emergencyQuietHourOverrides: operationalCounts.EMERGENCY_OVERRIDE_USED ?? 0,
    localHourlyLimitBlocks: operationalCounts.LOCAL_HOURLY_LIMIT_BLOCKED ?? 0,
    localDailyLimitBlocks: operationalCounts.LOCAL_DAILY_LIMIT_BLOCKED ?? 0,
    providerRateLimitFailures: operationalCounts.PROVIDER_RATE_LIMIT_RECEIVED ?? attempts.filter((row: any) => row.errorCategory === "RATE_LIMIT").length,
    cancelledBatches: batches.filter((row: any) => row.status === "CANCELLED").length,
    pausedBatches: batches.filter((row: any) => row.integrationProfile.status === "PAUSED" && !["COMPLETED","CANCELLED"].includes(row.status)).length,
    costCapBlocks: operationalCounts.COST_CAP_BLOCKED ?? 0,
    authorisedCostCapOverrides: operationalCounts.COST_CAP_OVERRIDE_APPLIED ?? 0
  };
  const latestRate = rates[0] ?? null;
  return {
    warning: WHATSAPP_COST_WARNING,
    profiles,
    consentCoverage,
    batches,
    deliveryCounts,
    attemptMetrics,
    skipReasonCounts,
    mappings,
    webhookCounts,
    controlMetrics,
    deliveryRate: sent ? Math.round(delivered / sent * 1000) / 10 : 0,
    aggregateReadRate: delivered ? Math.round(deliveryCounts.READ / delivered * 1000) / 10 : 0,
    totalCampaignRecipients: batches.reduce((sum: number, row: any) => sum + row.totalCampaignRecipients, 0),
    eligibleContacts: batches.reduce((sum: number, row: any) => sum + row.totalEligibleContacts, 0),
    skippedContacts: batches.reduce((sum: number, row: any) => sum + row.totalSkipped, 0),
    estimatedMaximumCostMinor: batches.reduce((sum: number, row: any) => sum + (row.estimatedCostMinor ?? 0), 0),
    estimatedEligibleCostMinor: batches.reduce((sum: number, row: any) => sum + (row.estimatedCostMinor ?? 0), 0),
    estimatedDeliveredMessageCostMinor,
    rateReference: latestRate ? {
      rateVersion: latestRate.rateVersion, currency: latestRate.currency, market: latestRate.market,
      category: latestRate.templateCategory, sourceReviewDate: latestRate.sourceReviewDate
    } : null,
    batchesAboveConfiguredCap: batches.filter((row: any) =>
      row.integrationProfile.costCapEnabled && row.integrationProfile.maximumEstimatedBatchCostMinor != null
      && row.estimatedCostMinor != null && row.estimatedCostMinor > row.integrationProfile.maximumEstimatedBatchCostMinor
    ).length,
    modeCounts: {
      MOCK: batches.filter((row: any) => row.integrationProfile.mode === "MOCK").length,
      LIVE: batches.filter((row: any) => row.integrationProfile.mode === "LIVE").length
    }
  };
}

export function whatsappReportsCsv(report: Awaited<ReturnType<typeof loadWhatsAppReports>>) {
  const header = ["Record type","Scope","Metric","Value","Currency","Rate version","Mode","Status","Disclaimer"];
  const rows: unknown[][] = [];
  const metric = (scope: string, name: string, value: unknown, currency = "", rateVersion = "") =>
    rows.push(["AGGREGATE", scope, name, value, currency, rateVersion, "", "", WHATSAPP_COST_WARNING]);
  for (const [type, values] of Object.entries(report.consentCoverage)) for (const [name, value] of Object.entries(values as Record<string, unknown>)) metric(`CONSENT_${type}`, name, value);
  metric("CONTACT_RESOLUTION", "totalCampaignRecipients", report.totalCampaignRecipients);
  metric("CONTACT_RESOLUTION", "eligibleContacts", report.eligibleContacts);
  metric("CONTACT_RESOLUTION", "skippedContacts", report.skippedContacts);
  for (const [name, value] of Object.entries(report.skipReasonCounts)) metric("SKIP_REASON", name, value);
  for (const [name, value] of Object.entries(report.deliveryCounts)) metric("DELIVERY_STATE", name, value);
  for (const [name, value] of Object.entries(report.attemptMetrics)) metric("RETRY_FAILURE", name, value);
  for (const [name, value] of Object.entries(report.controlMetrics)) metric("COMPLIANCE_CONTROL", name, value);
  for (const [name, value] of Object.entries(report.webhookCounts)) metric("WEBHOOK", name, value);
  metric("COST", "preSendMaximumEstimatedCostMinor", report.estimatedMaximumCostMinor, report.rateReference?.currency, report.rateReference?.rateVersion);
  metric("COST", "eligibleContactEstimatedCostMinor", report.estimatedEligibleCostMinor, report.rateReference?.currency, report.rateReference?.rateVersion);
  metric("COST", "deliveredMessageEstimatedCostMinor", report.estimatedDeliveredMessageCostMinor, report.rateReference?.currency, report.rateReference?.rateVersion);
  metric("COST", "batchesAboveConfiguredCap", report.batchesAboveConfiguredCap);
  metric("COST", "rateMarket", report.rateReference?.market ?? "");
  metric("COST", "rateCategory", report.rateReference?.category ?? "");
  metric("COST", "sourceReviewDate", report.rateReference ? schoolDateKey(report.rateReference.sourceReviewDate) : "");
  for (const profile of report.profiles) rows.push(["PROFILE_AGGREGATE", profile.profileCode, "mode/status", "", "", "", profile.mode, profile.status, WHATSAPP_COST_WARNING]);
  for (const mapping of report.mappings) rows.push(["TEMPLATE_READINESS", "ALL", `${mapping.providerStatus}/${mapping.status}`, mapping._count._all, "", "", "", "", WHATSAPP_COST_WARNING]);
  metric("MODE", "MOCK batches", report.modeCounts.MOCK);
  metric("MODE", "LIVE batches", report.modeCounts.LIVE);
  for (const row of report.batches) rows.push([
    "BATCH_AGGREGATE", row.batchNumber, "eligible/skipped",
    `${row.totalEligibleContacts}/${row.totalSkipped}`, row.estimatedCostCurrency ?? "", row.estimateRateVersion ?? "",
    row.integrationProfile.mode, row.status, WHATSAPP_COST_WARNING
  ]);
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export function whatsappReportsFilename(now = new Date()) {
  return `whatsapp-one-way-aggregate-${schoolDateKey(now)}-IST.csv`;
}
function csvCell(value: unknown) {
  const text = String(value ?? "");
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll("\"", "\"\"")}"`;
}
function parseCounts(json: string | null | undefined) {
  try {
    const value = JSON.parse(json || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, number> : {};
  } catch { return {}; }
}
function groupOccurrences(rows: Array<{ eventType: string; occurrenceCount: number }>) {
  const result: Record<string, number> = {};
  for (const row of rows) result[row.eventType] = (result[row.eventType] ?? 0) + row.occurrenceCount;
  return result;
}
function consentCoverageFor(subjectType: "GUARDIAN" | "STAFF", subjects: any[], consents: any[]) {
  const latest = new Map<string, any>();
  for (const consent of consents) {
    if (consent.subjectType !== subjectType) continue;
    const id = subjectType === "GUARDIAN" ? consent.guardianId : consent.staffMemberId;
    if (id && !latest.has(id)) latest.set(id, consent);
  }
  let missingPhone = 0, invalidPhone = 0, optedIn = 0, optedOut = 0, expired = 0, invalidated = 0;
  for (const subject of subjects) {
    const phone = subjectType === "GUARDIAN" ? subject.primaryMobile : subject.mobile;
    if (!String(phone ?? "").trim()) missingPhone++;
    else {
      try { normalizeWhatsAppPhone(phone, { defaultCountryCode: "+91", allowDefaultCountryCode: true }); }
      catch { invalidPhone++; }
    }
    const consent = latest.get(subject.id);
    if (!consent) continue;
    if (consent.status === "OPTED_IN" && consent.expiresAt && consent.expiresAt <= new Date()) expired++;
    else if (consent.status === "OPTED_IN") optedIn++;
    else if (consent.status === "OPTED_OUT") optedOut++;
    else if (consent.status === "EXPIRED") expired++;
    else if (consent.status === "INVALIDATED") invalidated++;
  }
  const eligibleSubjects = subjects.length;
  return {
    eligibleSubjects, optedIn, optedOut, expired, invalidatedAfterPhoneChange: invalidated,
    missingPhone, invalidPhone,
    coveragePercentage: eligibleSubjects ? Math.round(optedIn / eligibleSubjects * 1000) / 10 : 0
  };
}
