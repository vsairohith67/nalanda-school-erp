import { NextRequest, NextResponse } from "next/server";
import { uploadEventMediaAsset } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ albumKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("UPLOAD_EVENT_MEDIA");
  if (auth.response || !auth.user) return auth.response;
  try {
    const form = await request.formData();
    const file = form.get("photo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose one photo to upload.", code: "PHOTO_REQUIRED" }, { status: 400, headers: EVENT_MEDIA_PRIVATE_HEADERS });
    return NextResponse.json(await uploadEventMediaAsset(prisma, (await context.params).albumKey, file, auth.user), { status: 201, headers: EVENT_MEDIA_PRIVATE_HEADERS });
  } catch (error) { return eventMediaApiFailure(error); }
}
