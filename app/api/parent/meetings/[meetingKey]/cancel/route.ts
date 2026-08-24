import { NextRequest } from "next/server";
import { cancelParentMeetingRequest } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ meetingKey: string }> }) {
  const auth = await requireParentMeetingApiActor("REQUEST_OWN_PARENT_MEETINGS", ["PARENT"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await cancelParentMeetingRequest(prisma, auth.actor, (await context.params).meetingKey, await parseParentMeetingJson(request))); }
  catch (error) { return parentMeetingApiError(error); }
}
