import { NextResponse } from "next/server";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { ReleaseFeatureUnavailableError } from "@/lib/release-feature-flag-runtime";
export const CERTIFICATE_PRIVATE_HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Referrer-Policy": "no-referrer" };
export function certificateHttpError(error: unknown) {
  return NextResponse.json({ error: error instanceof CertificateWorkflowError ? error.message : error instanceof ReleaseFeatureUnavailableError ? "Capability unavailable." : "Certificate operation failed. Review the selected records and configuration." }, { status: error instanceof CertificateWorkflowError || error instanceof ReleaseFeatureUnavailableError ? error.status : 400, headers: CERTIFICATE_PRIVATE_HEADERS });
}
