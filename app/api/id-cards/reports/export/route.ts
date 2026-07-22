import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { identityCardCsv, identityCardReport } from "@/lib/id-card-reports";
import { schoolDateKey } from "@/lib/format";

export async function GET() {
  const auth = await requireApiPermission("EXPORT_ID_CARD_REPORTS"); if (auth.response) return auth.response;
  const report = await identityCardReport(prisma);
  return new NextResponse(identityCardCsv(report.cards), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=identity-card-report-${schoolDateKey()}.csv` } });
}
