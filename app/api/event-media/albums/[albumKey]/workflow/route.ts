import { NextRequest, NextResponse } from "next/server";
import { transitionEventMediaAlbum } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";
import type { CanonicalPermission } from "@/lib/permissions";

const permissions: Record<string, CanonicalPermission> = { SUBMIT_REVIEW: "REVIEW_EVENT_MEDIA", APPROVE: "APPROVE_EVENT_MEDIA", PUBLISH: "PUBLISH_EVENT_MEDIA", UNPUBLISH: "PUBLISH_EVENT_MEDIA", ARCHIVE: "ARCHIVE_EVENT_MEDIA" };

export async function POST(request: NextRequest, context: { params: Promise<{ albumKey: string }> }) {
  try {
    const body = await request.json();
    const action = String(body?.action ?? "");
    const permission = permissions[action];
    if (!permission) return NextResponse.json({ error: "Album action is unsupported.", code: "ALBUM_ACTION_INVALID" }, { status: 400, headers: EVENT_MEDIA_PRIVATE_HEADERS });
    const auth = await requireEventMediaManagementApiPermission(permission);
    if (auth.response || !auth.user) return auth.response;
    return NextResponse.json(await transitionEventMediaAlbum(prisma, (await context.params).albumKey, action, auth.user), { headers: EVENT_MEDIA_PRIVATE_HEADERS });
  } catch (error) { return eventMediaApiFailure(error); }
}
