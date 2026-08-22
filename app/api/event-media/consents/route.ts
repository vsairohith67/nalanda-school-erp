import { NextRequest, NextResponse } from "next/server";
import { recordMediaPublicationConsent } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const auth = await requireEventMediaManagementApiPermission("MANAGE_MEDIA_PUBLICATION_CONSENT");
  if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json(await recordMediaPublicationConsent(prisma, await request.json(), auth.user), { status: 201, headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}
