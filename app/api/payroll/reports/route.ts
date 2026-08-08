import { NextRequest, NextResponse } from "next/server";
import { payrollReportCsv, payrollReports, PAYROLL_PRIVATE_HEADERS } from "@/lib/payroll";
import { payrollError, payrollJson, requirePayrollAny } from "@/lib/payroll-api";
import { prisma } from "@/lib/prisma";
export async function GET() {
  const auth = await requirePayrollAny(["VIEW_PAYROLL_REPORTS", "VIEW_PAYROLL_AGGREGATES"]);
  if (auth.response) return auth.response;
  try { return payrollJson(await payrollReports(prisma, { aggregateOnly: auth.permission === "VIEW_PAYROLL_AGGREGATES" })); } catch (error) { return payrollError(error); }
}
export async function POST(_: NextRequest) {
  const auth = await requirePayrollAny(["EXPORT_PAYROLL_REPORTS"]);
  if (auth.response) return auth.response;
  try { return new NextResponse(payrollReportCsv(await payrollReports(prisma)), { headers: { ...PAYROLL_PRIVATE_HEADERS, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=payroll-governed-report.csv" } }); } catch (error) { return payrollError(error); }
}
