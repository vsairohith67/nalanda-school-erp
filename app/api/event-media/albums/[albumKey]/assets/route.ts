import { NextRequest, NextResponse } from "next/server";
import { uploadEventMediaAsset } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { prisma } from "@/lib/prisma";
import { ResourceGuardError, withOperationCapacity } from "@/lib/resource-guard";

export async function POST(request: NextRequest, context: { params: Promise<{ albumKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("UPLOAD_EVENT_MEDIA");
  if (auth.response || !auth.user) return auth.response;
  try {
    return await withOperationCapacity("EVENT_MEDIA_IMAGE", async () => {
      const form = await request.formData();
      const file = form.get("photo");
      if (!(file instanceof File)) return NextResponse.json({ error: "Choose one photo to upload.", code: "PHOTO_REQUIRED" }, { status: 400, headers: EVENT_MEDIA_PRIVATE_HEADERS });
      return NextResponse.json(await uploadEventMediaAsset(prisma, (await context.params).albumKey, file, auth.user), { status: 201, headers: EVENT_MEDIA_PRIVATE_HEADERS });
    });
  } catch (error) {
    if (error instanceof ResourceGuardError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status, headers: { ...EVENT_MEDIA_PRIVATE_HEADERS, "Retry-After": String(error.retryAfterSeconds) } });
    return eventMediaApiFailure(error);
  }
}
