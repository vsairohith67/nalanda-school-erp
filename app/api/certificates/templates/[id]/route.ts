import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { editCertificateTemplate } from "@/lib/certificate-template-workflow";
import { CertificateWorkflowError } from "@/lib/certificate-requests";
import { safeClientError } from "@/lib/client-errors";
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireApiPermission("MANAGE_CERTIFICATE_TEMPLATES");
  if (auth.response) return auth.response;
  try { return NextResponse.json({ template: await editCertificateTemplate(prisma, (await params).id, await request.json(), auth.user.id) }); }
  catch (error) { return NextResponse.json({ error: safeClientError(error, "Template update failed.") }, { status: error instanceof CertificateWorkflowError ? error.status : 400 }); }
}
