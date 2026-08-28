import { NextRequest, NextResponse } from "next/server";
import { downloadOwnPayslip, PAYSLIP_PRIVATE_HEADERS } from "@/lib/payslip-request";
import { verifyPayslipDownload } from "@/lib/payslip-request-crypto";
import { payslipError, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, context: { params: Promise<{ documentKey: string }> }) {
  const auth = await requirePayslipAny(["VIEW_OWN_PAYSLIP_REQUESTS"], "TEACHER");
  if (auth.response || !auth.context) return auth.response;
  const documentKey = (await context.params).documentKey;
  if (!verifyPayslipDownload(request.nextUrl.searchParams.get("authorization") ?? "", documentKey, auth.context.sessionId)) {
    return NextResponse.json({ error: "The private download authorization expired. Refresh the Staff portal." }, { status: 403, headers: PAYSLIP_PRIVATE_HEADERS });
  }
  if (request.headers.has("range")) return new NextResponse(null, { status: 416, headers: { ...PAYSLIP_PRIVATE_HEADERS, "Accept-Ranges": "none" } });
  try {
    const result = await downloadOwnPayslip(prisma, documentKey, auth.context);
    return new NextResponse(new Uint8Array(result.bytes), { status: 200, headers: { ...PAYSLIP_PRIVATE_HEADERS, "Content-Type": "application/pdf", "Content-Length": String(result.bytes.length), "Content-Disposition": `attachment; filename="${result.filename}"`, "Content-Security-Policy": "sandbox; default-src 'none'", "Accept-Ranges": "none", "X-Document-SHA256": result.sha256 } });
  } catch (error) { return payslipError(error); }
}
