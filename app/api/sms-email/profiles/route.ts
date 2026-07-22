import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSmsEmailProfile, ensureSmsEmailMockProfiles } from "@/lib/sms-email-profiles";

export async function GET() {
  const auth = await requireApiPermission("VIEW_SMS_EMAIL_CENTRE"); if (auth.response) return auth.response;
  await ensureSmsEmailMockProfiles(prisma);
  return NextResponse.json({ profiles: await prisma.smsEmailIntegrationProfile.findMany({ orderBy: [{ channel: "asc" }, { createdAt: "desc" }] }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_INTEGRATIONS"); if (auth.response) return auth.response;
  try { return NextResponse.json({ profile: await createSmsEmailProfile(prisma, await request.json()) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: message(error) }, { status: 400 }); }
}
function message(error: unknown) { return safeClientError(error, "Profile request failed."); }

