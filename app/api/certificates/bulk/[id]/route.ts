import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { approveCertificateBatch, certificateBatchResults, processCertificateBatchRow } from "@/lib/certificate-bulk";
import { assertOperationalReleaseFeature } from "@/lib/release-feature-flag-runtime";
import { CERTIFICATE_BULK_FEATURE } from "@/lib/certificate-graduation-policy";
import { certificateHttpError, CERTIFICATE_PRIVATE_HEADERS } from "@/lib/certificate-http";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}) {const auth=await requireApiPermission("VIEW_CERTIFICATES");if(auth.response)return auth.response;try{assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);return NextResponse.json(await certificateBatchResults(prisma,(await params).id),{headers:CERTIFICATE_PRIVATE_HEADERS});}catch(e){return certificateHttpError(e);}}
export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}) {try{const b=await request.json();if(!["approve","process"].includes(b.action))throw new Error("Action refused");const auth=await requireApiPermission(b.action==="approve"?"APPROVE_CERTIFICATES":"ISSUE_CERTIFICATES");if(auth.response)return auth.response;const id=(await params).id;assertOperationalReleaseFeature(CERTIFICATE_BULK_FEATURE);
 if(b.action==="approve")return NextResponse.json(await approveCertificateBatch(prisma,id,auth.user.id,b),{headers:CERTIFICATE_PRIVATE_HEADERS});
 try{return NextResponse.json(await processCertificateBatchRow(prisma,id,Number(b.number),auth.user.id),{headers:CERTIFICATE_PRIVATE_HEADERS});}catch(e){await prisma.studentCertificateEvent.create({data:{eventType:"CERTIFICATE_BULK_ROW_FAILED",notes:`${id}:${Number(b.number)}`,reason:"Row did not finish; inspect current source and approval before retry.",recordedByUserId:auth.user.id}});throw e;}
}catch(e){return certificateHttpError(e);}}
