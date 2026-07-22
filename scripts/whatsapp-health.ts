import { prisma } from "@/lib/prisma";
import { runWhatsAppProfileHealth } from "@/lib/whatsapp-profiles";

async function main() {
  const rows = await prisma.whatsAppIntegrationProfile.findMany({ orderBy: { profileCode: "asc" } });
  if (!rows.length) { console.log("No WhatsApp integration profiles are configured."); return; }
  for (const row of rows) {
    const health = await runWhatsAppProfileHealth(prisma, row.id, process.argv.includes("--network"));
    console.log(`${row.profileCode}\t${row.mode}\t${health.status}\t${health.message}`);
  }
}
main().catch((error) => { console.error(error instanceof Error ? error.message : "Health check failed."); process.exitCode = 1; }).finally(() => prisma.$disconnect());
