import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { assertParentOwnsStudent } from "@/lib/certificate-scope";
import { issuedCertificatePdf } from "@/lib/certificate-authenticity";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { assertCertificateDocumentEnabled } from "@/lib/certificate-graduation-policy";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireApiPermission("VIEW_OWN_CHILD_CERTIFICATES"); if(auth.response)return auth.response;
 try { const id=(await params).id; const row=await prisma.studentCertificate.findUniqueOrThrow({where:{id}}); await assertParentOwnsStudent(prisma,auth.user,row.studentId); assertCertificateDocumentEnabled(row.certificateType); const bytes=await issuedCertificatePdf(prisma,id); return new NextResponse(new Uint8Array(bytes),{headers:{...CERTIFICATE_PRIVATE_HEADERS,"Content-Type":"application/pdf","Content-Disposition":'attachment; filename="issued-certificate.pdf"'}}); }catch(e){return certificateHttpError(e);}
}
