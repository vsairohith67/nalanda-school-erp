import { Prisma } from "@prisma/client";
import { createHash } from "node:crypto";
import { parsePublishedSnapshot } from "@/lib/report-publication";
import { allocateFees, dueDateForMonth } from "@/lib/fee-allocation";
import { effectiveReceiptState } from "@/lib/receipt-integrity";
import { ReportError, ATTENDANCE_BUCKETS, type AttendanceEvidence, type AttendanceDateEvidence, type AttendanceReason, type Query, type Target } from "./contract";
import type { Client } from "./access";

export const MAX_COHORT = 2000;
export type ResultRow = {
  key:string; name:string; admission:string; className:string; section:string;
  metric:number|null; numerator:number|null; denominator:number|null;
  classification:"MEETS"|"DOES_NOT_MEET"|"UNRESOLVED";
  state:string; explanation:string; source:string; revision:string; href?:string;
};
export const digest=(value:unknown)=>createHash("sha256").update(JSON.stringify(value)).digest("hex");
/** Source collections are sets: normalize keys and collection order, retaining duplicates. */
export function sourceDigest(value:unknown):string {
  const canonical=(v:unknown):unknown=>v instanceof Date?v.toISOString():Array.isArray(v)?v.map(canonical).sort((a,b)=>{const x=JSON.stringify(a),y=JSON.stringify(b);return x<y?-1:x>y?1:0;}):v&&typeof v==="object"?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,item])=>[k,canonical(item)])):v;
  return digest(canonical(value));
}
export function bounded<T>(rows:T[], max:number, name:string):T[] { if(rows.length>max)throw new ReportError(`${name} exceeds the supported limit; narrow the scope. No partial report was returned.`,"RANGE_TOO_LARGE",413);return rows; }
export async function targetOptions(db:Client, academicYear:string, academic:boolean):Promise<Target[]> {
  const targets=bounded(await db.timetableClassSection.findMany({where:{academicYear},select:{id:true,className:true,section:true},orderBy:[{className:"asc"},{section:"asc"}],take:501}),500,"Class/section metadata");
  const exams=academic?bounded(await db.examinationClassScope.findMany({where:{academicYear,timetableClassSectionId:{in:targets.map(t=>t.id)}},select:{timetableClassSectionId:true,examination:{select:{id:true,examCode:true,name:true,academicYear:true}}},take:2001}),2000,"Examination metadata"):[];
  return targets.map(t=>({...t,exams:exams.filter(e=>e.timetableClassSectionId===t.id && e.examination.academicYear===academicYear).map(e=>({id:e.examination.id,code:e.examination.examCode,name:e.examination.name}))}));
}
export async function resolvedTargets(db:Client,q:Query) {
  const options=await targetOptions(db,q.academicYear,q.family==="ACADEMIC");
  return q.targets.map(t=>{
    const found=options.find(o=>o.id===t.id);
    if(!found || (q.family==="ACADEMIC" && !found.exams.some(e=>e.id===t.examId)))throw new ReportError("Selected scope is unavailable. Refresh authorised choices.","SCOPE_UNAVAILABLE",404);
    return {...found,examId:t.examId};
  });
}
type Resolved=Awaited<ReturnType<typeof resolvedTargets>>;
const scopeWhere=(targets:Resolved)=>targets.flatMap(t=>t.section?[{className:t.className,section:t.section}]:[{className:t.className,section:null},{className:t.className,section:""}]);
export async function cohort(db:Client,q:Query,targets:Resolved) {
  return bounded(await db.academicYearEnrollment.findMany({where:{academicYear:q.academicYear,OR:scopeWhere(targets),student:{deletedAt:null}},select:{id:true,studentId:true,className:true,section:true,status:true,enrollmentDate:true,exitDate:true,updatedAt:true,student:{select:{studentName:true,admissionNo:true,academicYear:true,className:true,studentType:true,discountPercent:true}}},orderBy:{id:"asc"},take:MAX_COHORT+1}),MAX_COHORT,"Student cohort");
}
type Enrollment=Awaited<ReturnType<typeof cohort>>[number];
const rowFor=(e:Enrollment):ResultRow=>({key:digest(e.id).slice(0,24),name:e.student.studentName,admission:e.student.admissionNo,className:e.className,section:e.section??"",metric:null,numerator:null,denominator:null,classification:"UNRESOLVED",state:"UNAVAILABLE",explanation:"No complete authoritative evidence.",source:"",revision:""});
export function decimalMatches(value:Prisma.Decimal,q:Pick<Query,"comparator"|"threshold">) {
  const c=value.comparedTo(new Prisma.Decimal(q.threshold));return q.comparator==="LT"?c<0:q.comparator==="LTE"?c<=0:q.comparator==="GT"?c>0:c>=0;
}
export async function academicRows(db:Client,q:Query,targets:Resolved,enrollments:Enrollment[]) {
  const versions=bounded(await db.studentReportCardVersion.findMany({where:{reportCard:{academicYear:q.academicYear,status:"ISSUED",batch:{status:"ISSUED"},OR:scopeWhere(targets),studentId:{in:enrollments.map(e=>e.studentId)}}},select:{id:true,versionNumber:true,snapshotJson:true,issuedAt:true,reportCard:{select:{id:true,studentId:true,currentVersionNumber:true,className:true,section:true}}},orderBy:{id:"asc"},take:8001}),8000,"Issued versions");
  const snapshots=bounded(await db.studentResultSnapshot.findMany({where:{examinationId:{in:targets.map(t=>t.examId!)},runStatus:"LOCKED",lockedAt:{not:null},studentId:{in:enrollments.map(e=>e.studentId)},classScope:{OR:targets.map(t=>({className:t.className,section:t.section}))}},select:{id:true,studentId:true,examinationId:true,snapshotVersion:true,totalObtained:true,totalMaximum:true,percentage:true,formulaVersion:true,roundingPolicyVersion:true,inputFingerprint:true,runStatus:true,lockedAt:true,classScope:{select:{className:true,section:true}}},take:8001}),8000,"Result versions");
  const byId=new Map(snapshots.map(s=>[s.id,s]));
  const evidence=new Map<string,Array<{snapshot:typeof snapshots[number];version:typeof versions[number];published:ReturnType<typeof parsePublishedSnapshot>}>>();
  for(const version of versions) {
    if(version.versionNumber!==version.reportCard.currentVersionNumber)continue;
    try {
      const p=parsePublishedSnapshot(version.snapshotJson),s=byId.get(p.governance.internal.resultSnapshotId);
      if(!s || s.studentId!==version.reportCard.studentId || s.snapshotVersion!==p.governance.resultSnapshotVersion || s.formulaVersion!==p.governance.formulaVersion || s.roundingPolicyVersion!==p.governance.roundingPolicyVersion || !s.percentage.equals(new Prisma.Decimal(p.content.percentage)) || !s.totalMaximum.equals(new Prisma.Decimal(p.content.totalMaximum)) || !s.totalObtained.equals(new Prisma.Decimal(p.content.totalObtained)))continue;
      const target=targets.find(t=>t.examId===s.examinationId && t.className===s.classScope.className && t.section===s.classScope.section);
      if(!target || p.academicYear!==q.academicYear || p.student.className!==target.className || (p.student.section??"")!==target.section || p.examination.code.toUpperCase()!==target.exams.find(e=>e.id===s.examinationId)?.code.toUpperCase())continue;
      const key=`${s.studentId}|${target.id}`;evidence.set(key,[...(evidence.get(key)??[]),{snapshot:s,version,published:p}]);
    } catch { /* Invalid or legacy publication is unresolved, never zero. */ }
  }
  const rows=enrollments.map(e=>{
    const r=rowFor(e),t=targets.find(t=>t.className===e.className&&t.section===(e.section??""))!;
    const candidates=evidence.get(`${e.studentId}|${t.id}`)??[];
    if(candidates.length!==1)return {...r,explanation:candidates.length?"Multiple issued sources need reconciliation.":"No unique current issued governed result. Legacy, draft, withheld and unpublished results are not classified."};
    const {snapshot:s,version:v,published:p}=candidates[0];
    if(!s.percentage.isFinite() || s.percentage.lt(0) || s.percentage.gt(100) || s.totalMaximum.lte(0) || p.content.papers.some(paper=>paper.components.some(c=>c.state==="NOT_ENTERED")))return {...r,explanation:"Incomplete or invalid authoritative result."};
    return {...r,name:p.student.name,admission:p.student.admissionNumber,metric:s.percentage.toNumber(),numerator:s.totalObtained.toNumber(),denominator:s.totalMaximum.toNumber(),classification:decimalMatches(s.percentage,q)?"MEETS" as const:"DOES_NOT_MEET" as const,state:"ISSUED / LOCKED",source:p.publicationReference,revision:digest([s.inputFingerprint,v.snapshotJson]),explanation:`${s.formulaVersion}; ${s.roundingPolicyVersion}. PRESENT zero retained; ABSENT, EXEMPT and NOT_APPLICABLE follow the issued scheme.`,href:`/report-cards/${encodeURIComponent(v.reportCard.id)}`};
  });
  return {rows,definition:"Authoritative Decimal percentage from the current ISSUED governed report and matching LOCKED result snapshot. No averaging or draft/legacy marks calculation.",revisions:[digest(versions),digest(snapshots)]};
}

