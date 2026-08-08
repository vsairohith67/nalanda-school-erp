import { NextRequest } from "next/server";
import { transitionPayslipRequest } from "@/lib/payslip-request";
import { payslipBody, payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) {
  let body: Record<string, unknown>;
  try { body = await payslipBody(request); } catch (error) { return payslipError(error); }
  const action = String(body.action ?? "").toUpperCase();
  const auth = await requirePayslipAny(action === "REJECT" || action === "EXPIRE" ? ["ISSUE_PAYSLIP_DOCUMENT"] : ["PREPARE_PAYSLIP_REQUEST"]);
  if (auth.response || !auth.context) return auth.response;
  try { return payslipJson(await transitionPayslipRequest(prisma, (await context.params).requestKey, body, auth.context)); } catch (error) { return payslipError(error); }
}
