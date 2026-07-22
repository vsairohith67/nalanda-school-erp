import { prisma } from "@/lib/prisma";
import { signMockSmsEmailWebhook } from "@/lib/sms-email-provider";
import { processSmsEmailWebhook, safeSmsEmailWebhookFixture } from "@/lib/sms-email-webhooks";

async function main() {
  const deliveries = await prisma.smsEmailDelivery.findMany({
    where: { providerMessageId: { not: null }, batch: { notificationCampaign: { title: { startsWith: "QA19C" } }, integrationProfile: { mode: "MOCK" } } },
    include: { batch: { include: { integrationProfile: true } } },
    orderBy: { createdAt: "asc" }
  });
  if (!deliveries.length) {
    console.log("No QA19C MOCK provider deliveries are available. No fixture was processed.");
    return;
  }
  let emailFixtureProcessed = false;
  for (const delivery of deliveries) {
    if (delivery.channel === "EMAIL" && emailFixtureProcessed) {
      console.log(`Email ${delivery.id}: retained ACCEPTED semantics; Gmail-style acceptance is not delivery.`);
      continue;
    }
    const status = delivery.channel === "SMS" ? "DELIVERED" : "BOUNCED";
    if (delivery.channel === "EMAIL") emailFixtureProcessed = true;
    const raw = JSON.stringify(safeSmsEmailWebhookFixture(delivery.channel as "SMS" | "EMAIL", delivery.providerMessageId!, status));
    const result = await processSmsEmailWebhook(prisma, delivery.batch.integrationProfile.profileCode, raw, signMockSmsEmailWebhook(raw));
    console.log(`${delivery.channel} ${delivery.id}: ${JSON.stringify(result)}`);
  }
}
main().finally(() => prisma.$disconnect());
