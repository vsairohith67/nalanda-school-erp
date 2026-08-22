import { NextRequest, NextResponse } from "next/server";
import { updateEventMediaAlbum } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ albumKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("CREATE_EVENT_MEDIA_ALBUMS");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await updateEventMediaAlbum(prisma, (await context.params).albumKey, await request.json(), auth.user), { headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}
