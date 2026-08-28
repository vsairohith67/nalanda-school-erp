import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readRegisterImage } from "@/lib/fee-register-ocr-storage";

export async function GET(_: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR_IMAGES"); if (auth.response) return auth.response;
  const page = await prisma.feeRegisterOcrPage.findUnique({ where: { id: (await params).pageId } });
  if (!page || ["PURGED", "MISSING_SOURCE"].includes(page.status)) return NextResponse.json({ error: "OCR source image is unavailable" }, { status: 404, headers: privateHeaders() });
  try {
    const bytes = await readRegisterImage(page.storageKey, page.sourceSha256, page.byteSize);
    return new NextResponse(new Uint8Array(bytes), { headers: { ...privateHeaders(), "Content-Type": page.mimeType, "Content-Length": String(bytes.length), "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch {
    return NextResponse.json({ error: "OCR source image is unavailable" }, { status: 404, headers: privateHeaders() });
  }
}
function privateHeaders() { return { "Cache-Control": "private, no-store, max-age=0", "Pragma": "no-cache", "X-Content-Type-Options": "nosniff", "Vary": "Cookie" }; }
