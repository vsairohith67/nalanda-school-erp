import { NextRequest, NextResponse } from "next/server";
import { previewManagementPayslipSource, PAYSLIP_PRIVATE_HEADERS } from "@/lib/payslip-request";
import { payslipError, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function GET(_request: NextRequest, context: { params: Promise<{ documentKey: string }> }) {
  const auth = await requirePayslipAny(["UPLOAD_PAYSLIP_DOCUMENT", "ISSUE_PAYSLIP_DOCUMENT", "VIEW_PAYSLIP_REQUEST_AUDIT"]);
  if (auth.response || !auth.context) return auth.response;
  try {
    const result = await previewManagementPayslipSource(prisma, (await context.params).documentKey, auth.context);
    return new NextResponse(result.bytes, { headers: { ...PAYSLIP_PRIVATE_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": "inline; filename=management-source.pdf", "Content-Security-Policy": "sandbox; default-src 'none'", "X-Document-SHA256": result.sha256 } });
  } catch (error) { return payslipError(error); }
}
