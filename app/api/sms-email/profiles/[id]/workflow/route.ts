import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { activateSmsEmailProfile, pauseSmsEmailProfile } from "@/lib/sms-email-profiles";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_INTEGRATIONS"); if (auth.response) return auth.response;
  try {
    const body = await request.json(), id = (await params).id;
    const profile = body.action === "activate" ? await activateSmsEmailProfile(prisma, id, auth.user, body.confirmation)
      : body.action === "pause" ? await pauseSmsEmailProfile(prisma, id, auth.user) : (() => { throw new Error("Unsupported profile action."); })();
    return NextResponse.json({ profile });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Profile action failed.") }, { status: 400 }); }
}

