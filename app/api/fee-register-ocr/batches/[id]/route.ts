import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ocrBatchCancelPermission, ocrBatchInclude, transitionOcrBatch } from "@/lib/fee-register-ocr";
import type { Permission } from "@/lib/permissions";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR"); if (auth.response) return auth.response;
  const batch = await prisma.feeRegisterOcrBatch.findUnique({ where: { id: (await params).id }, include: ocrBatchInclude });
  return batch ? NextResponse.json({ batch }) : NextResponse.json({ error: "OCR batch not found" }, { status: 404 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({}));
  const id = (await params).id;
  let permission: Permission = body.action === "approve" ? "APPROVE_FEE_REGISTER_OCR_BATCHES" : body.action === "submit" ? "REVIEW_FEE_REGISTER_OCR_ROWS" : "UPLOAD_FEE_REGISTER_PAGES";
  if (body.action === "cancel") {
    const view = await requireApiPermission("VIEW_FEE_REGISTER_OCR"); if (view.response) return view.response;
    const batch = await prisma.feeRegisterOcrBatch.findUnique({ where: { id }, select: { status: true } });
    if (!batch) return NextResponse.json({ error: "OCR batch not found" }, { status: 404 });
    permission = ocrBatchCancelPermission(batch.status) ?? "REVIEW_FEE_REGISTER_OCR_ROWS";
  }
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    const batch = await transitionOcrBatch(prisma, id, body, auth.user);
    return NextResponse.json({ batch });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR workflow action failed safely") }, { status: 400 }); }
}
