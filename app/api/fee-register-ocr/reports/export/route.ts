import { NextRequest } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { safeClientError } from "@/lib/client-errors";
import {
  feeRegisterOcrAggregateCsv,
  feeRegisterOcrReportData,
  feeRegisterOcrReportFilename,
  reviewedOcrStagingCsv,
  reviewedOcrStagingFilename
} from "@/lib/fee-register-ocr-reports";
import { auditedFinanceCsvResponse } from "@/lib/finance-export-audit";
import {
  FINANCE_EXPORT_ROW_LIMIT,
  parseFinanceDateRange,
  privateFinanceJson
} from "@/lib/finance-privacy";
import { prisma } from "@/lib/prisma";

const AGGREGATE_FIELDS = [
  "Batch Number", "Academic Year", "Register", "Status", "Provider", "Pages",
  "Rows", "Verified Amount", "Posted Amount", "Posting Enabled"
];
const REVIEW_FIELDS = [
  "Notice", "Batch Number", "Page", "Row", "Admission Number", "Payment Date",
  "Amount", "Payment Mode", "Received Account", "Academic Term",
  "Handwritten Reference", "Duplicate Status", "Review Status"
];

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("EXPORT_FEE_REGISTER_OCR_REPORTS");
  if (auth.response) return auth.response;
  try {
    const batchId = request.nextUrl.searchParams.get("batchId");
    if (batchId) {
      const [batch, rowCount] = await Promise.all([
        prisma.feeRegisterOcrBatch.findUnique({
          where: { id: batchId },
          select: { batchNumber: true }
        }),
        prisma.feeRegisterOcrRow.count({ where: { page: { batchId } } })
      ]);
      if (!batch) {
        return privateFinanceJson({ error: "OCR batch not found" }, { status: 404 });
      }
      if (rowCount > FINANCE_EXPORT_ROW_LIMIT) {
        return privateFinanceJson(
          { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} rows. Export a smaller reviewed batch.` },
          { status: 409 }
        );
      }
      const filename = reviewedOcrStagingFilename(batch.batchNumber);
      return auditedFinanceCsvResponse(prisma, {
        actor: auth.user,
        role: auth.user.role,
        exportType: "fee-register-ocr-reviewed-batch",
        purpose: "Reviewed OCR staging-row verification before any posting",
        rowCount,
        fields: REVIEW_FIELDS,
        scope: batch.batchNumber,
        filename,
        csv: await reviewedOcrStagingCsv(prisma, batchId)
      });
    }

    const range = parseFinanceDateRange(
      request.nextUrl.searchParams.get("from"),
      request.nextUrl.searchParams.get("to")
    );
    const report = await feeRegisterOcrReportData(prisma);
    const batches = report.batches.filter((batch: { createdAt: Date }) =>
      batch.createdAt >= range.where.gte && batch.createdAt < range.where.lt
    );
    if (batches.length > FINANCE_EXPORT_ROW_LIMIT) {
      return privateFinanceJson(
        { error: `Export exceeds ${FINANCE_EXPORT_ROW_LIMIT} batches. Narrow the date range.` },
        { status: 409 }
      );
    }
    const filename = feeRegisterOcrReportFilename();
    return auditedFinanceCsvResponse(prisma, {
      actor: auth.user,
      role: auth.user.role,
      exportType: "fee-register-ocr-aggregate",
      purpose: "OCR batch and posting-state reconciliation",
      rowCount: batches.length,
      fields: AGGREGATE_FIELDS,
      scope: `${range.from}-to-${range.to}`,
      filename,
      from: range.from,
      to: range.to,
      csv: feeRegisterOcrAggregateCsv({ ...report, batches })
    });
  } catch (error) {
    return privateFinanceJson(
      { error: safeClientError(error, "OCR export failed safely") },
      { status: 400 }
    );
  }
}
