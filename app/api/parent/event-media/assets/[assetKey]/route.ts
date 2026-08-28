import { NextResponse } from "next/server";
import { requireApiRolePermission } from "@/lib/auth";
import { getPublishedEventMediaDerivative } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS } from "@/lib/event-media-api";
import { readEventMediaBytes } from "@/lib/event-media-files";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ assetKey: string }> }) {
  const auth = await requireApiRolePermission("VIEW_OWN_EVENT_MEDIA", "PARENT");
  if (auth.response || !auth.user) return auth.response;
  try {
    const derivative = await getPublishedEventMediaDerivative(prisma, (await context.params).assetKey, "PARENT_PORTAL", auth.user.guardianId);
    const bytes = await readEventMediaBytes(derivative.storageKey!, derivative.sha256!, derivative.byteSize!);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...EVENT_MEDIA_PRIVATE_HEADERS, "Content-Type": derivative.mediaType!, "Content-Disposition": "inline; filename=private-event-photo.jpg" } });
  } catch (error) { return eventMediaApiFailure(error); }
}
