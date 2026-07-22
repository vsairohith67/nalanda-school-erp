import { prisma } from "@/lib/prisma";
import { processSmsEmailQueue } from "@/lib/sms-email-worker";

async function main() {
  const result = await processSmsEmailQueue(prisma, { limit: Number(process.argv[2]) || 25 });
  console.log(JSON.stringify(result, null, 2));
}
main().finally(() => prisma.$disconnect());

