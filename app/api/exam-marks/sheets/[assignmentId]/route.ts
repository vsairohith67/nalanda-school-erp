import { governedImportContext, governedImportTemplate, governedImportWorkbook, validateGovernedImport, applyGovernedImport } from "@/lib/governed-marks-import";
import { readImportJson } from "@/lib/import-request";
import { issueImportReceipt, importDigest } from "@/lib/import-preview-receipt";
import { REAL_DATA_IMPORTS_FEATURE, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { examMarksApiError, examPrivateJson } from "@/lib/exam-marks-api";
import { saveAssignedMarkDraft } from "@/lib/exam-marks";
import { prisma } from "@/lib/prisma";

export async function PUT(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiPermission("ENTER_ASSIGNED_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    return examPrivateJson(await saveAssignedMarkDraft(prisma, assignmentId, await request.json(), auth.user));
  } catch (error) {
    return examMarksApiError(error);
  }
}

export async function GET(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiPermission("ENTER_ASSIGNED_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    const scope = await governedImportContext(prisma, auth.user, assignmentId);
    if (request.nextUrl.searchParams.get("format") === "xlsx") return new NextResponse(governedImportWorkbook(auth.user, scope), { headers: { "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "content-disposition": "attachment; filename=nalanda-governed-draft-v1.xlsx", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    if (request.nextUrl.searchParams.get("format") === "csv") return new NextResponse(governedImportTemplate(auth.user, scope), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=nalanda-governed-draft-v1.csv", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
    return examPrivateJson({ actorContext: importDigest([auth.user.id, auth.user.role, auth.user.roleAssignmentId]), preview: true, import: !requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE), assignment: scope.component.assignment });
  } catch(error) { return examMarksApiError(error); }
}
export async function POST(request: NextRequest, context: { params: Promise<{ assignmentId: string }> }) {
  const auth = await requireApiPermission("ENTER_ASSIGNED_EXAM_MARKS");
  if (auth.response || !auth.user) return auth.response;
  try {
    const { assignmentId } = await context.params;
    const body = await readImportJson(request, ["action", "model", "csv", "receipt"], 450000);
    if (body.model !== "GOVERNED_DRAFT") throw new Error("Select the governed draft model.");
    if (body.action === "preview") {
      const checked = await validateGovernedImport(prisma, auth.user, assignmentId, body.csv);
      return examPrivateJson({ preview: { rows: checked.rows, totalRows: checked.rows.length, validRows: checked.rows.length, errorRows: 0, errors: [] }, receipt: issueImportReceipt(checked.binding), import: !requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE) });
    }
    const denied = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE); if (denied) return denied;
    if (body.action !== "confirm") throw new Error("Choose preview or confirm.");
    return examPrivateJson({ result: await applyGovernedImport(prisma, auth.user, assignmentId, body.csv, body.receipt) });
  } catch(error) { return examMarksApiError(error); }
}
