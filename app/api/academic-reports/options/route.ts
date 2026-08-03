import { academicReportError, academicReportJson, requireAcademicReportAccess } from "@/lib/academic-reporting-api";
import { listAcademicReportFilterOptions } from "@/lib/academic-reporting-sources";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const auth = await requireAcademicReportAccess();
  if (auth.response || !auth.context) return auth.response;
  try { return academicReportJson({ options: await listAcademicReportFilterOptions(prisma, auth.context.user, auth.context.sessionId), role: auth.context.user.role }); }
  catch (error) { return academicReportError(error); }
}
