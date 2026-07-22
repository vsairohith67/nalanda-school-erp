import { safeClientError } from "@/lib/client-errors";
import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { previewWhatsAppBatch } from "@/lib/whatsapp-batches";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("CREATE_WHATSAPP_BATCHES");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ preview: await previewWhatsAppBatch(prisma, (await params).id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Preview failed.") }, { status: 400 }); }
}
