import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildAcademicReportSummary, parseAcademicReportInput, persistAcademicReportRun } from "@/lib/academic-reporting";
import { loadAcademicReportSources } from "@/lib/academic-reporting-sources";
import { academicReportBody, academicReportError, academicReportJson, requireAcademicReportAccess } from "@/lib/academic-reporting-api";

export async function POST(request: NextRequest) {
  const auth = await requireAcademicReportAccess();
  if (auth.response || !auth.context) return auth.response;
  try {
    const input = parseAcademicReportInput(await academicReportBody(request));
    const loaded = await loadAcademicReportSources(prisma, input, auth.context.user, auth.context.sessionId);
    const generatedAt = new Date();
    const summary = buildAcademicReportSummary(loaded.sources, input, { audience: loaded.audience, generatedAt, expectedCompletion: loaded.expectedCompletion });
    const run = await persistAcademicReportRun(prisma, input, summary, loaded.sources, auth.context.user, loaded.accessScope, generatedAt);
    return academicReportJson({ run });
  } catch (error) { return academicReportError(error); }
}
