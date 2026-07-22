import { prisma } from "@/lib/prisma";
import { ensureSmsEmailMockProfiles, runSmsEmailProfileHealth } from "@/lib/sms-email-profiles";

async function main() {
  await ensureSmsEmailMockProfiles(prisma);
  const profiles = await prisma.smsEmailIntegrationProfile.findMany({ orderBy: [{ channel: "asc" }, { profileCode: "asc" }] });
  for (const profile of profiles) {
    const health = await runSmsEmailProfileHealth(prisma, profile.id, false);
    console.log(`${profile.channel} ${profile.profileCode} ${profile.mode}: ${health.status} — ${health.message}`);
  }
  console.log("No live network health request was authorised.");
}
main().finally(() => prisma.$disconnect());

