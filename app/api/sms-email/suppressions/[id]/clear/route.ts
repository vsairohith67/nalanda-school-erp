import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { clearSmsEmailSuppression } from "@/lib/sms-email-consents";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_CONSENTS"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json({ suppression: await clearSmsEmailSuppression(prisma, (await params).id, auth.user, body.reason) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Suppression review failed.") }, { status: 400 }); }
}

