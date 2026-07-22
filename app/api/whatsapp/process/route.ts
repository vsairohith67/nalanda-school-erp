import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processWhatsAppQueue } from "@/lib/whatsapp-worker";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("PROCESS_WHATSAPP_QUEUE");
  if (auth.response) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ summary: await processWhatsAppQueue(prisma, { limit: Number(body.limit ?? 25) }) });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Queue processing failed.") }, { status: 400 }); }
}
