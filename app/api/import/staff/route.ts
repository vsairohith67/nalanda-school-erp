import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { applyStaffImport, buildStaffImportPreview } from "@/lib/staff";
import { createImportBatchRecord, deriveImportBatchStatus } from "@/lib/import-verification";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("IMPORT_STAFF"); if (auth.response) return auth.response;
  try {
    const body = await request.json(); const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) throw new Error("No staff rows supplied");
    const preview = await buildStaffImportPreview(prisma, rows);
    if (body.action === "preview") return NextResponse.json({ preview });
    const featureUnavailable = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE);
    if (featureUnavailable) return featureUnavailable;
    if (body.action !== "import") throw new Error("Unknown staff import action");
    if (body.confirmed !== true) throw new Error("Staff import must be confirmed after review");
    const result = await prisma.$transaction(async (tx) => {
      const checked = await buildStaffImportPreview(tx, rows); const applied = await applyStaffImport(tx, checked);
      const batch = await createImportBatchRecord(tx, { type: "STAFF", fileName: String(body.fileName ?? "Staff import"), importedBy: auth.user, mode: "import", totalRows: checked.counts.total, createdCount: applied.created, updatedCount: applied.updated, skippedCount: applied.skipped, errorCount: applied.errors.length, warningCount: checked.counts.warnings, status: deriveImportBatchStatus({ createdCount: applied.created, updatedCount: applied.updated, skippedCount: applied.skipped, errorCount: applied.errors.length }), notes: null, details: { samples: checked.rows.slice(0, 10).map((row) => ({ rowNumber: row.rowNumber, staffCode: row.normalized.staffCode, fullName: row.normalized.fullName, action: row.action })), errors: applied.errors.map((reason) => ({ reason })), warnings: checked.rows.flatMap((r) => r.warnings.map((w) => `CSV Row ${r.rowNumber}: ${w}`)) } });
      return { ...applied, batchId: batch.id };
    });
    return NextResponse.json({ result });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to import staff") }, { status: 400 }); }
}
