import { NextRequest, NextResponse } from "next/server";
import { createEventMediaAlbum, listEventMediaDashboard } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireEventMediaManagementApiPermission("VIEW_EVENT_MEDIA");
  if (auth.response) return auth.response;
  try { return NextResponse.json(await listEventMediaDashboard(prisma), { headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}

export async function POST(request: NextRequest) {
  const auth = await requireEventMediaManagementApiPermission("CREATE_EVENT_MEDIA_ALBUMS");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await createEventMediaAlbum(prisma, await request.json(), auth.user), { status: 201, headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}
