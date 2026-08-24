import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { localSubstituteDateText, substituteDate, substituteReportCsv, substituteReportData } from "@/lib/substitutes";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_SUBSTITUTE_REPORTS");
  if (auth.response) return auth.response;
  try {
    const sp = request.nextUrl.searchParams;
    const today = localSubstituteDateText();
    const fromText = sp.get("from") ?? `${today.slice(0, 8)}01`;
    const toText = sp.get("to") ?? today;
    const report = await substituteReportData(prisma, { from: substituteDate(fromText, "From date"), to: substituteDate(toText, "To date") });
    return new NextResponse(substituteReportCsv(report.assignments), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename=substitute-coverage-${fromText}-to-${toText}.csv`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Unable to export substitute reports") }, { status: 400 });
  }
}
