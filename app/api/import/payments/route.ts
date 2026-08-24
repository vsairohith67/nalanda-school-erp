import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import {
  createImportedPaymentWithAudit,
  normalizePaymentImportRows,
  assertPaymentImportRowLimit,
  PaymentImportDuplicateError,
  type PaymentImportPreviewRow
} from "@/lib/payment-import";
import { prisma } from "@/lib/prisma";
import {
  calculatePaymentReconciliation,
  compareExpectedPaymentTotals,
  createImportBatchRecord,
  deriveImportBatchStatus,
  paymentSampleRows,
  recordPaymentDryRun,
  type ExpectedPaymentTotals
} from "@/lib/import-verification";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_PAYMENTS");
  if (auth.response) return auth.response;

  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) throw new Error("No payment rows supplied");
    assertPaymentImportRowLimit(rows);

    const [students, existingPayments] = await Promise.all([
      prisma.student.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          admissionNo: true,
          studentName: true,
          className: true,
          section: true,
          deletedAt: true
        }
      }),
      prisma.payment.findMany({
        select: {
          date: true,
          receiptNo: true,
          admissionNo: true,
          amountPaid: true,
          paymentMode: true,
          receivedAccount: true
        }
      })
    ]);
    const preview = normalizePaymentImportRows(rows, students, existingPayments, auth.user.name);
    const reconciliation = calculatePaymentReconciliation(preview);

    if (body.action === "preview") return NextResponse.json({ preview, reconciliation });
    const featureUnavailable = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE);
    if (featureUnavailable) return featureUnavailable;
    const fileName = String(body.fileName ?? "Payment import").trim() || "Payment import";
    const notes = String(body.notes ?? "").trim() || null;
    const expectedTotals = normalizeExpectedTotals(body.expectedTotals);
    const expectedComparison = compareExpectedPaymentTotals(reconciliation, expectedTotals);
    if (body.action === "dry-run") {
      const dryRun = await recordPaymentDryRun(prisma, {
        preview,
        fileName,
        importedBy: auth.user,
        notes,
        expectedTotals
      });
      return NextResponse.json({
        preview,
        reconciliation: dryRun.reconciliation,
        expectedComparison: dryRun.expectedComparison,
        batchId: dryRun.batch.id
      });
    }
    if (body.action !== "import") throw new Error("Unknown payment import action");
    if (body.confirmed !== true) throw new Error("Payment import must be confirmed");

    const result = {
      created: 0,
      skippedDuplicates: 0,
      errors: [] as PaymentImportErrorRow[],
      warnings: [
        ...preview.fileWarnings,
        ...preview.rows.flatMap((row) =>
          row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
        )
      ],
      batchId: "",
      reconciliation
    };
    const createdRows: PaymentImportPreviewRow[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of preview.rows) {
        if (row.errors.length) {
          result.errors.push(errorRow(row, row.errors.join("; ")));
          continue;
        }
        if (row.duplicate) {
          result.skippedDuplicates += 1;
          continue;
        }
        try {
          await createImportedPaymentWithAudit(tx, row, auth.user);
          result.created += 1;
          createdRows.push(row);
        } catch (error) {
          if (error instanceof PaymentImportDuplicateError) {
            result.skippedDuplicates += 1;
            result.warnings.push(`CSV Row ${row.rowNumber}: ${error.message}; row was skipped.`);
            continue;
          }
          result.errors.push(errorRow(
            row,
            safeClientError(error, "Unable to import payment")
          ));
        }
      }
      result.reconciliation = calculatePaymentReconciliation(preview, createdRows);
      const status = deriveImportBatchStatus({
        createdCount: result.created,
        updatedCount: 0,
        skippedCount: result.skippedDuplicates,
        errorCount: result.errors.length
      });
      const batch = await createImportBatchRecord(tx, {
        type: "PAYMENTS",
        fileName,
        importedBy: auth.user,
        mode: "import-valid",
        totalRows: preview.counts.total,
        createdCount: result.created,
        updatedCount: 0,
        skippedCount: result.skippedDuplicates,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        status,
        notes,
        details: {
          samples: paymentSampleRows(preview),
          warnings: result.warnings,
          errors: result.errors.slice(0, 1000),
          reconciliation: result.reconciliation,
          expectedTotals,
          expectedComparison
        }
      });
      result.batchId = batch.id;
    }, { maxWait: 5_000, timeout: 60_000 });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to import payments") },
      { status: 400 }
    );
  }
}

function normalizeExpectedTotals(value: unknown): ExpectedPaymentTotals {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, amount]) => amount !== "" && amount !== null && amount !== undefined)
      .map(([label, amount]) => [label, Number(amount)])
      .filter(([, amount]) => Number.isFinite(amount as number))
  ) as ExpectedPaymentTotals;
}

type PaymentImportErrorRow = {
  rowNumber: number;
  receiptNo: string;
  admissionNo: string;
  studentName: string;
  className: string;
  amountPaid: number;
  reason: string;
  originalValuesJson: string;
};

function errorRow(row: PaymentImportPreviewRow, reason: string): PaymentImportErrorRow {
  return {
    rowNumber: row.rowNumber,
    receiptNo: row.normalized.receiptNo,
    admissionNo: row.normalized.admissionNo,
    studentName: row.normalized.studentName,
    className: row.normalized.className,
    amountPaid: row.normalized.amountPaid,
    reason,
    originalValuesJson: JSON.stringify(row.originalValues)
  };
}
