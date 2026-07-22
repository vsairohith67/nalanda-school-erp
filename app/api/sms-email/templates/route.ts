import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createSmsEmailTemplate } from "@/lib/sms-email-templates";

export async function GET() {
  const auth = await requireApiPermission("VIEW_SMS_EMAIL_CENTRE"); if (auth.response) return auth.response;
  return NextResponse.json({ mappings: await prisma.smsEmailTemplateMapping.findMany({ orderBy: { createdAt: "desc" } }) });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("MANAGE_SMS_EMAIL_TEMPLATES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ mapping: await createSmsEmailTemplate(prisma, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Template request failed.") }, { status: 400 }); }
}

