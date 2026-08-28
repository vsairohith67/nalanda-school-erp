import { NextResponse } from "next/server";
import { getPublishedEventMediaDerivative } from "@/lib/event-media";
import { eventMediaApiFailure } from "@/lib/event-media-api";
import { readEventMediaBytes } from "@/lib/event-media-files";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, context: { params: Promise<{ assetKey: string }> }) {
  try {
    const derivative = await getPublishedEventMediaDerivative(prisma, (await context.params).assetKey, "PUBLIC");
    const bytes = await readEventMediaBytes(derivative.storageKey!, derivative.sha256!, derivative.byteSize!);
    return new NextResponse(new Uint8Array(bytes), { headers: { "Content-Type": derivative.mediaType!, "Content-Disposition": "inline; filename=event-photo.jpg", "Cache-Control": "public, max-age=0, must-revalidate", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return eventMediaApiFailure(error); }
}
