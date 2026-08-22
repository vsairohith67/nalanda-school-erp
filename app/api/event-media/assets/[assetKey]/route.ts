import { NextRequest, NextResponse } from "next/server";
import { updateEventMediaAsset } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: NextRequest, context: { params: Promise<{ assetKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("REVIEW_EVENT_MEDIA");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await updateEventMediaAsset(prisma, (await context.params).assetKey, await request.json(), auth.user), { headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}
