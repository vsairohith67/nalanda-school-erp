import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processSmsEmailWebhook, SmsEmailWebhookSignatureError } from "@/lib/sms-email-webhooks";

export async function POST(request: NextRequest, { params }: { params: Promise<{ profileCode: string }> }) {
  try { return NextResponse.json(await processSmsEmailWebhook(prisma, (await params).profileCode, await request.text(), request.headers.get("x-nalanda-signature"))); }
  catch (error) {
    const status = error instanceof SmsEmailWebhookSignatureError ? 401 : 400;
    return NextResponse.json({ error: safeClientError(error, "Webhook processing failed.") }, { status });
  }
}

