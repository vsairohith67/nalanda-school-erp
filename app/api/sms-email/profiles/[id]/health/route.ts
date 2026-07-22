import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { runSmsEmailProfileHealth } from "@/lib/sms-email-profiles";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_INTEGRATIONS"); if (auth.response) return auth.response;
  try { const body = await request.json().catch(() => ({})); return NextResponse.json({ health: await runSmsEmailProfileHealth(prisma, (await params).id, body.network === true) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Health check failed.") }, { status: 400 }); }
}

