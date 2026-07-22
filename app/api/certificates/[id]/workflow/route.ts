import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cancelIssuedCertificate, createCertificateVersion, issueCertificate, transitionCertificate } from "@/lib/student-certificates";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import type { Permission } from "@/lib/permissions";

const permissions: Record<string, Permission> = {
  submit: "REVIEW_CERTIFICATES",
  approve: "APPROVE_CERTIFICATES",
  issue: "ISSUE_CERTIFICATES",
  correct: "CORRECT_ISSUED_CERTIFICATES",
  reissue: "CORRECT_ISSUED_CERTIFICATES",
  cancel: "CANCEL_ISSUED_CERTIFICATES"
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const permission = permissions[String(body.action)];
    if (!permission) return NextResponse.json({ error: "Unsupported certificate action." }, { status: 400 });
    const auth = await requireApiPermission(permission);
    if (auth.response) return auth.response;
    const id = (await params).id;
    const result = body.action === "submit" || body.action === "approve"
      ? await transitionCertificate(prisma, id, body.action, auth.user.id, body.expectedUpdatedAt)
      : body.action === "issue"
        ? await issueCertificate(prisma, id, auth.user.id, { expectedUpdatedAt: body.expectedUpdatedAt, activeEnrollmentReason: body.activeEnrollmentReason })
        : body.action === "correct" || body.action === "reissue"
          ? await createCertificateVersion(prisma, id, body.action === "correct" ? "CORRECTION" : "REISSUE", auth.user.id, String(body.reason ?? ""))
          : await cancelIssuedCertificate(prisma, id, auth.user.id, String(body.reason ?? ""));
    return NextResponse.json({ result });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Workflow failed.") }, { status: error instanceof CertificateWorkflowError ? error.status : 400 });
  }
}
