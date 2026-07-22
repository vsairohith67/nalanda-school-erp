import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewOcrPosting, processOcrPosting } from "@/lib/fee-register-ocr";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const body = await request.json().catch(() => ({})), action = String(body.action ?? "preview");
  const permission = action === "process" ? "POST_FEE_REGISTER_OCR_PAYMENTS" : "PREVIEW_FEE_REGISTER_OCR_POSTING";
  const auth = await requireApiPermission(permission); if (auth.response) return auth.response;
  try {
    if (action === "preview") return NextResponse.json(await previewOcrPosting(prisma, (await params).id, Array.isArray(body.selectedRowIds) ? body.selectedRowIds.map(String) : [], auth.user.id));
    if (action === "process") return NextResponse.json(await processOcrPosting());
    throw new Error("Unsupported OCR posting action");
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR posting failed safely") }, { status: 400 }); }
}
