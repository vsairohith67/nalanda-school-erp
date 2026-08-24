import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { createImportBatchRecord, deriveImportBatchStatus } from "@/lib/import-verification";
import { applyLibraryCopyImport, applyLibraryTitleImport, buildLibraryCopyImportPreview, buildLibraryTitleImportPreview } from "@/lib/library-import";
import { prisma } from "@/lib/prisma";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest, context: { params: Promise<{ kind: string }> }) {
  const auth = await requireApiPermission("IMPORT_LIBRARY_CATALOG"); if (auth.response) return auth.response;
  try {
    const { kind } = await context.params; if (kind !== "titles" && kind !== "copies") throw new Error("Unsupported library import type");
    const body = await request.json(); const rows = Array.isArray(body.rows) ? body.rows : []; const build = kind === "titles" ? buildLibraryTitleImportPreview : buildLibraryCopyImportPreview;
    const checked = await build(prisma, rows);
    if (body.action === "preview") return NextResponse.json({ preview: checked, message: "Preview ready. No library records were changed." });
    const featureUnavailable = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE);
    if (featureUnavailable) return featureUnavailable;
    if (body.action !== "confirm" || body.confirmed !== true) throw new Error("Review the preview and confirm the library import before applying it");
    const result = await prisma.$transaction(async (tx) => {
      const fresh = await build(tx, rows);
      const applied = kind === "titles" ? await applyLibraryTitleImport(tx, fresh, auth.user.id) : await applyLibraryCopyImport(tx, fresh, auth.user.id);
      const batch = await createImportBatchRecord(tx, { type: kind === "titles" ? "LIBRARY_TITLES" : "LIBRARY_COPIES", fileName: String(body.fileName ?? `library-${kind}.csv`), importedBy: auth.user, mode: "import", totalRows: fresh.counts.total, createdCount: applied.created, updatedCount: 0, skippedCount: applied.skipped, errorCount: applied.errors.length, warningCount: fresh.counts.warnings, status: deriveImportBatchStatus({ createdCount: applied.created, updatedCount: 0, skippedCount: applied.skipped, errorCount: applied.errors.length }), notes: "Prompt 16F preview-confirm library import", details: { samples: fresh.rows.slice(0, 20).map((r) => ({ rowNumber: r.rowNumber, action: r.action, key: r.normalized.titleCode ?? r.normalized.accessionNumber ?? "" })), warnings: fresh.rows.flatMap((r) => r.warnings.map((warning) => `CSV Row ${r.rowNumber}: ${warning}`)), errors: applied.errors.map((reason) => ({ reason })) } });
      return { ...applied, batchId: batch.id };
    });
    return NextResponse.json({ result, message: `Import complete: ${result.created} created, ${result.skipped} skipped, ${result.errors.length} errors.` });
  } catch (error) { return NextResponse.json({ error: safeClientError(error, "Unable to process library import") }, { status: 400 }); }
}
