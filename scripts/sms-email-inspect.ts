import { prisma } from "@/lib/prisma";

async function main() {
  const [profiles, consents, mappings, batches, deliveries, attempts, webhooks, suppressions, finance] = await Promise.all([
    prisma.smsEmailIntegrationProfile.groupBy({ by: ["channel", "mode", "status"], _count: { _all: true } }),
    prisma.smsEmailConsent.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    prisma.smsEmailTemplateMapping.groupBy({ by: ["channel", "status", "providerStatus"], _count: { _all: true } }),
    prisma.smsEmailOutboundBatch.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    prisma.smsEmailDelivery.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    prisma.smsEmailDeliveryAttempt.count(),
    prisma.smsEmailWebhookEvent.count(),
    prisma.smsEmailSuppression.groupBy({ by: ["channel", "status"], _count: { _all: true } }),
    Promise.all([prisma.expenseRecord.count(), prisma.budgetPlan.count(), prisma.payment.count(), prisma.cashBookMovement.count(), prisma.miscIncomeReceipt.count()])
  ]);
  console.log(JSON.stringify({ profiles, consents, mappings, batches, deliveries, attempts, webhooks, suppressions, financeControlCounts: finance }, null, 2));
}
main().finally(() => prisma.$disconnect());

