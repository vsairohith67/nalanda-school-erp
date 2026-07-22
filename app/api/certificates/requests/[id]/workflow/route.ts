import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { transitionCertificateRequest, CertificateWorkflowError } from "@/lib/certificate-requests";
import type { Permission } from "@/lib/permissions";

const permissions: Record<string, Permission> = {
  review: "REVIEW_CERTIFICATES",
  approve: "APPROVE_CERTIFICATES",
  reject: "MANAGE_CERTIFICATE_REQUESTS",
  cancel: "MANAGE_CERTIFICATE_REQUESTS"
};

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const body = await request.json();
    const permission = permissions[String(body.action)];
    if (!permission) return NextResponse.json({ error: "Unsupported request action." }, { status: 400 });
    const auth = await requireApiPermission(permission);
    if (auth.response) return auth.response;
    return NextResponse.json({ request: await transitionCertificateRequest(prisma, (await params).id, body.action, auth.user.id, body.expectedUpdatedAt, body.reason) });
  } catch (error) {
    return NextResponse.json({ error: safeClientError(error, "Workflow failed.") }, { status: error instanceof CertificateWorkflowError ? error.status : 400 });
  }
}
