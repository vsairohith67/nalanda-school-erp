import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import { buildGuardianImportPreview, importGuardianLinks } from "@/lib/guardians";
import { createImportBatchRecord, deriveImportBatchStatus, guardianSampleRows } from "@/lib/import-verification";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("IMPORT_GUARDIANS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) throw new Error("No guardian rows supplied");
    const preview = await buildGuardianImportPreview(prisma, rows);
    if (body.action === "preview") return NextResponse.json({ preview });

    const fileName = String(body.fileName ?? "Guardian link import").trim() || "Guardian link import";
    const notes = String(body.notes ?? "").trim() || null;
    const warnings = [
      ...preview.fileWarnings,
      ...preview.rows.flatMap((row) =>
        row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`)
      )
    ];
    const errors = preview.rows
      .filter((row) => row.errors.length)
      .map((row) => ({
        rowNumber: row.rowNumber,
        admissionNo: row.normalized.admissionNo,
        guardianName: row.normalized.guardianName,
        mobile: row.normalized.mobile,
        reason: row.errors.join("; "),
        originalValuesJson: JSON.stringify(row.originalValues)
      }));

    if (body.action === "dry-run") {
      const batch = await createImportBatchRecord(prisma, {
        type: "GUARDIANS",
        fileName,
        importedBy: auth.user,
        mode: "dry-run",
        totalRows: preview.counts.total,
        createdCount: preview.counts.newGuardians,
        updatedCount: preview.counts.matchedGuardians,
        skippedCount: preview.counts.existingLinks,
        errorCount: preview.counts.errors,
        warningCount: preview.counts.warnings,
        status: "DRY_RUN",
        notes,
        details: {
          samples: guardianSampleRows(preview),
          warnings,
          errors: errors.slice(0, 1000)
        }
      });
      return NextResponse.json({
        preview,
        batchId: batch.id,
        summary: {
          totalRows: preview.counts.total,
          createdCount: preview.counts.newGuardians,
          updatedCount: preview.counts.matchedGuardians,
          skippedCount: preview.counts.existingLinks,
          errorCount: preview.counts.errors,
          warningCount: preview.counts.warnings
        }
      });
    }

    if (body.action !== "import") throw new Error("Unknown guardian import action");
    if (body.confirmed !== true) throw new Error("Guardian link import must be confirmed");

    const result = await prisma.$transaction(async (tx) => {
      const nextPreview = await buildGuardianImportPreview(tx, rows);
      const importResult = await importGuardianLinks(tx, nextPreview);
      const batch = await createImportBatchRecord(tx, {
        type: "GUARDIANS",
        fileName,
        importedBy: auth.user,
        mode: "import",
        totalRows: nextPreview.counts.total,
        createdCount: importResult.guardiansCreated + importResult.linksCreated,
        updatedCount: importResult.linksUpdated,
        skippedCount: importResult.linksSkipped,
        errorCount: importResult.errors.length,
        warningCount: importResult.warnings.length,
        status: deriveImportBatchStatus({
          createdCount: importResult.guardiansCreated + importResult.linksCreated,
          updatedCount: importResult.linksUpdated,
          skippedCount: importResult.linksSkipped,
          errorCount: importResult.errors.length
        }),
        notes,
        details: {
          samples: guardianSampleRows(nextPreview),
          warnings: importResult.warnings,
          errors: importResult.errors.slice(0, 1000)
        }
      });
      return { ...importResult, batchId: batch.id };
    }, { maxWait: 5_000, timeout: 60_000 });

    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to import guardian links") },
      { status: 400 }
    );
  }
}
