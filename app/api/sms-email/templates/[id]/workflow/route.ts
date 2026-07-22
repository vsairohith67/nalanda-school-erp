import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { setSmsEmailTemplateStatus } from "@/lib/sms-email-templates";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_TEMPLATES"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json({ mapping: await setSmsEmailTemplateStatus(prisma, (await params).id, String(body.action), auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Template action failed.") }, { status: 400 }); }
}

