import { NextRequest } from "next/server";
import { uploadPayslipDocument, PayslipRequestError } from "@/lib/payslip-request";
import { payslipError, payslipJson, requirePayslipAny } from "@/lib/payslip-request-api";
import { prisma } from "@/lib/prisma";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";

export async function POST(request: NextRequest, context: { params: Promise<{ requestKey: string }> }) {
  if (!unsafeRequestOriginAllowed(request)) return payslipError(new PayslipRequestError("The request origin is not allowed.", 403, "ORIGIN_DENIED"));
  const type = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!type.startsWith("multipart/form-data;")) return payslipError(new PayslipRequestError("Use a multipart PDF upload.", 415));
  try {
    const form = await request.formData();
    const replacement = form.get("replacement") === "true";
    const auth = await requirePayslipAny(replacement ? ["REPLACE_PAYSLIP_DOCUMENT"] : ["UPLOAD_PAYSLIP_DOCUMENT"]);
    if (auth.response || !auth.context) return auth.response;
    const file = form.get("file");
    if (!(file instanceof File)) throw new PayslipRequestError("Choose a PDF file.");
    let months: unknown;
    try { months = JSON.parse(String(form.get("months") ?? "[]")); } catch { throw new PayslipRequestError("Document months are invalid."); }
    const raw = { months, expectedVersion: form.get("expectedVersion"), supersedesDocumentKey: form.get("supersedesDocumentKey"), replacementReason: form.get("replacementReason") };
    return payslipJson({ document: await uploadPayslipDocument(prisma, (await context.params).requestKey, file, raw, auth.context, replacement) }, 201);
  } catch (error) { return payslipError(error); }
}
