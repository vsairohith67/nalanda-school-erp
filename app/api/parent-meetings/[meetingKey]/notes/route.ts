import { NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { recordParentMeetingNote } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ meetingKey: string }> }) {
  const current = await getCurrentAuthContext();
  const teacher = current?.user.role === "TEACHER";
  const auth = await requireParentMeetingApiActor(teacher ? "CONTRIBUTE_ASSIGNED_PARENT_MEETINGS" : "MANAGE_PARENT_MEETINGS", teacher ? ["TEACHER"] : ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await recordParentMeetingNote(prisma, auth.actor, (await context.params).meetingKey, await parseParentMeetingJson(request)), 201); }
  catch (error) { return parentMeetingApiError(error); }
}

