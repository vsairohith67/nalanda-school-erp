import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processSmsEmailQueue } from "@/lib/sms-email-worker";
import { isCommunicationChannel } from "@/lib/communication-types";
import { requireCommunicationFeatureForApi } from "@/lib/communication-policy";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("PROCESS_SMS_EMAIL_QUEUE"); if (auth.response) return auth.response;
  try { const body = await request.json().catch(() => ({})); const channel = String(body.channel ?? "").toUpperCase(); if (!isCommunicationChannel(channel) || !["SMS", "EMAIL"].includes(channel)) return NextResponse.json({ error: "SMS or EMAIL channel is required." }, { status: 400 }); const feature = requireCommunicationFeatureForApi(channel); if (feature) return feature; return NextResponse.json(await processSmsEmailQueue(prisma, { limit: Number(body.limit) || 25, channel: channel as "SMS" | "EMAIL" })); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Queue processing failed.") }, { status: 400 }); }
}
