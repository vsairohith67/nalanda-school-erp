import { SMS_EMAIL_SKIP_REASONS } from "@/lib/sms-email-audiences";

export async function loadSmsEmailReports(client: any) {
  const [profiles, consents, suppressions, batches, deliveries, attempts, webhooks, events, mappings] = await Promise.all([
    client.smsEmailIntegrationProfile.findMany({ select: { profileCode: true, channel: true, mode: true, status: true, spfStatus: true, dkimStatus: true, dmarcStatus: true, senderAliasStatus: true } }),
    client.smsEmailConsent.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    client.smsEmailSuppression.groupBy({ by: ["channel", "status", "reason"], _count: { _all: true } }),
    client.smsEmailOutboundBatch.findMany({ orderBy: { createdAt: "desc" }, select: {
      batchNumber: true, channel: true, status: true, totalCampaignRecipients: true, totalEligibleContacts: true,
      totalSkipped: true, skipReasonCountsJson: true, estimatedSegments: true, estimatedMaximumCostMinor: true,
      estimatedCostCurrency: true, rateVersion: true, createdAt: true,
      integrationProfile: { select: { profileCode: true, mode: true } },
      templateMapping: { select: { mappingCode: true, smsHeader: true, emailSenderAlias: true } }
    } }),
    client.smsEmailDelivery.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    client.smsEmailDeliveryAttempt.groupBy({ by: ["result"], _count: { _all: true } }),
    client.smsEmailWebhookEvent.groupBy({ by: ["channel", "eventType", "processingStatus"], _count: { _all: true }, _sum: { duplicateCount: true } }),
    client.smsEmailOperationalEvent.groupBy({ by: ["eventType"], _count: { _all: true } }),
    client.smsEmailTemplateMapping.groupBy({ by: ["channel", "status", "providerStatus"], _count: { _all: true } })
  ]);
  const skipReasonCounts = Object.fromEntries(SMS_EMAIL_SKIP_REASONS.map((reason) => [reason, 0])) as Record<string, number>;
  for (const batch of batches) {
    try { for (const [reason, count] of Object.entries(JSON.parse(batch.skipReasonCountsJson || "{}"))) skipReasonCounts[reason] = (skipReasonCounts[reason] ?? 0) + Number(count); } catch {}
  }
  return {
    generatedAt: new Date(),
    profiles, consents, suppressions, batches, deliveries, attempts, webhooks, events, mappings, skipReasonCounts,
    totals: {
      campaignRecipients: batches.reduce((sum: number, row: any) => sum + row.totalCampaignRecipients, 0),
      eligible: batches.reduce((sum: number, row: any) => sum + row.totalEligibleContacts, 0),
      skipped: batches.reduce((sum: number, row: any) => sum + row.totalSkipped, 0),
      smsSegments: batches.reduce((sum: number, row: any) => sum + (row.estimatedSegments ?? 0), 0),
      estimatedCostMinor: batches.reduce((sum: number, row: any) => sum + (row.estimatedMaximumCostMinor ?? 0), 0)
    }
  };
}

export function smsEmailReportsCsv(report: Awaited<ReturnType<typeof loadSmsEmailReports>>) {
  const rows: unknown[][] = [["Record type", "Channel", "Scope", "Metric", "Value", "Mode", "Status", "Disclaimer"]];
  const add = (type: string, channel: string, scope: string, metric: string, value: unknown, mode = "", status = "") =>
    rows.push([type, channel, scope, metric, value, mode, status, "Aggregate/estimate only; no full contact, engagement score, quota guarantee or finance posting."]);
  for (const row of report.profiles) add("PROFILE", row.channel, row.profileCode, "readiness", `${row.spfStatus}/${row.dkimStatus}/${row.dmarcStatus}/${row.senderAliasStatus}`, row.mode, row.status);
  for (const row of report.consents) add("CONSENT", row.channel, "ALL", row.status, row._count._all);
  for (const row of report.suppressions) add("SUPPRESSION", row.channel, row.reason, row.status, row._count._all);
  for (const [reason, count] of Object.entries(report.skipReasonCounts)) add("SKIP_REASON", "ALL", "ALL", reason, count);
  for (const row of report.deliveries) add("DELIVERY", row.channel, "ALL", row.status, row._count._all);
  for (const row of report.attempts) add("ATTEMPT", "ALL", "ALL", row.result, row._count._all);
  for (const row of report.webhooks) add("WEBHOOK", row.channel, row.processingStatus, row.eventType, row._count._all);
  for (const row of report.events) add("CONTROL", "ALL", "ALL", row.eventType, row._count._all);
  for (const row of report.mappings) add("TEMPLATE", row.channel, row.providerStatus, row.status, row._count._all);
  for (const row of report.batches) add("BATCH", row.channel, row.batchNumber, `${row.totalEligibleContacts} eligible / ${row.totalSkipped} skipped`, row.estimatedMaximumCostMinor ?? "", row.integrationProfile.mode, row.status);
  add("TOTAL", "ALL", "ALL", "campaignRecipients", report.totals.campaignRecipients);
  add("TOTAL", "ALL", "ALL", "eligible", report.totals.eligible);
  add("TOTAL", "SMS", "ALL", "estimatedSegments", report.totals.smsSegments);
  add("TOTAL", "ALL", "ALL", "estimatedCostMinor", report.totals.estimatedCostMinor);
  return rows.map((row) => row.map(csv).join(",")).join("\r\n");
}

export function smsEmailReportsFilename(now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
  return `sms-email-one-way-aggregate-${date}-IST.csv`;
}
function csv(value: unknown) { const text = String(value ?? ""); const safe = /^[=+\-@]/.test(text) ? `'${text}` : text; return `"${safe.replaceAll("\"", "\"\"")}"`; }

