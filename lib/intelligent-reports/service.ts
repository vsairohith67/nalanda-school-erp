import type { PrismaClient } from "@prisma/client";
import { authorize, type Client, type Identity } from "./access";
import { FAMILIES, ReportError, parseQuery, year, type Family, type Query } from "./contract";
import { academicRows, attendanceRows, feeRows, cohort, resolvedTargets, targetOptions, digest, bounded, type ResultRow } from "./readers";

export async function options(db:Client,identity:Identity,family:Family,academicYear:string) {
  if(!FAMILIES.includes(family))throw new ReportError("Choose a supported family.");
  await authorize(db,identity,family);year(academicYear);
  const targets=await targetOptions(db,academicYear,family==="ACADEMIC");
  await authorize(db,identity,family);
  return {targets,academicYear,schoolId:"school" as const};
}
export async function availability(db:Client,identity:Identity) {
  const access=await authorize(db,identity);
  const families:Family[]=[];
  for(const family of FAMILIES)try{await authorize(db,identity,family);families.push(family);}catch(error){if(!(error instanceof ReportError))throw error;}
  const years=families.length?bounded(await db.timetableClassSection.findMany({distinct:["academicYear"],select:{academicYear:true},orderBy:{academicYear:"desc"},take:21}),20,"Academic years").map(v=>v.academicYear):[];
  return {families,years,context:digest([identity.userId,identity.sessionId,identity.roleAssignmentId,access.authorizationVersion,access.role])};
}
export type Report=Awaited<ReturnType<typeof readReport>>;
export async function readReport(db:Client,identity:Identity,value:unknown,exporting=false,now=new Date()) {
  const q=parseQuery(value);await authorize(db,identity,q.family,exporting);
  const targets=await resolvedTargets(db,q),enrollments=await cohort(db,q,targets);
  const data=q.family==="ACADEMIC"?await academicRows(db,q,targets,enrollments):q.family==="ATTENDANCE"?await attendanceRows(db,q,targets,enrollments):await feeRows(db,q,targets,enrollments,now);
  const sourceRevision=digest([q.family,q.academicYear,targets,enrollments,data.revisions]);
  const rows=[...data.rows].sort((a,b)=>{
    const primary=q.sort==="METRIC"?(a.metric===null?b.metric===null?0:1:b.metric===null?-1:a.metric-b.metric):a.name.localeCompare(b.name);
    return (q.direction==="DESC"?-primary:primary)||a.key.localeCompare(b.key);
  });
  const summary={population:rows.length,meets:rows.filter(r=>r.classification==="MEETS").length,doesNotMeet:rows.filter(r=>r.classification==="DOES_NOT_MEET").length,unresolved:rows.filter(r=>r.classification==="UNRESOLVED").length,outstandingPaise:q.family==="FEES"?rows.reduce((n,r)=>n+(r.metric??0),0):null};
  if(summary.outstandingPaise!==null&&!Number.isSafeInteger(summary.outstandingPaise))throw new ReportError("Aggregate amount exceeds supported precision.","FINANCE_UNRESOLVED",409);
  await authorize(db,identity,q.family,exporting);
  return {query:q,rows,summary,sourceRevision,generatedAt:now.toISOString(),definition:data.definition,scope:targets.map(t=>`${t.className}${t.section}${t.examId?` / ${t.exams.find(e=>e.id===t.examId)!.code}`:""}`),notice:"Every page and export is freshly generated. Source revision must match before paging, source details or export. Unresolved rows are included separately; no permanent Student labels are created."};
}
export async function execute(db:PrismaClient,identity:Identity,value:unknown,input:{exporting?:boolean;expectedRevision?:string}={}) {
  // Short request-scoped read snapshot, never retained across interactions.
  const report=await db.$transaction(tx=>readReport(tx,identity,value,input.exporting),{isolationLevel:"Serializable",maxWait:2000,timeout:15000});
  await authorize(db,identity,report.query.family,input.exporting);
  if(input.expectedRevision&&input.expectedRevision!==report.sourceRevision)throw new ReportError("Sources changed. Run the report again before paging, viewing details or exporting.","SOURCE_CHANGED",409);
  return report;
}
export function pageReport(report:Report) {
  const {page,pageSize}=report.query;
  return {...report,rows:report.rows.slice((page-1)*pageSize,page*pageSize).map(({href,...row})=>row)};
}
export function csvCell(value:unknown){const raw=String(value??"");return `"${(/^[\s\u0000-\u001f]*[=+\-@]/.test(raw)?"'":"")+raw.replaceAll('"','""')}"`;}
export function reportCsv(report:Report) {
  if(report.rows.length>2000)throw new ReportError("Export exceeds 2,000 rows; narrow the report.","EXPORT_LIMIT",413);
  const header=["Student","Admission","Class","Section","Metric","Numerator","Denominator","Classification","State","Source","Explanation"];
  const cells=[
    ["NALANDA PUBLIC SCHOOL","Ask Nalanda",report.query.family,report.query.academicYear],
    ["Scope",report.scope.join("; "),"Generated",report.generatedAt],
    ["Definition",report.definition],
    ["Criterion",report.query.comparator,report.query.threshold,"Term",report.query.term??"","From",report.query.from??"","To",report.query.to??""],
    ["Population",report.summary.population,"Meets",report.summary.meets,"Does not meet",report.summary.doesNotMeet,"Unresolved",report.summary.unresolved,"Outstanding paise",report.summary.outstandingPaise??""],
    ["Source revision",report.sourceRevision],header,
    ...report.rows.map(r=>[r.name,r.admission,r.className,r.section,r.metric,r.numerator,r.denominator,r.classification,r.state,r.source,r.explanation])
  ];
  const csv=cells.map(row=>row.map(csvCell).join(",")).join("\r\n");
  if(Buffer.byteLength(csv,"utf8")>2_000_000)throw new ReportError("Export exceeds the 2 MB limit; narrow the report.","EXPORT_LIMIT",413);
  return csv;
}
export type { ResultRow, Query };
