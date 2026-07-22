import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractOcrPage } from "@/lib/fee-register-ocr";

export async function POST(_: NextRequest, { params }: { params: Promise<{ pageId: string }> }) {
  const auth = await requireApiPermission("RUN_FEE_REGISTER_OCR"); if (auth.response) return auth.response;
  try { return NextResponse.json({ page: await extractOcrPage(prisma, (await params).pageId, auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR extraction failed safely") }, { status: 400 }); }
}
