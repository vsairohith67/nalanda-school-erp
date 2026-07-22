import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addOcrEvent, assertOcrBatchContentAdditionAllowed, refreshOcrBatch } from "@/lib/fee-register-ocr";
import { purgeRegisterImage, storeRegisterImage, validateRegisterImage } from "@/lib/fee-register-ocr-storage";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR"); if (auth.response) return auth.response;
  return NextResponse.json({ pages: await prisma.feeRegisterOcrPage.findMany({ where: { batchId: (await params).id }, orderBy: { pageNumber: "asc" } }) });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("UPLOAD_FEE_REGISTER_PAGES"); if (auth.response) return auth.response;
  let storageKey: string | null = null;
  try {
    const batchId = (await params).id;
    const batch = await prisma.feeRegisterOcrBatch.findUnique({ where: { id: batchId }, include: { profile: true, pages: true } });
    if (!batch) throw new Error("OCR batch is unavailable for upload");
    assertOcrBatchContentAdditionAllowed(batch.status);
    if (batch.pages.length >= batch.profile.maximumPagesPerBatch) throw new Error("This OCR batch reached its configured page limit");
    const data = await request.formData(), file = data.get("file");
    if (!(file instanceof File)) throw new Error("Choose a register image");
    const image = validateRegisterImage({ bytes: Buffer.from(await file.arrayBuffer()), filename: file.name, declaredMime: file.type || null }, batch.profile);
    const duplicate = await prisma.feeRegisterOcrPage.findFirst({ where: { sourceSha256: image.sha256 }, select: { id: true, batchId: true } });
    if (duplicate) throw new Error("This exact register source image is already staged; duplicate upload was blocked");
    const batchBytes = batch.pages.reduce((sum, page) => sum + page.byteSize, 0);
    if (batchBytes + image.byteSize > batch.profile.maximumFileBytes * batch.profile.maximumPagesPerBatch) throw new Error("The OCR batch exceeds its bounded total upload size");
    storageKey = await storeRegisterImage(image);
    const page = await prisma.$transaction(async (tx) => {
      const created = await tx.feeRegisterOcrPage.create({ data: {
        batchId, pageNumber: batch.pages.length + 1, originalDisplayName: image.displayName, storageKey: storageKey!,
        sourceSha256: image.sha256, mimeType: image.mimeType, byteSize: image.byteSize, width: image.width, height: image.height,
        providerKind: batch.profile.providerKind, purgeAfter: batch.profile.retentionDays ? new Date(Date.now() + batch.profile.retentionDays * 86_400_000) : null
      } });
      await addOcrEvent(tx, batchId, "PAGE_UPLOADED", auth.user.id, "Validated private register page uploaded", { pageId: created.id, sha256: image.sha256, mimeType: image.mimeType, byteSize: image.byteSize });
      await refreshOcrBatch(tx, batchId);
      return created;
    });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    if (storageKey) await purgeRegisterImage(storageKey).catch(() => undefined);
    return NextResponse.json({ error: safeClientError(error, "Register image upload failed safely") }, { status: 400 });
  }
}
