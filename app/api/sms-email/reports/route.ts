import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSmsEmailReports } from "@/lib/sms-email-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_SMS_EMAIL_REPORTS"); if (auth.response) return auth.response;
  return NextResponse.json(await loadSmsEmailReports(prisma));
}

