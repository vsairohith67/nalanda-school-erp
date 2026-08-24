import { NextRequest } from "next/server";
import { createParentMeetingFollowUp } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ meetingKey: string }> }) {
  const auth = await requireParentMeetingApiActor("MANAGE_PARENT_MEETINGS", ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await createParentMeetingFollowUp(prisma, auth.actor, (await context.params).meetingKey, await parseParentMeetingJson(request)), 201); }
  catch (error) { return parentMeetingApiError(error); }
}

