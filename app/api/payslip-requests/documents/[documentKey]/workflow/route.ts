import { NextRequest } from "next/server";
import { approvePayslipDocument, issuePayslipDocument, PayslipRequestError } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ documentKey: string }> }) {
  const auth = await requirePayslipAny(["ISSUE_PAYSLIP_DOCUMENT"]);
  if (auth.response || !auth.context) return auth.response;
  try {
    const body = await payslipBody(request), action = String(body.action ?? "").toUpperCase();
    const requestKey = String(body.requestKey ?? ""), documentKey = (await context.params).documentKey;
    if (String(body.documentKey ?? documentKey) !== documentKey) throw new PayslipRequestError("The document reference is invalid.");
    const result = action === "APPROVE"
      ? await approvePayslipDocument(prisma, requestKey, { ...body, documentKey }, auth.context)
      : action === "ISSUE" ? await issuePayslipDocument(prisma, requestKey, { ...body, documentKey }, auth.context) : null;
    if (!result) throw new PayslipRequestError("The document workflow action is invalid.");
    return payslipJson(result);
  } catch (error) { return payslipError(error); }
}
