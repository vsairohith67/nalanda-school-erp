import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { CERTIFICATE_BULK_FEATURE } from "@/lib/certificate-graduation-policy";
import { certificateWorkbookTemplate } from "@/lib/certificate-workbooks";
import { uploadCertificateBatch } from "@/lib/certificate-bulk";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET() { const auth=await requireApiPermission("CREATE_CERTIFICATES");if(auth.response)return auth.response;try{assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);return new NextResponse(new Uint8Array(certificateWorkbookTemplate()),{headers:{...CERTIFICATE_PRIVATE_HEADERS,"Content-Type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","Content-Disposition":'attachment; filename="certificate-bulk-v1.xlsx"'}});}catch(e){return certificateHttpError(e);} }
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_CERTIFICATES");
  if (auth.response) return auth.response;
  try {
    assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data;") || contentType.length > 250) throw new CertificateWorkflowError("Use a bounded XLSX multipart upload.");
    const maximum = 1024 * 1024 + 16 * 1024;
    if (Number(request.headers.get("content-length") ?? 0) > maximum || !request.body) throw new CertificateWorkflowError("Workbook upload exceeds the size limit.");
    const reader = request.body.getReader(), chunks: Uint8Array[] = [];
    let size = 0, timedOut = false;
    const timer = setTimeout(() => { timedOut = true; void reader.cancel(); }, 10_000);
    try {
      while (true) {
        const part = await reader.read();
        if (timedOut) throw new CertificateWorkflowError("Workbook upload timed out.");
        if (part.done) break;
        size += part.value.byteLength;
        if (size > maximum) { void reader.cancel(); throw new CertificateWorkflowError("Workbook upload exceeds the size limit."); }
        chunks.push(part.value);
      }
    } finally { clearTimeout(timer); reader.releaseLock(); }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), { headers: { "Content-Type": contentType } }).formData();
    if ([...form.keys()].length !== 2 || !form.has("workbook") || !form.has("templateId")) throw new CertificateWorkflowError("Only a workbook and template are accepted.");
    const file = form.get("workbook"), templateId = form.get("templateId");
    if (!(file instanceof File) || file.size < 1 || file.size > 1024 * 1024 || file.name.length > 180 || !file.name.toLowerCase().endsWith(".xlsx")) throw new CertificateWorkflowError("An XLSX workbook up to 1 MB is required.");
    if (!["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"].includes(file.type) || typeof templateId !== "string" || templateId.length > 100) throw new CertificateWorkflowError("Workbook type or template is invalid.");
    const batch = await uploadCertificateBatch(prisma, Buffer.from(await file.arrayBuffer()), templateId, auth.user.id);
    return NextResponse.json({ batch }, { headers: CERTIFICATE_PRIVATE_HEADERS });
  } catch (error) { return certificateHttpError(error); }
}
