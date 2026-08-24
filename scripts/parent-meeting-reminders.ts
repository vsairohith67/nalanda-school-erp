import { prisma } from "../lib/prisma";
import { parentMeetingsEnabled } from "../lib/parent-meeting-feature";
import { processParentMeetingReminders } from "../lib/parent-meetings";

async function main() {
  if (!parentMeetingsEnabled()) {
    console.log(JSON.stringify({ result: "PARENT_MEETINGS_DEFAULT_OFF_NO_ACTION", externalProviders: false }));
    return;
  }
  const now = new Date();
  const user = await prisma.user.findFirst({
    where: { isActive: true, lifecycleStatus: "ACTIVE", iamRoleAssignments: { some: { role: { in: ["SUPER_ADMIN", "PRINCIPAL"] }, status: "ACTIVE", validFrom: { lte: now }, OR: [{ validUntil: null }, { validUntil: { gt: now } }] } } },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: "asc" }, { id: "asc" }]
  });
  if (!user || !["SUPER_ADMIN", "PRINCIPAL"].includes(user.role)) throw new Error("No active authorised Parent Meetings reminder actor is available");
  const result = await processParentMeetingReminders(prisma, { user: { ...user, guardianId: null, roleAssignmentId: null }, sessionId: "LOCAL_GOVERNED_REMINDER_JOB" } as never, now);
  console.log(JSON.stringify({ result: "PARENT_MEETING_REMINDERS_PROCESSED", ...result, channel: "IN_APP", externalProviders: false }, null, 2));
}

main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }).finally(() => prisma.$disconnect());
