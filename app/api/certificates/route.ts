import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createStudentCertificateDraft } from "@/lib/student-certificates";
import { CertificateWorkflowError } from "@/lib/certificate-requests";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CERTIFICATES"); if (auth.response) return auth.response;
  const q = request.nextUrl.searchParams;
  const rows = await prisma.studentCertificate.findMany({ where: { ...(q.get("type") ? { certificateType: q.get("type")! } : {}), ...(q.get("status") ? { status: q.get("status")! } : {}), ...(q.get("academicYear") ? { academicYear: q.get("academicYear")! } : {}) }, orderBy: { createdAt: "desc" }, take: 250 });
  return NextResponse.json({ certificates: rows });
}
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("CREATE_CERTIFICATES"); if (auth.response) return auth.response;
  try { return NextResponse.json({ certificate: await createStudentCertificateDraft(prisma, await request.json(), auth.user.id) }, { status: 201 }); }
  catch (error) { return apiError(error); }
}
function apiError(error: unknown) { return NextResponse.json({ error: safeClientError(error, "Certificate operation failed.") }, { status: error instanceof CertificateWorkflowError ? error.status : 400 }); }
