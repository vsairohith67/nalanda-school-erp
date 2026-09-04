import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processCommunicationOutbox } from "@/lib/communication-service";
import { communicationRoleCapabilities, requireCommunicationFeatureForApi } from "@/lib/communication-policy";
import { isCommunicationChannel } from "@/lib/communication-types";
import { safeClientError } from "@/lib/client-errors";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("PROCESS_SMS_EMAIL_QUEUE"); if (auth.response) return auth.response;
  if (!communicationRoleCapabilities(auth.user!.role).viewOperations) return NextResponse.json({ error: "You do not have permission to process communication delivery." }, { status: 403 });
  try {
    const body = await request.json(), channel = String(body.channel ?? "").toUpperCase();
    if (!isCommunicationChannel(channel) || channel === "IN_APP") return NextResponse.json({ error: "An external channel is required." }, { status: 400 });
    const feature = requireCommunicationFeatureForApi(channel); if (feature) return feature;
    const pepper = process.env.COMMUNICATION_DESTINATION_HASH_PEPPER ?? "";
    return NextResponse.json(await processCommunicationOutbox(prisma, { channel, workerId: `api-${auth.user!.id}`, limit: Number(body.limit ?? 25), pepper }));
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Communication queue processing failed.") }, { status: 400 }); }
}
