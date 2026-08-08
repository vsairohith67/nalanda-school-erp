import { NextRequest, NextResponse } from "next/server";
import { findPayslipForDownload, PAYROLL_PRIVATE_HEADERS } from "@/lib/payroll";
import { payrollError, requirePayrollAny } from "@/lib/payroll-api";
import { generatePayslipPdf } from "@/lib/payroll-pdf";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest, context: { params: Promise<{ reference: string }> }) {
  const auth = await requirePayrollAny(["VIEW_PAYROLL"]);
  if (auth.response) return auth.response;
  try {
    const payslip = await findPayslipForDownload(prisma, (await context.params).reference, {});
    const monochrome = request.nextUrl.searchParams.get("mode") === "monochrome";
    const bytes = await generatePayslipPdf(payslip.snapshot, payslip.reference, monochrome);
    return new NextResponse(Buffer.from(bytes), { headers: { ...PAYROLL_PRIVATE_HEADERS, "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength), "Content-Disposition": `attachment; filename="payslip-${payslip.reference}-${monochrome ? "monochrome" : "colour"}.pdf"`, "X-Payslip-SHA256": payslip.hash } });
  } catch (error) { return payrollError(error); }
}
