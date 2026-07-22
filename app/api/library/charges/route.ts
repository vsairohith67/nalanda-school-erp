import { safeClientError } from "@/lib/client-errors";
import { NextRequest, NextResponse } from "next/server";
import { requireApiPermission } from "@/lib/auth";
import { chargeInclude, publicCharge } from "@/lib/library-accountability-api";
import { createLibraryCharge, previewLibraryCharge } from "@/lib/library-charges";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireApiPermission("VIEW_LIBRARY_CHARGES"); if (auth.response) return auth.response;
  const status=request.nextUrl.searchParams.get("status"),type=request.nextUrl.searchParams.get("type");
  const rows=await prisma.libraryCharge.findMany({where:{...(status?{status}:{}),...(type?{chargeType:type}:{})},include:chargeInclude,orderBy:{assessedDate:"desc"}});
  return NextResponse.json({charges:rows.map((row)=>publicCharge(row,auth.user.role==="VIEWER"))});
}
export async function POST(request: NextRequest) {
  const auth=await requireApiPermission("ASSESS_LIBRARY_CHARGES");if(auth.response)return auth.response;
  try {
    const body=await request.json();
    if(String(body.action??"").toLowerCase()==="preview"){
      const p=await previewLibraryCharge(prisma,body); const copy=(p as any).loan?.copy??p.incident?.copy;
      return NextResponse.json({preview:{source:p.source,loan:{loanNumber:p.loan.loanNumber,issueDate:p.loan.issueDate,dueDate:p.loan.dueDate,copy:{accessionNumber:copy?.accessionNumber,title:copy?.title?.title}},incident:p.incident?{incidentNumber:p.incident.incidentNumber,type:p.incident.incidentType}:null,borrower:p.member.student?.studentName??p.member.staffMember?.fullName,overdueDays:p.overdueDays,rule:p.rule?{ruleCode:p.rule.ruleCode,graceDays:p.rule.graceDays,overdueAmountPerDay:p.rule.overdueAmountPerDay.toFixed(2),maximumOverdueAmount:p.rule.maximumOverdueAmount?.toFixed(2)??null}:null,ruleScope:p.ruleScope,warning:p.warning,suggestedAmount:p.suggestedAmount?.toFixed(2)??null,chargeableDays:p.chargeableDays,acquisitionCostSuggestion:p.acquisitionCostSuggestion?.toFixed(2)??null}});
    }
    const row=await createLibraryCharge(prisma,body,auth.user.id);return NextResponse.json({charge:{id:row.id,chargeNumber:row.chargeNumber,status:row.status}},{status:201});
  } catch(error){return NextResponse.json({error:safeClientError(error, "Unable to assess charge")},{status:400});}
}
