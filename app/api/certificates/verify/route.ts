import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { verifyCertificateReference } from "@/lib/certificate-authenticity";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function POST(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_CERTIFICATES"); if (auth.response) return auth.response;
  try { const body = await request.json(); return NextResponse.json(await verifyCertificateReference(prisma, String(body.token ?? "")), { headers: CERTIFICATE_PRIVATE_HEADERS }); } catch (e) { return certificateHttpError(e); }
}
