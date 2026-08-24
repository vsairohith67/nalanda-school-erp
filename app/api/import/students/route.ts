import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireApiPermission } from "@/lib/auth";
import {
  buildStudentImportUpdateData,
  decideStudentImportAction,
  normalizeStudentImportRows,
  type StudentImportMode
} from "@/lib/student-import";
import {
  createImportBatchRecord,
  deriveImportBatchStatus,
  studentSampleRows,
  summarizeStudentTrial
} from "@/lib/import-verification";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";

export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("IMPORT_STUDENTS");
  if (auth.response) return auth.response;
  try {
    const body = await request.json();
    const rows = Array.isArray(body.rows) ? body.rows : [];
    if (!rows.length) throw new Error("No student rows supplied");
    const existingRows = await prisma.student.findMany({ select: { admissionNo: true } });
    const existingAdmissions = new Set(existingRows.map((row) => row.admissionNo.toLowerCase()));
    const existingAdmissionMap = new Map(
      existingRows.map((row) => [row.admissionNo.toLowerCase(), row.admissionNo])
    );
    const preview = normalizeStudentImportRows(rows, existingAdmissions);

    if (body.action === "preview") return NextResponse.json({ preview });
    const featureUnavailable = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE);
    if (featureUnavailable) return featureUnavailable;
    const mode: StudentImportMode =
      body.mode === "update" ? "update" :
      body.mode === "create-only" ? "create-only" :
      "skip";
    const fileName = String(body.fileName ?? "Student import").trim() || "Student import";
    const notes = String(body.notes ?? "").trim() || null;
    const trialSummary = summarizeStudentTrial(preview, existingAdmissions, mode);
    const previewErrors = preview.rows
      .filter((row) => row.errors.length)
      .map((row) => errorRow(row, row.errors.join("; ")));
    const previewWarnings = [
      ...preview.fileWarnings,
      ...preview.rows.flatMap((row) => row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`))
    ];

    if (body.action === "dry-run") {
      const batch = await createImportBatchRecord(prisma, {
        type: "STUDENTS",
        fileName,
        importedBy: auth.user,
        mode,
        ...trialSummary,
        status: "DRY_RUN",
        notes,
        details: {
          samples: studentSampleRows(preview),
          warnings: previewWarnings,
          errors: previewErrors.slice(0, 1000)
        }
      });
      return NextResponse.json({ preview, batchId: batch.id, summary: trialSummary });
    }
    if (body.action !== "import") throw new Error("Unknown student import action");
    if (body.confirmed !== true) throw new Error("Student import must be confirmed");
    const result = {
      created: 0,
      updated: 0,
      skipped: 0,
      skippedExisting: 0,
      errors: [] as Array<{
        rowNumber: number;
        admissionNo: string;
        studentName: string;
        className: string;
        reason: string;
        originalValuesJson: string;
      }>,
      warnings: [...preview.fileWarnings],
      batchId: ""
    };

    await prisma.$transaction(async (tx) => {
      for (const row of preview.rows) {
        if (row.errors.length) {
          result.errors.push(errorRow(row, row.errors.join("; ")));
          continue;
        }
        try {
          const existingAdmissionNo = existingAdmissionMap.get(row.normalized.admissionNo.toLowerCase());
          const existing = existingAdmissionNo
            ? await tx.student.findUnique({ where: { admissionNo: existingAdmissionNo } })
            : null;
          const action = decideStudentImportAction(Boolean(existing), mode);
          if (action === "skip") {
            result.skipped += 1;
            result.skippedExisting += 1;
            result.warnings.push(`CSV Row ${row.rowNumber}: existing admission ${row.normalized.admissionNo} skipped because it already exists in this database.`);
            continue;
          }
          if (action === "update") {
            await tx.student.update({
              where: { admissionNo: existing!.admissionNo },
              data: toPrismaData(buildStudentImportUpdateData(row))
            });
            result.updated += 1;
          } else {
            await tx.student.create({ data: toPrismaData(row.normalized) });
            existingAdmissionMap.set(row.normalized.admissionNo.toLowerCase(), row.normalized.admissionNo);
            result.created += 1;
          }
          result.warnings.push(...row.warnings.map((warning) => `CSV Row ${row.rowNumber}: ${warning}`));
        } catch (error) {
          result.errors.push(errorRow(
            row,
            safeClientError(error, "Unable to import student")
          ));
        }
      }
      const status = deriveImportBatchStatus({
        createdCount: result.created,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        errorCount: result.errors.length
      });
      const batch = await createImportBatchRecord(tx, {
        type: "STUDENTS",
        fileName,
        importedBy: auth.user,
        mode,
        totalRows: preview.counts.total,
        createdCount: result.created,
        updatedCount: result.updated,
        skippedCount: result.skipped,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
        status,
        notes,
        details: {
          samples: studentSampleRows(preview),
          warnings: result.warnings,
          errors: result.errors.slice(0, 1000)
        }
      });
      result.batchId = batch.id;
    }, { maxWait: 5_000, timeout: 60_000 });
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json(
      { error: safeClientError(error, "Unable to import students") },
      { status: 400 }
    );
  }
}

function toPrismaData<T extends Record<string, unknown>>(data: T) {
  if (!("dateOfBirth" in data)) return data;
  return {
    ...data,
    dateOfBirth: data.dateOfBirth ? new Date(`${data.dateOfBirth}T00:00:00.000Z`) : null
  };
}

function errorRow(
  row: ReturnType<typeof normalizeStudentImportRows>["rows"][number],
  reason: string
) {
  return {
    rowNumber: row.rowNumber,
    admissionNo: row.normalized.admissionNo,
    studentName: row.normalized.studentName,
    className: row.normalized.className,
    reason,
    originalValuesJson: JSON.stringify(row.originalValues)
  };
}
