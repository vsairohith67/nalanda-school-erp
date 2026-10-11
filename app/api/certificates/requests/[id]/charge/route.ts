import { assertGraduationEnabled } from "@/lib/certificate-graduation-policy";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prepareCertificateCharge, approveCertificateCharge, collectCertificateCharge } from "@/lib/certificate-charges";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 const auth=await requireApiPermission("VIEW_CERTIFICATES"); if(auth.response)return auth.response;
 try { assertGraduationEnabled("GRADUATION"); return NextResponse.json({charge:await prisma.certificateRequestCharge.findUnique({where:{requestId:(await params).id}})},{headers:CERTIFICATE_PRIVATE_HEADERS}); } catch(e) { return certificateHttpError(e); }
}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {
 try { const b=await request.json(); if(!["prepare","approve","collect"].includes(b.action))throw new Error("Action invalid");
 const auth=await requireApiPermission(b.action==="approve"?"MANAGE_MISC_INCOME_ITEMS":"MANAGE_MISC_INCOME");if(auth.response)return auth.response;
 const id=(await params).id; const charge=b.action==="prepare"?await prepareCertificateCharge(prisma,id,auth.user.id):b.action==="approve"?await approveCertificateCharge(prisma,id,auth.user.id,b.expectedUpdatedAt,b.waiverReason):await collectCertificateCharge(prisma,id,auth.user.id,b);
 return NextResponse.json({charge},{headers:CERTIFICATE_PRIVATE_HEADERS}); }catch(e){return certificateHttpError(e);}
}
