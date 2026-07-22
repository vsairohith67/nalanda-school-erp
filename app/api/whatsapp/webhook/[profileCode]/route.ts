import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { processWhatsAppWebhook, verifyWhatsAppWebhookChallenge, WhatsAppWebhookSignatureError } from "@/lib/whatsapp-webhooks";
import { operationalEventKey, recordWhatsAppOperationalEvent } from "@/lib/whatsapp-operational-events";

export async function GET(request: NextRequest, { params }: { params: Promise<{ profileCode: string }> }) {
  const profile = await prisma.whatsAppIntegrationProfile.findUnique({ where: { profileCode: (await params).profileCode } });
  if (!profile) return new NextResponse("Not found", { status: 404 });
  try { return new NextResponse(verifyWhatsAppWebhookChallenge(request.nextUrl.searchParams, profile.mode)); }
  catch { return new NextResponse("Verification failed", { status: 403 }); }
}
export async function POST(request: NextRequest, { params }: { params: Promise<{ profileCode: string }> }) {
  const profile = await prisma.whatsAppIntegrationProfile.findUnique({ where: { profileCode: (await params).profileCode } });
  if (!profile) return new NextResponse("Not found", { status: 404 });
  const rawBody = await request.text();
  try {
    const result = await processWhatsAppWebhook(prisma, profile.id, rawBody, request.headers.get("x-hub-signature-256"));
    return NextResponse.json(result);
  } catch (error) {
    if (!(error instanceof WhatsAppWebhookSignatureError)) {
      const bucket = new Date().toISOString().slice(0, 13);
      await recordWhatsAppOperationalEvent(prisma, {
        integrationProfileId: profile.id,
        eventKey: operationalEventKey(["WEBHOOK_PROCESSING_FAILED", profile.id, bucket]),
        eventType: "WEBHOOK_PROCESSING_FAILED",
        safeReason: "Signed webhook processing failed."
      });
    }
    return NextResponse.json({ error: error instanceof WhatsAppWebhookSignatureError ? error.message : "Webhook rejected." }, {
      status: error instanceof WhatsAppWebhookSignatureError ? 401 : 400
    });
  }
}