export function classifyAttendance(input:{eligible:number;present:number;recorded:number;unresolved:boolean},q:Pick<Query,"comparator"|"threshold">) {
  const complete=input.eligible>0&&!input.unresolved&&input.recorded===input.eligible;
  const metric=complete?new Prisma.Decimal(input.present).mul(100).div(input.eligible).toNumber():null;
  // Compare the rational numerator directly, avoiding floating point boundary drift.
  const comparison=new Prisma.Decimal(input.present).mul(100).comparedTo(new Prisma.Decimal(q.threshold).mul(input.eligible));
  const meets=q.comparator==="LT"?comparison<0:q.comparator==="LTE"?comparison<=0:q.comparator==="GT"?comparison>0:comparison>=0;
  return {metric,classification:metric===null?"UNRESOLVED" as const:meets?"MEETS" as const:"DOES_NOT_MEET" as const};
}
export async function attendanceRows(db:Client,q:Query,targets:Resolved,enrollments:Enrollment[],sourceKey?:string) {
  const from=new Date(q.from!),to=new Date(q.to!);
  const settings=await db.schoolSettings.findUnique({where:{id:"school"},select:{academicYear:true}});
  const days=bounded(await db.operationalCalendarDay.findMany({where:{dayDate:{gte:from,lte:to},calendarVersion:{academicYear:q.academicYear,status:"PUBLISHED",currentPublicationKey:{not:null},OR:[{effectiveScope:"SCHOOL_WIDE"},...targets.flatMap(t=>[{effectiveScope:"CLASS",className:t.className},{effectiveScope:"CLASS_SECTION",className:t.className,section:t.section}])]},OR:[{scopeType:"SCHOOL_WIDE"},...targets.flatMap(t=>[{scopeType:"CLASS",className:t.className},{scopeType:"CLASS_SECTION",className:t.className,section:t.section}])]},select:{publicKey:true,dayDate:true,dayType:true,scopeType:true,className:true,section:true,calendarVersion:{select:{publicKey:true,versionNumber:true,currentPublicationKey:true,status:true,effectiveScope:true,className:true,section:true,attendanceReconciliationRequired:true}}},take:20001}),20000,"Calendar days");
  const sessions=bounded(await db.studentAttendanceSession.findMany({where:{academicYear:q.academicYear,attendanceDate:{gte:from,lte:to},OR:targets.map(t=>({className:t.className,section:t.section}))},select:{id:true,attendanceDate:true,className:true,section:true,status:true,updatedAt:true,operationalCalendarVersionKey:true,operationalCalendarDayKey:true,records:{where:{studentId:{in:enrollments.map(e=>e.studentId)}},select:{studentId:true,status:true},take:MAX_COHORT+1}},take:15001}),15000,"Attendance sessions");
  for(const session of sessions)bounded(session.records,MAX_COHORT,"Attendance records");
  const transfers=bounded(await db.studentLifecycleEvent.findMany({where:{studentId:{in:enrollments.map(e=>e.studentId)},effectiveDate:{gte:from,lte:to}},select:{studentId:true,eventType:true,fromClass:true,fromSection:true,toClass:true,toSection:true,effectiveDate:true},take:4001}),4000,"Lifecycle events");
  const byDate=new Map<string,typeof days>();
  for(const day of days){const date=day.dayDate.toISOString().slice(0,10);const group=byDate.get(date);if(group)group.push(day);else byDate.set(date,[day]);}
  const calendars=new Map<string,Map<string,typeof days[number]>>();
  for(const t of targets) {
    const map=new Map<string,typeof days[number]>();
    for(let at=from.getTime();at<=to.getTime();at+=86400000){
      const date=new Date(at).toISOString().slice(0,10);
      const candidates=(byDate.get(date)??[]).filter(d=>(d.calendarVersion.effectiveScope==="SCHOOL_WIDE"||(d.calendarVersion.className===t.className&&(d.calendarVersion.effectiveScope==="CLASS"||d.calendarVersion.section===t.section)))&&(d.scopeType==="SCHOOL_WIDE"||(d.className===t.className&&(d.scopeType==="CLASS"||d.section===t.section))));
      const priority=(s:string)=>s==="CLASS_SECTION"?3:s==="CLASS"?2:1;
      candidates.sort((a,b)=>priority(b.scopeType)-priority(a.scopeType)||b.calendarVersion.versionNumber-a.calendarVersion.versionNumber);
      if(!candidates.length)throw new ReportError("Published calendar coverage is missing for the selected dates. This is not a completed attendance report.","CALENDAR_UNAVAILABLE",409);
      if(candidates.length>1&&priority(candidates[0].scopeType)===priority(candidates[1].scopeType)&&candidates[0].calendarVersion.versionNumber===candidates[1].calendarVersion.versionNumber)throw new ReportError("Calendar scope is ambiguous.","CALENDAR_UNAVAILABLE",409);
      map.set(date,candidates[0]);
    }calendars.set(t.id,map);
  }
  const sessionMap=new Map(sessions.map(s=>[`${s.className}|${s.section}|${s.attendanceDate.toISOString().slice(0,10)}`,{...s,byStudent:new Map(s.records.map(r=>[r.studentId,r.status]))}]));
  const transferDates=new Map<string,string[]>();
  for(const event of transfers)if(event.fromClass&&event.toClass&&(event.fromClass!==event.toClass||event.fromSection!==event.toSection)){
    const date=event.effectiveDate.toISOString().slice(0,10),group=transferDates.get(event.studentId);if(group)group.push(date);else transferDates.set(event.studentId,[date]);
  }
  // Hash bounded inputs once, never once per pupil. No private source cache survives this request.
  const revisions=[sourceDigest(days),sourceDigest(sessions),sourceDigest(transfers)];
  let attendance:AttendanceEvidence|undefined;
  const rows=enrollments.map(e=>{
    const r=rowFor(e),t=targets.find(t=>t.className===e.className&&t.section===(e.section??""))!;
    let eligible=0,present=0,recorded=0,uncertain=!e.enrollmentDate;
    const intervalReasons:AttendanceReason[]=[],selected=sourceKey===r.key;
    if(!e.enrollmentDate)intervalReasons.push("UNKNOWN_ADMISSION");
    if(transferDates.has(e.studentId)){uncertain=true;intervalReasons.push("TRANSFER_HISTORY");}
    const dates:AttendanceDateEvidence[]=[],coverage=Object.fromEntries(ATTENDANCE_BUCKETS.map(bucket=>[bucket,0])) as AttendanceEvidence["coverage"];
    const start=e.enrollmentDate?.toISOString().slice(0,10),exit=e.exitDate?.toISOString().slice(0,10);
    for(const [date,day] of calendars.get(t.id)!) {
      const session=sessionMap.get(`${e.className}|${e.section??""}|${date}`),status=session?.byStudent.get(e.studentId);
      const reasons:AttendanceReason[]=[];
      let bucket:AttendanceDateEvidence["bucket"],eligibility:AttendanceDateEvidence["eligibility"]="ELIGIBLE_FULL_DAY",numerator:0|1=0,denominator:0|1=0,record:0|1=0;
      if(day.calendarVersion.attendanceReconciliationRequired){uncertain=true;reasons.push("PENDING_RECONCILIATION");}
      if(start&&date<start||exit&&date>=exit){bucket="OUTSIDE_ENROLLMENT";eligibility=bucket;if(start&&date<start)reasons.push("BEFORE_ENROLLMENT");if(exit&&date>=exit)reasons.push("ON_OR_AFTER_EXIT");}
      else if(["NON_WORKING_DAY","VACATION_DAY","EMERGENCY_CLOSURE"].includes(day.dayType)){bucket="EXCLUDED_CALENDAR";eligibility=bucket;reasons.push(day.dayType as AttendanceReason);}
      else if(!["WORKING_DAY","SPECIAL_WORKING_DAY"].includes(day.dayType)){bucket="UNSUPPORTED_DAY";eligibility=bucket;uncertain=true;reasons.push(bucket);}
      else {
        denominator=1;
        if(!session){bucket="MISSING_SESSION";reasons.push(bucket);}
        else if(session.status!=="LOCKED"){bucket="SESSION_NOT_LOCKED";reasons.push(bucket);}
        else if(!status){bucket="MISSING_RECORD";reasons.push(bucket);}
        else {
          record=1;
          if(session.operationalCalendarVersionKey!==day.calendarVersion.publicKey||session.operationalCalendarDayKey!==day.publicKey){uncertain=true;reasons.push("CALENDAR_BASIS_MISMATCH");}
          if(status==="PRESENT"){numerator=1;bucket="COUNTED_PRESENT";}
          else if(status==="ABSENT")bucket="COUNTED_ABSENT";
          else {bucket="UNSUPPORTED_STATUS";uncertain=true;reasons.push(bucket);}
        }
      }
      eligible+=denominator;present+=numerator;recorded+=record;
      if(selected){coverage[bucket]++;dates.push({date,calendar:{scope:day.scopeType,type:day.dayType,publicationReference:day.calendarVersion.publicKey,version:day.calendarVersion.versionNumber,dayReference:day.publicKey},eligibility,session:!session?"MISSING":["DRAFT","SUBMITTED","LOCKED"].includes(session.status)?session.status as AttendanceDateEvidence["session"]:"UNSUPPORTED",record:status?"PRESENT":"MISSING",status:!status?null:["PRESENT","ABSENT","LATE","HALF_DAY","EXCUSED"].includes(status)?status as AttendanceDateEvidence["status"]:"UNSUPPORTED",numerator,denominator,recorded:record,bucket,reasons});}
    }
    const classified=classifyAttendance({eligible,present,recorded,unresolved:uncertain},q);
    if(selected){if(!eligible)intervalReasons.push("ZERO_ELIGIBLE_DAYS");attendance={academicYear:q.academicYear,className:e.className,section:e.section??"",from:q.from!,to:q.to!,criterion:{comparator:q.comparator,threshold:q.threshold},state:!eligible?"NO_ELIGIBLE_DAYS":classified.metric===null?"INCOMPLETE":"COMPLETE",numerator:present,denominator:eligible,recorded,percentage:classified.metric,coverage,totalDates:dates.length,intervalReasons,transferDates:[...new Set(transferDates.get(e.studentId)??[])].sort(),dates};}
    return {...r,...classified,...(settings?.academicYear===q.academicYear?{href:`/attendance/students/reports?${new URLSearchParams({from:q.from!,to:q.to!,scope:`${e.className}|${e.section??""}`})}`} : {}),numerator:present,denominator:eligible,state:classified.metric===null?"INCOMPLETE":"LOCKED",source:`Calendar and locked attendance ${q.from}–${q.to}`,revision:digest([t.id,revisions,e]),explanation:`${recorded}/${eligible} eligible full days recorded. ${uncertain?"Admission date, transfer, calendar reconciliation or partial-status policy needs resolution. ":""}Missing records are not absence; zero eligible days is unresolved.`};
  });
  return {rows,attendance,definition:"PRESENT / eligible full working days within enrolment dates (exit date excluded); complete LOCKED records required. Partial days/statuses and transfers require policy evidence; no attendance eligibility claim.",revisions};
}

