import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createOcrBatch, ensureFeeRegisterOcrFoundation } from "@/lib/fee-register-ocr";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR"); if (auth.response) return auth.response;
  await ensureFeeRegisterOcrFoundation(prisma);
  const status = request.nextUrl.searchParams.get("status"), academicYear = request.nextUrl.searchParams.get("academicYear");
  const batches = await prisma.feeRegisterOcrBatch.findMany({
    where: { ...(status ? { status } : {}), ...(academicYear ? { academicYear } : {}) },
    include: { profile: { select: { profileCode: true, providerKind: true, paymentPostingEnabled: true } } },
    orderBy: { createdAt: "desc" }, take: 200
  });
  return NextResponse.json({ batches });
}

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("UPLOAD_FEE_REGISTER_PAGES"); if (auth.response) return auth.response;
  try {
    await ensureFeeRegisterOcrFoundation(prisma);
    return NextResponse.json({ batch: await createOcrBatch(prisma, await request.json(), auth.user.id) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR batch creation failed safely") }, { status: 400 }); }
}
