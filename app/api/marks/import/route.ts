import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyMarksImport, previewMarksImport } from "@/lib/marks-import";
import { legacyImportChoices, legacyImportContext, assertLegacyCsvContext } from "@/lib/legacy-marks-import-context";
import { readImportJson } from "@/lib/import-request";
import { issueImportReceipt, requireImportReceipt, importDigest } from "@/lib/import-preview-receipt";
import { marksError } from "@/lib/marks-api";
import { REAL_DATA_IMPORTS_FEATURE, isOperationalReleaseFeatureEnabled, requireOperationalReleaseFeatureForApi } from "@/lib/release-feature-flag-runtime";
const privateHeaders = { "cache-control": "private, no-store" };
export async function GET() {
  const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response || !auth.user) return auth.response;
  try { return NextResponse.json({ actorContext: importDigest([auth.user.id, auth.user.role, auth.user.roleAssignmentId]), model: "LEGACY_ASSESSMENT", choices: await legacyImportChoices(prisma, auth.user), preview: true, import: isOperationalReleaseFeatureEnabled(REAL_DATA_IMPORTS_FEATURE) }, { headers: privateHeaders }); }
  catch { return NextResponse.json({ error: "Access denied for marks import." }, { status: 403, headers: privateHeaders }); }
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("ENTER_MARKS"); if (auth.response || !auth.user) return auth.response;
  try {
    const body = await readImportJson(request, ["action", "csv", "model", "assessmentId", "academicYear", "receipt"]);
    if (body.model !== "LEGACY_ASSESSMENT" || typeof body.assessmentId !== "string" || typeof body.academicYear !== "string") throw new Error("Select the exact legacy assessment model and year.");
    const context = await legacyImportContext(prisma, auth.user, body.assessmentId, body.academicYear);
    assertLegacyCsvContext(body.csv, context);
    const binding = { model: body.model, actor: auth.user.id, role: auth.user.role, csv: body.csv, context };
    if (body.action === "preview") return NextResponse.json({ preview: await previewMarksImport(prisma, auth.user, body.csv), receipt: issueImportReceipt(binding), import: isOperationalReleaseFeatureEnabled(REAL_DATA_IMPORTS_FEATURE) }, { headers: privateHeaders });
    const denied = requireOperationalReleaseFeatureForApi(REAL_DATA_IMPORTS_FEATURE); if (denied) return denied;
    requireImportReceipt(body.receipt, binding);
    if (body.action !== "confirm") throw new Error("Choose preview or confirm.");
    return NextResponse.json({ result: await applyMarksImport(prisma, auth.user, body.csv, { id: auth.user.id, name: auth.user.name }, new Date(), { assessmentId: body.assessmentId, academicYear: body.academicYear, expectedUpdatedAt: context.assessment.updatedAt.toISOString() }) }, { headers: privateHeaders });
  } catch (error) { const r = marksError(error); return NextResponse.json({ error: r.message }, { status: r.status, headers: privateHeaders }); }
}
