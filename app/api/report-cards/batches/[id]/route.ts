import { NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reportCardApiError } from "@/lib/report-card-api";
import { resolveReportCardScope, requireReportCardTarget, ReportCardError } from "@/lib/report-card-scope";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("VIEW_REPORT_CARDS"); if (auth.response) return auth.response;
  try {
    const batch = await prisma.reportCardBatch.findUnique({ where: { id: (await params).id }, select: {
      id:true,batchNumber:true,academicYear:true,reportType:true,className:true,section:true,title:true,reportingPeriod:true,status:true,createdAt:true,updatedAt:true,
      reportCards:{select:{id:true,reportCardNumber:true,academicYear:true,className:true,section:true,reportType:true,status:true,currentVersionNumber:true,updatedAt:true,student:{select:{studentName:true,admissionNo:true}},_count:{select:{versions:true}}},orderBy:{student:{studentName:"asc"}}},
      template:{select:{templateCode:true,name:true}},examSources:{select:{displayOrder:true,examCycle:{select:{examCode:true,name:true,status:true}}}}
    } });
    if (!batch) throw new ReportCardError("Batch was not found.", 404);
    const scope = await resolveReportCardScope(prisma, auth.user, batch.academicYear); requireReportCardTarget(scope, batch);
    return NextResponse.json({ batch, scopeReason: scope.reason });
  } catch (error) { return reportCardApiError(error); }
}
