import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSmsEmailBatch } from "@/lib/sms-email-batches";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_SMS_EMAIL_CENTRE"); if (auth.response) return auth.response;
  const status = request.nextUrl.searchParams.get("status"), channel = request.nextUrl.searchParams.get("channel");
  return NextResponse.json({ batches: await prisma.smsEmailOutboundBatch.findMany({ where: { ...(status ? { status } : {}), ...(channel ? { channel } : {}) }, include: { integrationProfile: true, templateMapping: true, notificationCampaign: true }, orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_SMS_EMAIL_BATCHES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ batch: await createSmsEmailBatch(prisma, await request.json(), auth.user) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Batch creation failed.") }, { status: 400 }); }
}

