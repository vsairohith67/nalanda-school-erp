import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addOcrEvent } from "@/lib/fee-register-ocr";
import { purgeRegisterImage } from "@/lib/fee-register-ocr-storage";

export async function POST(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const auth = await requireApiPermission("PURGE_FEE_REGISTER_OCR_IMAGES"); if (auth.response) return auth.response;
  try {
    const page = await prisma.feeRegisterOcrPage.findUnique({ where: { id: (await params).pageId }, include: { rows: true } });
    if (!page) return NextResponse.json({ error: "OCR page not found" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== `PURGE ${page.sourceSha256.slice(0, 12)}`) throw new Error("Exact source purge confirmation is required");
    if (!["CANCELLED", "POSTED", "ARCHIVED"].includes((await prisma.feeRegisterOcrBatch.findUniqueOrThrow({ where: { id: page.batchId } })).status) && page.rows.some((row) => !["REJECTED", "POSTED", "DUPLICATE"].includes(row.status))) throw new Error("Active review evidence cannot be purged");
    await purgeRegisterImage(page.storageKey);
    await prisma.$transaction(async (tx) => {
      await tx.feeRegisterOcrPage.update({ where: { id: page.id }, data: { status: "PURGED", purgedAt: new Date(), rawOcrText: null } });
      await addOcrEvent(tx, page.batchId, "SOURCE_PURGED", auth.user.id, "Source image bytes purged; metadata and review history preserved", { pageId: page.id, sha256: page.sourceSha256 });
    });
    return NextResponse.json({ purged: true, sourceAvailable: false });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR source purge failed safely") }, { status: 400 }); }
}
