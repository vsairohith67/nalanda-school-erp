import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feeRegisterOcrReportData } from "@/lib/fee-register-ocr-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_FEE_REGISTER_OCR_REPORTS"); if (auth.response) return auth.response;
  return NextResponse.json(await feeRegisterOcrReportData(prisma));
}
