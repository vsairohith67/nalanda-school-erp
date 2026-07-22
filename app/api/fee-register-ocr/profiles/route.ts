import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureFeeRegisterOcrFoundation } from "@/lib/fee-register-ocr";

export async function GET() {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR"); if (auth.response) return auth.response;
  await ensureFeeRegisterOcrFoundation(prisma);
  return NextResponse.json({ profiles: await prisma.feeRegisterOcrProfile.findMany({ orderBy: { createdAt: "asc" } }) });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_FEE_REGISTER_OCR_PROFILES"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), id = String(body.id ?? ""), action = String(body.action ?? "");
    const profile = await prisma.feeRegisterOcrProfile.findUnique({ where: { id } });
    if (!profile) return NextResponse.json({ error: "OCR profile not found" }, { status: 404 });
    if (action === "activate") {
      if (!["MOCK", "MANUAL"].includes(profile.providerKind)) throw new Error("Only MOCK and MANUAL may be activated during Prompt 20B");
      if (body.confirmation !== `ACTIVATE ${profile.profileCode}`) throw new Error("Exact profile activation confirmation is required");
      await prisma.feeRegisterOcrProfile.update({ where: { id }, data: { status: "ACTIVE", liveUseEnabled: false, paymentPostingEnabled: false, activatedByUserId: auth.user.id } });
    } else if (action === "pause") {
      await prisma.feeRegisterOcrProfile.update({ where: { id }, data: { status: "PAUSED", liveUseEnabled: false, paymentPostingEnabled: false, pausedByUserId: auth.user.id } });
    } else if (action === "updateLimits") {
      const integer = (key: string, min: number, max: number) => { const value = Number(body[key]); if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${key} is outside its safe limit`); return value; };
      await prisma.feeRegisterOcrProfile.update({ where: { id }, data: {
        maximumFileBytes: integer("maximumFileBytes", 100_000, 25_000_000),
        maximumImagePixels: integer("maximumImagePixels", 10_000, 60_000_000),
        maximumPagesPerBatch: integer("maximumPagesPerBatch", 1, 50),
        maximumRowsPerPage: integer("maximumRowsPerPage", 1, 500),
        requestTimeoutMs: integer("requestTimeoutMs", 1_000, 30_000),
        minimumSuggestionConfidence: integer("minimumSuggestionConfidence", 40, 100),
        retentionDays: body.retentionDays == null || body.retentionDays === "" ? null : integer("retentionDays", 1, 3650),
        liveUseEnabled: false, paymentPostingEnabled: false
      } });
    } else if (action === "enablePosting") {
      throw new Error("OCR Payment posting cannot be enabled until outstanding-balance and exact fee-allocation enforcement are proven in the existing Payment helper");
    } else throw new Error("Unsupported OCR profile action");
    return NextResponse.json({ profile: await prisma.feeRegisterOcrProfile.findUnique({ where: { id } }) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR profile update failed safely") }, { status: 400 }); }
}
