import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadWhatsAppReports, whatsappReportsCsv, whatsappReportsFilename } from "@/lib/whatsapp-reports";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_WHATSAPP_REPORTS");
  if (auth.response) return auth.response;
  const report = await loadWhatsAppReports(prisma);
  return new NextResponse(whatsappReportsCsv(report), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${whatsappReportsFilename()}"`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff"
  } });
}