export const paise=(value:number)=>{const result=Math.round((value+Number.EPSILON)*100);if(!Number.isFinite(value)||!Number.isSafeInteger(result)||value<0)throw new ReportError("Invalid financial source amount.","FINANCE_UNRESOLVED",409);return result;};
export async function feeRows(db:Client,q:Query,targets:Resolved,enrollments:Enrollment[],now:Date) {
  const settings=await db.schoolSettings.findUnique({where:{id:"school"},select:{academicYear:true}});
  if(!settings||settings.academicYear!==q.academicYear)throw new ReportError("Only the configured current-year balance is supported. Payment sources cannot reconstruct historical academic-year balances.","HISTORICAL_BALANCE_UNSUPPORTED",409);
  const fees=bounded(await db.feeStructure.findMany({where:{academicYear:q.academicYear,className:{in:targets.map(t=>t.className)},active:true},select:{id:true,className:true,termAmount:true,term1Month:true,term2Month:true,term3Month:true,term4Month:true,updatedAt:true},take:41}),40,"Fee schedules");
  const payments=bounded(await db.payment.findMany({where:{admissionNo:{in:enrollments.map(e=>e.student.admissionNo)},deletedAt:null},select:{id:true,receiptNo:true,studentId:true,admissionNo:true,amountPaid:true,feeType:true,date:true,isCancelled:true,deletedAt:true,updatedAt:true,familyAllocationId:true,familyCollectionId:true,familyInstrumentId:true,familyShareId:true},take:30001}),30000,"Payment components");
  const allocations=bounded(await db.familyStudentAllocation.findMany({where:{studentId:{in:enrollments.map(e=>e.studentId)}},select:{id:true,studentId:true,academicYear:true,installment:true,feeHead:true,amountPaise:true,collection:{select:{id:true,status:true,collectionDate:true,version:true}}},orderBy:{id:"asc"},take:30001}),30000,"Family allocations");
  const siblings=bounded(await db.payment.findMany({where:{receiptNo:{in:[...new Set(payments.map(p=>p.receiptNo))]},deletedAt:null},select:{id:true,receiptNo:true,amountPaid:true,isCancelled:true,deletedAt:true,updatedAt:true},take:40001}),40000,"Receipt integrity components");
  const grouped=new Map<string,typeof siblings>();for(const p of siblings)grouped.set(p.receiptNo,[...(grouped.get(p.receiptNo)??[]),p]);
  const states=new Map([...grouped].map(([key,rows])=>[key,effectiveReceiptState(rows).status]));
  const rows=enrollments.map(e=>{
    const r=rowFor(e),fee=fees.find(f=>f.className===e.className),selected=payments.filter(p=>p.admissionNo===e.student.admissionNo);
    if(!fee||e.student.academicYear!==q.academicYear||e.student.className!==e.className)return {...r,explanation:"Missing fee schedule or historical class context cannot be reconstructed."};
    if(selected.some(p=>([p.familyAllocationId,p.familyCollectionId,p.familyInstrumentId,p.familyShareId].some(Boolean)&&![p.familyAllocationId,p.familyCollectionId,p.familyInstrumentId,p.familyShareId].every(Boolean))||p.studentId!==e.studentId||p.date>now||states.get(p.receiptNo)==="INCONSISTENT"))return {...r,state:"UNRECONCILED",explanation:"Payment identity, future date or receipt reversal state requires reconciliation; no balance classified."};
    if(![fee.term1Month,fee.term2Month,fee.term3Month,fee.term4Month].every(Boolean))return {...r,explanation:"Exact due-month configuration is missing."};
    for(const p of selected)paise(p.amountPaid);paise(fee.termAmount);
    const family=allocations.filter(a=>a.studentId===e.studentId);
    const liveFamily=family.filter(a=>a.collection.status==="ISSUED");
    if(liveFamily.some(a=>a.collection.collectionDate>now||a.feeHead!=="TUITION"||!/^Term [1-4]$/.test(a.installment)||!Number.isSafeInteger(a.amountPaise)||a.amountPaise<0||selected.filter(p=>p.familyAllocationId===a.id&&p.familyCollectionId===a.collection.id&&p.feeType==="Current Year Fee"&&states.get(p.receiptNo)==="ACTIVE").reduce((n,p)=>n+paise(p.amountPaid),0)!==a.amountPaise)||selected.some(p=>p.familyAllocationId&&states.get(p.receiptNo)==="ACTIVE"&&!liveFamily.some(a=>a.id===p.familyAllocationId)))return {...r,state:"UNRECONCILED",explanation:"Family allocation, compatibility component or reversal requires reconciliation; no balance classified."};
    const start=new Date(`${q.academicYear.slice(0,4)}-04-01T00:00:00Z`),end=new Date(`${Number(q.academicYear.slice(0,4))+1}-04-01T00:00:00Z`);
    const active=selected.filter(p=>!p.familyAllocationId&&states.get(p.receiptNo)==="ACTIVE"&&p.date>=start&&p.date<end);
    const a=allocateFees({academicYear:q.academicYear,admissionNo:r.admission,studentName:r.name,className:e.className,studentType:e.student.studentType,discountPercent:e.student.discountPercent},fee,active,now),term=a.terms[q.term!-1];
    const liability=paise(a.perTermFee),explicitPaid=liveFamily.filter(a=>a.academicYear===q.academicYear&&a.installment===`Term ${q.term}`).reduce((n,a)=>n+a.amountPaise,0),paid=paise(term.paid)+explicitPaid,due=liability-paid;
    const familyLiability=Math.round(fee.termAmount*(1-a.effectiveDiscountPercent/100)*100);
    if(liveFamily.some(v=>v.academicYear===q.academicYear)&&familyLiability!==liability)return {...r,state:"UNRECONCILED",explanation:"The existing legacy and family engines disagree on discounted term rounding. No new rounding policy is applied."};
    if(!Number.isSafeInteger(paid)||due<0)return {...r,state:"UNRECONCILED",explanation:"Explicit term allocations exceed the supported current liability; reconciliation is required."};
    if(paid+due!==liability)throw new ReportError("Term balance did not reconcile.","FINANCE_UNRESOLVED",409);
    const old=paise(a.oldDuesCollected),credit=paise(a.overpayment);
    return {...r,metric:due,numerator:paid,denominator:liability,classification:due>0?"MEETS" as const:"DOES_NOT_MEET" as const,state:due===0?"SETTLED":dueDateForMonth(term.dueMonth,q.academicYear)<=now?"OVERDUE":"NOT_YET_DUE",href:`/ledger?q=${encodeURIComponent(r.admission)}`,source:`Fee schedule ${fee.id}; Term ${q.term}; due ${dueDateForMonth(term.dueMonth,q.academicYear).toISOString().slice(0,10)}`,revision:digest([fee,selected,family,e.student.discountPercent,e.student.studentType]),explanation:`Current balance in paise. Cumulative dated legacy receipts plus exact issued family term allocations and student discount. Old Due collections ${old} paise excluded; student overpayment ${credit} paise remains separate. Unallocated family credit is not assigned. Prior-year concessions/reversals do not reduce current-term liability.`};
  });
  return {rows,definition:"Current tuition term balance in integer paise: allocateFees supplies liability and dated legacy allocation; issued family allocations retain their exact year/term under the existing family-collection contract. Compatibility components verify allocations but are not added again. Family masters and Old Due are not added. No historical as-of reconstruction.",revisions:[digest(fees),digest(payments),digest(siblings),digest(allocations)]};
}
