import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertGraduationEnabled, graduationReadiness } from "@/lib/certificate-graduation-policy";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET(request: NextRequest) {
 const auth = await requireApiPermission("CREATE_CERTIFICATES"); if (auth.response) return auth.response;
 try { assertGraduationEnabled("GRADUATION"); const q=request.nextUrl.searchParams; const r=await graduationReadiness(prisma,q.get("studentId") ?? "",q.get("academicYear") ?? ""); return NextResponse.json(r,{headers:CERTIFICATE_PRIVATE_HEADERS}); } catch(e) { return certificateHttpError(e); }
}
