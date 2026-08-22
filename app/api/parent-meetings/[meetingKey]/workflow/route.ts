import { NextRequest } from "next/server";
import { transitionParentMeeting } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ meetingKey: string }> }) {
  const auth = await requireParentMeetingApiActor("MANAGE_PARENT_MEETINGS", ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await transitionParentMeeting(prisma, auth.actor, (await context.params).meetingKey, await parseParentMeetingJson(request))); }
  catch (error) { return parentMeetingApiError(error); }
}

