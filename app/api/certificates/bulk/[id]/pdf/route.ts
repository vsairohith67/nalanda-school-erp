import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { certificateBatchResults } from "@/lib/certificate-bulk";
import { issuedCertificatePdf } from "@/lib/certificate-authenticity";
import { mergeReportPdfs } from "@/lib/report-pdf";
import { runWithReportPdfCapacity } from "@/lib/report-pdf-jobs";
import { CERTIFICATE_BULK_FEATURE } from "@/lib/certificate-graduation-policy";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("EXPORT_CERTIFICATE_REPORTS"); if (auth.response) return auth.response;
  try {
    assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
    const batch = await certificateBatchResults(prisma, (await params).id);
    const rows = batch.rows.filter((r: any) => r.result === "SUCCEEDED");
    if (batch.status !== "APPROVED" || !rows.length || rows.length > 100) throw new CertificateWorkflowError("No approved successful rows are available for bulk print.", 409);
    const pdf = await runWithReportPdfCapacity(async () => {
      const bytes: Buffer[] = [];
      let total = 0;
      for (const row of rows) { const pdf = await issuedCertificatePdf(prisma, row.certificateId!); total += pdf.length; if (total > 20 * 1024 * 1024) throw new CertificateWorkflowError("Select a smaller reviewed batch for print.", 413); bytes.push(pdf); }
      return mergeReportPdfs(bytes);
    });
    return new NextResponse(new Uint8Array(pdf), { headers: { ...CERTIFICATE_PRIVATE_HEADERS, "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="reviewed-issued-certificates.pdf"' } });
  } catch (e) { return certificateHttpError(e); }
}
