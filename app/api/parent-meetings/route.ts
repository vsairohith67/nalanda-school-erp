import { NextRequest } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { createLeadershipParentMeeting, listParentMeetingWorkspace } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const context = await getCurrentAuthContext();
  const teacher = context?.user.role === "TEACHER";
  const auth = await requireParentMeetingApiActor(teacher ? "VIEW_ASSIGNED_PARENT_MEETINGS" : "VIEW_PARENT_MEETINGS", teacher ? ["TEACHER"] : ["SUPER_ADMIN", "PRINCIPAL", "DIRECTOR"]);
  if (auth.response || !auth.actor) return auth.response;
  try {
    const search = request.nextUrl.searchParams;
    return parentMeetingJson(await listParentMeetingWorkspace(prisma, auth.actor, { status: search.get("status"), category: search.get("category"), search: search.get("search"), from: search.get("from"), to: search.get("to"), offset: search.get("offset"), limit: search.get("limit") }));
  } catch (error) { return parentMeetingApiError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireParentMeetingApiActor("MANAGE_PARENT_MEETINGS", ["SUPER_ADMIN", "PRINCIPAL"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await createLeadershipParentMeeting(prisma, auth.actor, await parseParentMeetingJson(request)), 201); }
  catch (error) { return parentMeetingApiError(error); }
}

