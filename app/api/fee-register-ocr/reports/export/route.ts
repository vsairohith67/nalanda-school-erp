import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { feeRegisterOcrAggregateCsv, feeRegisterOcrReportData, feeRegisterOcrReportFilename, reviewedOcrStagingCsv, reviewedOcrStagingFilename } from "@/lib/fee-register-ocr-reports";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_FEE_REGISTER_OCR_REPORTS"); if (auth.response) return auth.response;
  try {
    const batchId = request.nextUrl.searchParams.get("batchId");
    let csv: string, filename: string;
    if (batchId) {
      const batch = await prisma.feeRegisterOcrBatch.findUnique({ where: { id: batchId }, select: { batchNumber: true } });
      if (!batch) return NextResponse.json({ error: "OCR batch not found" }, { status: 404 });
      csv = await reviewedOcrStagingCsv(prisma, batchId); filename = reviewedOcrStagingFilename(batch.batchNumber);
    } else {
      csv = feeRegisterOcrAggregateCsv(await feeRegisterOcrReportData(prisma)); filename = feeRegisterOcrReportFilename();
    }
    return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "OCR export failed safely") }, { status: 400 }); }
}
