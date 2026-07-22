import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewSmsEmailBatch } from "@/lib/sms-email-batches";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CREATE_SMS_EMAIL_BATCHES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ preview: await previewSmsEmailBatch(prisma, (await params).id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Preview failed.") }, { status: 400 }); }
}

