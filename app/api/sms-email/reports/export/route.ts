import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadSmsEmailReports, smsEmailReportsCsv, smsEmailReportsFilename } from "@/lib/sms-email-reports";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_SMS_EMAIL_REPORTS"); if (auth.response) return auth.response;
  const report = await loadSmsEmailReports(prisma);
  return new NextResponse(smsEmailReportsCsv(report), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${smsEmailReportsFilename()}"` } });
}

