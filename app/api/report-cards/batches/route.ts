import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReportCardBatch } from "@/lib/report-cards";
import { reportCardApiError } from "@/lib/report-card-api";
import { reportCardScopeWhere, resolveReportCardScope } from "@/lib/report-card-scope";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_REPORT_CARDS"); if (auth.response) return auth.response;
  const year = request.nextUrl.searchParams.get("academicYear") ?? undefined;
  const scope = await resolveReportCardScope(prisma, auth.user, year);
  const batches = await prisma.reportCardBatch.findMany({
    where: { ...(year ? { academicYear: year } : {}), ...(!scope.broad ? { reportCards: { some: reportCardScopeWhere(scope) } } : {}) },
    select: { id:true,batchNumber:true,academicYear:true,reportType:true,className:true,section:true,title:true,reportingPeriod:true,status:true,createdAt:true,updatedAt:true,_count:{select:{reportCards:true}} },
    orderBy: { createdAt: "desc" }
  });
  return NextResponse.json({ batches, scopeReason: scope.reason });
}
export async function POST(request: NextRequest) { const auth = await requireApiPermission("MANAGE_REPORT_CARD_BATCHES"); if (auth.response) return auth.response; try { return NextResponse.json({ batch: await createReportCardBatch(prisma, await request.json(), { id: auth.user.id, name: auth.user.name }) }, { status: 201 }); } catch (error) { return reportCardApiError(error); } }
