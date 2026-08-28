import { NextRequest, NextResponse } from "next/server";
import { getEventMediaAsset } from "@/lib/event-media";
import { eventMediaApiFailure, EVENT_MEDIA_PRIVATE_HEADERS, requireEventMediaManagementApiPermission } from "@/lib/event-media-api";
import { readEventMediaBytes } from "@/lib/event-media-files";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ assetKey: string }> }) {
  const auth = await requireEventMediaManagementApiPermission("VIEW_EVENT_MEDIA");
  if (auth.response) return auth.response;
  try {
    const asset = await getEventMediaAsset(prisma, (await context.params).assetKey);
    const variant = request.nextUrl.searchParams.get("variant") === "original" ? "original" : "thumbnail";
    if (variant === "original") {
      const bytes = await readEventMediaBytes(asset.originalStorageKey, asset.originalSha256, asset.originalByteSize);
      return new NextResponse(new Uint8Array(bytes), { headers: { ...EVENT_MEDIA_PRIVATE_HEADERS, "Content-Type": asset.originalMediaType, "Content-Disposition": `inline; filename="private-original${asset.originalExtension}"` } });
    }
    const derivative = asset.derivatives.find((row: { kind: string; status: string }) => row.kind === "THUMBNAIL" && row.status === "READY");
    if (!derivative?.storageKey || !derivative.sha256 || !derivative.mediaType || !derivative.byteSize) return NextResponse.json({ error: "The safe derivative is unavailable." }, { status: 404, headers: EVENT_MEDIA_PRIVATE_HEADERS });
    const bytes = await readEventMediaBytes(derivative.storageKey, derivative.sha256, derivative.byteSize);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...EVENT_MEDIA_PRIVATE_HEADERS, "Content-Type": derivative.mediaType, "Content-Disposition": "inline; filename=private-thumbnail.jpg" } });
  } catch (error) { return eventMediaApiFailure(error); }
}
