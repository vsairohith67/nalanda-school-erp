import { academicReportError, academicReportJson, requireAcademicReportAccess } from "@/lib/academic-reporting-api";
import { getAcademicReportRun } from "@/lib/academic-reporting";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ runKey: string }> }) {
  const auth = await requireAcademicReportAccess();
  if (auth.response || !auth.context) return auth.response;
  try { return academicReportJson({ run: await getAcademicReportRun(prisma, (await params).runKey, auth.context.user) }); }
  catch (error) { return academicReportError(error); }
}
