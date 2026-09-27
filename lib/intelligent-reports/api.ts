import { NextRequest,NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unsafeRequestOriginAllowed } from "@/lib/request-security";
import { BoundedSemaphore,ResourceGuardError } from "@/lib/resource-guard";
import { checkAcademicCalendarExportRateLimit } from "@/lib/academic-calendar-export-rate-limit";
import { logUserAction } from "@/lib/user-audit";
import { readImportBytes, ImportRequestError } from "@/lib/import-request";
import { authorize } from "./access";
import { ReportError,object,keys,interpretQuestion,parseQuery,type Family } from "./contract";
import { options,availability,execute,pageReport,reportCsv } from "./service";
import { resolvedTargets } from "./readers";

export const HEADERS={"Cache-Control":"private, no-store, max-age=0","Pragma":"no-cache","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Vary":"Cookie","X-Robots-Tag":"noindex, nofollow, noarchive"};
export const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:HEADERS});
const capacity=new BoundedSemaphore(2,2,250);
export async function handle(request:NextRequest,action:"access"|"options"|"interpret"|"run"|"source"|"export") {
  let release:(()=>void)|undefined;
  try {
    const context=await getCurrentAuthContext();
    if(!context)throw new ReportError("Sign in to use Ask Nalanda.","AUTH_REQUIRED",401);
    if(context.user.mustChangePassword)throw new ReportError("Password change required.","ACCESS_DENIED",403);
    const identity={userId:context.user.id,sessionId:context.sessionId,roleAssignmentId:context.user.roleAssignmentId};
    await authorize(prisma,identity);
    if(action==="access")return json(await availability(prisma,identity));
    if(!unsafeRequestOriginAllowed(request))throw new ReportError("Request origin denied.","ORIGIN_DENIED",403);
    if(request.headers.get("content-type")?.split(";")[0]!=="application/json")throw new ReportError("Use application/json.");
    let bytes:Uint8Array;
    try { bytes=await readImportBytes(request,16000); } catch(error) { if(error instanceof ImportRequestError)throw new ReportError("Request body is missing or exceeds 16 KB.","REQUEST_TOO_LARGE",413);throw error; }
    const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    let body:Record<string,unknown>;try{body=object(JSON.parse(text));}catch{throw new ReportError("Invalid JSON request.");}
    const rate=checkAcademicCalendarExportRateLimit(`intelligent-reports:${context.user.id}:${action}`);
    if(!rate.allowed)throw new ReportError("Too many report requests. Wait before retrying.","RATE_LIMIT",429);
    release=await capacity.acquire();
    if(action==="options") {keys(body,["family","academicYear"]);return json(await options(prisma,identity,body.family as Family,String(body.academicYear)));}
    if(action==="interpret") {
      keys(body,["question","context"]);const c=object(body.context);
      // Authorise inferred family before retrieving metadata; no raw question retained.
      const words=typeof body.question==="string"?body.question.trim().toLowerCase():"";
      const family:Family=words.startsWith("attendance")?"ATTENDANCE":words.startsWith("outstanding fees")?"FEES":"ACADEMIC";
      const choices=await options(prisma,identity,family,String(c.academicYear));
      const query=interpretQuestion(body.question,c,choices.targets);
      await options(prisma,identity,query.family,query.academicYear);
      await resolvedTargets(prisma,query);
      return json({query});
    }
    keys(body,["query","expectedRevision",...(action==="source"?["key"]:[])]);
    if(body.expectedRevision!==undefined&&(typeof body.expectedRevision!=="string"||!/^[a-f0-9]{64}$/.test(body.expectedRevision)))throw new ReportError("Invalid source revision.");
    const query=parseQuery(body.query);
    if((action!=="run"||query.page>1)&&!body.expectedRevision)throw new ReportError("Run and review the report first.","REFRESH_REQUIRED",409);
    const report=await execute(prisma,identity,query,{exporting:action==="export",expectedRevision:body.expectedRevision as string|undefined});
    if(request.signal.aborted)throw new ReportError("Request cancelled.","CANCELLED",409);
    if(action==="source") {
      const row=report.rows.find(r=>r.key===body.key);if(!row)throw new ReportError("Source unavailable.","SOURCE_UNAVAILABLE",404);
      // Existing record routes perform independent domain authorization. No Student 360 link.
      return json({row,definition:report.definition,generatedAt:report.generatedAt,sourceRevision:report.sourceRevision});
    }
    const csv=action==="export"?reportCsv(report):undefined;
    await logUserAction(prisma,{action:action==="export"?"INTELLIGENT_REPORT_EXPORTED":"INTELLIGENT_REPORT_READ",actor:context.user,details:{family:query.family,sourceState:query.sourceState,operation:action}});
    if(csv!==undefined)return new NextResponse(csv,{headers:{...HEADERS,"Content-Type":"text/csv; charset=utf-8","Content-Disposition":`attachment; filename="nalanda-${query.family.toLowerCase()}-${query.academicYear}.csv"`}});
    return json(pageReport(report));
  } catch(error) {
    if(error instanceof ReportError)return json({error:error.message,code:error.code},error.status);
    if(error instanceof ResourceGuardError)return json({error:error.message,code:error.code},error.status);
    return json({error:"The report could not be completed safely. Please retry after checking the source.",code:"REPORT_UNAVAILABLE"},500);
  } finally {release?.();}
}
