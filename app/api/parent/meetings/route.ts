import { NextRequest } from "next/server";
import { createParentMeetingRequest, listParentOwnMeetings } from "@/lib/parent-meetings";
import { parentMeetingApiError, parentMeetingJson, parseParentMeetingJson, requireParentMeetingApiActor } from "@/lib/parent-meeting-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireParentMeetingApiActor("VIEW_OWN_PARENT_MEETINGS", ["PARENT"]);
  if (auth.response || !auth.actor) return auth.response;
  try {
    const search = request.nextUrl.searchParams;
    return parentMeetingJson(await listParentOwnMeetings(prisma, auth.actor, { academicYear: search.get("academicYear"), childHandle: search.get("childHandle"), expectedContextVersion: search.get("expectedContextVersion") }));
  } catch (error) { return parentMeetingApiError(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireParentMeetingApiActor("REQUEST_OWN_PARENT_MEETINGS", ["PARENT"]);
  if (auth.response || !auth.actor) return auth.response;
  try { return parentMeetingJson(await createParentMeetingRequest(prisma, auth.actor, await parseParentMeetingJson(request)), 201); }
  catch (error) { return parentMeetingApiError(error); }
}

