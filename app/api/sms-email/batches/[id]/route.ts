import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_SMS_EMAIL_DELIVERIES"); if (auth.response) return auth.response;
  const batch = await prisma.smsEmailOutboundBatch.findUnique({ where: { id: (await params).id }, include: { integrationProfile: true, templateMapping: true, notificationCampaign: true, deliveries: { include: { attempts: true } } } });
  return batch ? NextResponse.json({ batch }) : NextResponse.json({ error: "Batch not found." }, { status: 404 });
}

