import { prisma } from "@/lib/prisma";
import { processSmsEmailQueue } from "@/lib/sms-email-worker";
import { communicationFeatureAvailability } from "@/lib/communication-policy";

async function main() {
  const channel = String(process.argv[2] ?? "").toUpperCase();
  if (!["SMS", "EMAIL"].includes(channel) || !communicationFeatureAvailability(channel as "SMS" | "EMAIL").enabled) throw new Error("COMMUNICATION_CHANNEL_DISABLED");
  const result = await processSmsEmailQueue(prisma, { limit: Number(process.argv[3]) || 25, channel: channel as "SMS" | "EMAIL" });
  console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());
