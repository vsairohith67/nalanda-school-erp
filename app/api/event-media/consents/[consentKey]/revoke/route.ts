import { NextRequest, NextResponse } from "next/server";
import { revokeMediaPublicationConsent } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ consentKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("MANAGE_MEDIA_PUBLICATION_CONSENT");
  if (auth.response || !auth.user) return auth.response;
  try { const body = await request.json(); return NextResponse.json(await revokeMediaPublicationConsent(prisma, (await context.params).consentKey, body?.reason, auth.user), { headers: EVENT_MEDIA_PRIVATE_HEADERS }); }
  catch (error) { return eventMediaApiFailure(error); }
}
