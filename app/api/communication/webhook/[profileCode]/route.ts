import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createCommunicationAdapter } from "@/lib/communication-adapters";
import { processCommunicationWebhook, CommunicationWebhookError } from "@/lib/communication-webhooks";
import { requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { isCommunicationChannel } from "@/lib/communication-types";

export async function POST(request: NextRequest, context: { params: Promise<{ profileCode: string }> }) {
  const { profileCode } = await context.params;
  if (!/^[A-Z0-9][A-Z0-9_-]{2,39}$/i.test(profileCode)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const profile = await prisma.communicationProviderProfile.findUnique({ where: { profileCode: profileCode.toUpperCase() } });
  if (!profile || profile.adapterKind !== "LOCAL_SYNTHETIC_SINK" || !isCommunicationChannel(profile.channel) || profile.channel === "IN_APP") return NextResponse.json({ error: "Not found." }, { status: 404 });
  const feature = requireCommunicationFeatureForApi(profile.channel); if (feature) return feature;
  try {
    const result = await processCommunicationWebhook(prisma, { profileCode: profile.profileCode, channel: profile.channel, rawBody: await request.text(), contentType: request.headers.get("content-type"), timestamp: request.headers.get("x-nalanda-timestamp"), signature: request.headers.get("x-nalanda-signature"), secret: process.env.COMMUNICATION_SYNTHETIC_WEBHOOK_SECRET ?? "", adapter: createCommunicationAdapter(profile.adapterKind) });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof CommunicationWebhookError ? error.status : 400;
    return NextResponse.json({ error: "Webhook rejected.", code: error instanceof CommunicationWebhookError ? error.code : "WEBHOOK_REJECTED" }, { status });
  }
}
