import { NextRequest, NextResponse } from "next/server";
import { admissionReportCsv, admissionReports } from "@/lib/admissions";
import { admissionsError, admissionsJson, ADMISSIONS_PRIVATE_HEADERS, requireAdmissionsAny } from "@/lib/admissions-api";
import { prisma } from "@/lib/prisma";
export async function GET() { const auth = await requireAdmissionsAny(["VIEW_ADMISSION_REPORTS"]); if (auth.response || !auth.user) return auth.response; try { return admissionsJson(await admissionReports(prisma, auth.user)); } catch (error) { return admissionsError(error); } }
export async function POST(_: NextRequest) { const auth = await requireAdmissionsAny(["EXPORT_ADMISSION_REPORTS"]); if (auth.response || !auth.user) return auth.response; try { const csv = admissionReportCsv(await admissionReports(prisma, auth.user)); return new NextResponse(csv, { headers: { ...ADMISSIONS_PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=admissions-aggregate-report.csv" } }); } catch (error) { return admissionsError(error); } }
