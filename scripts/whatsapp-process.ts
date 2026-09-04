import { prisma } from "@/lib/prisma";
import { processWhatsAppQueue } from "@/lib/whatsapp-worker";
import { communicationFeatureAvailability } from "@/lib/communication-policy";

async function main() {
  if (!communicationFeatureAvailability("WHATSAPP").enabled) throw new Error("COMMUNICATION_CHANNEL_DISABLED");
  const limitArg = process.argv.find((value) => value.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : 25;
  const summary = await processWhatsAppQueue(prisma, { limit });
  console.log(JSON.stringify(summary, null, 2));
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Queue processing failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
