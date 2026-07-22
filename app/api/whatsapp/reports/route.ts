import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWhatsAppReports } from "@/lib/whatsapp-reports";

export async function GET() {
  const auth = await requireApiPermission("VIEW_WHATSAPP_REPORTS");
  if (auth.response) return auth.response;
  return NextResponse.json({ report: await loadWhatsAppReports(prisma) });
}
