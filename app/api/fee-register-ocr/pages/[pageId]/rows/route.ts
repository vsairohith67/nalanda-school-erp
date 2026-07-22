import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addManualOcrRow } from "@/lib/fee-register-ocr";

export async function POST(request: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const auth = await requireApiPermission("REVIEW_FEE_REGISTER_OCR_ROWS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ row: await addManualOcrRow(prisma, (await params).pageId, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Manual transcription failed safely") }, { status: 400 }); }
}
