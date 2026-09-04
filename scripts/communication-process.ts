import { PrismaClient } from "@prisma/client";
import { isCommunicationChannel } from "@/lib/communication-types";
import { processCommunicationOutbox } from "@/lib/communication-service";

const channel = String(process.argv[2] ?? "").toUpperCase();
if (!isCommunicationChannel(channel) || channel === "IN_APP") throw new Error("Usage: pnpm communication:process EMAIL|SMS|WHATSAPP|NATIVE_PUSH");
const pepper = String(process.env.COMMUNICATION_DESTINATION_HASH_PEPPER ?? "");
if (pepper.length < 24) throw new Error("COMMUNICATION_DESTINATION_PEPPER_REQUIRED");
const prisma = new PrismaClient();
try {
  const result = await processCommunicationOutbox(prisma, { channel, workerId: `cli-${process.pid}`, pepper });
  process.stdout.write(`${JSON.stringify(result)}\n`);
} finally {
  await prisma.$disconnect();
}
