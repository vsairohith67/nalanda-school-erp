import { processParentMeetingReminders } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const auth = await requireParentMeetingApiActor("MANAGE_PARENT_MEETINGS", ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await processParentMeetingReminders(prisma, auth.actor)); }
  catch (error) { return parentMeetingApiError(error); }
}

