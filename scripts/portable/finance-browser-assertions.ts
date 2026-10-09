import assert from "node:assert/strict";
import {assertEventDelta} from "./http-assertions";
import {parseCsv} from "../../lib/marks-import-csv";

export const FINANCE_BROWSER_SCENARIOS=Object.freeze([
 "FB1-student-item-sale-validation", "FB2-rate-history-receipt-print",
 "FB3-previous-year-source-preparation", "FB4-independent-relief-reversal",
 "FB5-stale-retry-sponsorship", "FB6-restricted-income-denied-authority",
 "FB7-modal-responsive-offline-refusal"
]);
export type FinanceState={scope:string;studentId:string;academicYear:string;students:any[];enrollments:any[];fees:any[];currentYear:{annual:string;paid:string;remaining:string};payments:any[];receipts:any[];liabilities:any[];cases:any[];events:any[];attributions:any[];income:any[];cash:any[];cashDays:any[];rates:any[];balances:any[]};
// Constant diagnostics: private readbacks never become public assertion output.
export function financeSame(a:unknown,b:unknown){assert(JSON.stringify(a)===JSON.stringify(b),"FINANCE_UNEXPECTED_EFFECT");}
export function cents(value:unknown){const s=String(value);assert(/^\d+(?:\.\d{1,2})?$/.test(s),"FINANCE_AMOUNT_FORMAT");const [whole,fraction=""]=s.split(".");return BigInt(whole)*100n+BigInt(fraction.padEnd(2,"0"));}
export function assertFinanceScope(s:FinanceState,scope:string,studentId:string){
 assert(s.scope===scope&&s.studentId===studentId&&s.academicYear==="2026-27","FINANCE_TARGET_MISMATCH");
 const students=s.students.map(r=>r.id),liabilities=s.liabilities.map(r=>r.id),cases=s.cases.map(r=>r.id);
 assert(students.includes(studentId)&&s.students.every(r=>r.admissionNo.startsWith(scope)),"FINANCE_FOREIGN_STUDENT");
 for(const r of [...s.receipts,...s.payments,...s.enrollments,...s.liabilities])assert(students.includes(r.studentId),"FINANCE_FOREIGN_EFFECT");
 for(const r of s.receipts)assert(r.academicYear===s.academicYear,"FINANCE_RECEIPT_YEAR");
 for(const r of s.liabilities)assert(r.operatingYear===s.academicYear&&r.sourceYear==="2025-26","FINANCE_SOURCE_YEAR");
 for(const r of [...s.cases,...s.events,...s.attributions])assert(liabilities.includes(r.liabilityId),"FINANCE_FOREIGN_LIABILITY");
 for(const r of [...s.income,...s.events.filter(r=>r.caseId)])assert(cases.includes(r.caseId),"FINANCE_FOREIGN_CASE");
 for(const rows of [s.students,s.payments,s.receipts,s.liabilities,s.cases,s.events,s.income,s.attributions,s.cash,s.cashDays])assert(new Set(rows.map(r=>r.id)).size===rows.length,"FINANCE_DUPLICATE_EFFECT");
}
export function assertFinanceUnchanged(before:FinanceState,after:FinanceState){assertFinanceScope(after,before.scope,before.studentId);financeSame(after,before);}
export function assertSale(before:FinanceState,after:FinanceState,expected:{actor:string;studentId:string;itemId:string;rateId:string;rate:string;quantity:number;total:string;date:string}){
 assertFinanceScope(after,before.scope,before.studentId);assert(after.receipts.length===before.receipts.length+1,"FINANCE_RECEIPT_CARDINALITY");
 for(const r of before.receipts)financeSame(r,after.receipts.find(a=>a.id===r.id));
 const added=after.receipts.filter(r=>!before.receipts.some(b=>b.id===r.id));assert(added.length===1,"FINANCE_DUPLICATE_SALE");const r=added[0];
 assert(r.createdByUserId===expected.actor&&r.studentId===expected.studentId&&r.academicYear==="2026-27"&&r.status==="ACTIVE"&&r.paymentMethod==="CASH"&&r.receivedAccount==="CASH_COUNTER","FINANCE_RECEIPT_IDENTITY");
 assert(r.receiptDate.slice(0,10)===expected.date&&r.lines.length===1,"FINANCE_RECEIPT_DATE_LINES");const l=r.lines[0];
 assert(l.itemId===expected.itemId&&l.rateId===expected.rateId&&l.quantity===expected.quantity&&cents(l.unitAmount)===cents(expected.rate)&&cents(l.lineTotal)===cents(expected.total),"FINANCE_RECEIPT_LINE");
 assert(cents(l.discountAmount)===0n&&cents(r.discountAmount)===0n&&cents(r.netAmount)===cents(expected.total)&&cents(r.grossAmount)===cents(expected.total)&&cents(expected.rate)*BigInt(expected.quantity)===cents(expected.total),"FINANCE_RECEIPT_AMOUNT");
 const snap=r.studentSnapshot,student=after.students.find(s=>s.id===expected.studentId);assert(snap&&student,"FINANCE_SNAPSHOT_MISSING");
 for(const key of ["studentId","academicYear"])assert(snap[key]===r[key],"FINANCE_SNAPSHOT_SCOPE");for(const key of ["admissionNo","studentName","className","section"])assert(snap[key]===student[key],"FINANCE_SNAPSHOT_IDENTITY");
 const lines=JSON.parse(snap.linesJson);assert(lines.length===1&&lines[0].itemId===expected.itemId&&lines[0].rateId===expected.rateId&&lines[0].quantity===expected.quantity&&cents(lines[0].unitAmount)===cents(expected.rate)&&cents(lines[0].amount)===cents(expected.total),"FINANCE_FROZEN_LINE");
 // A cash misc-income receipt is the cash effect. No fee Payment or concession
 // is invented; the Cash Book derives this receipt through its existing path.
 for(const key of Object.keys(before) as (keyof FinanceState)[])if(key!=="receipts")financeSame(before[key],after[key]);return r;
}
const transitions:Record<string,[string,string|null,string|null]>={
 PREPARE_LIABILITY:["ATTRIBUTION_PROPOSED",null,"SOURCE_YEAR_UNVERIFIED"],VERIFY:["ATTRIBUTION_VERIFIED",null,"VERIFIED"],PREPARE:["CASE_PREPARED",null,"DRAFT"],INCOME:["INCOME_SUPPORT_UPDATED",null,"DRAFT"],SUBMIT:["CASE_SUBMITTED","DRAFT","SUBMITTED"],REVIEW:["CASE_UNDER_REVIEW","SUBMITTED","UNDER_REVIEW"],APPROVE:["CASE_APPROVED","UNDER_REVIEW","APPROVED"],APPLY:["RELIEF_APPLIED","APPROVED","APPLIED"],REVIEW_REVERSAL:["REVERSAL_REVIEWED",null,null],REVERSE:["RELIEF_REVERSED","APPLIED","REVERSED"],PROPOSE_PAYMENT:["PAYMENT_ATTRIBUTION_PROPOSED",null,null],VERIFY_PAYMENT:["ACTUAL_PAYMENT_ATTRIBUTED",null,null]
};
export function assertFinanceDecision(before:FinanceState,after:FinanceState,action:string,actor:string,request:any,result:any){
 assertFinanceScope(after,before.scope,before.studentId);const rule=transitions[action];assert(rule&&request.action===action&&typeof request.requestKey==="string","FINANCE_DECISION_CONTRACT");
 const previous=before.cases.find(c=>c.id===request.caseId),caseId=previous?.id??(action==="PREPARE"?result.caseId:null),liabilityId=action==="PREPARE_LIABILITY"?result.liabilityId:previous?.liabilityId??request.liabilityId;
 if(previous)assert(request.expectedVersion===previous.version,"FINANCE_STALE_CASE_REQUEST");
 assertEventDelta(before.events,after.events,[{id:result.eventId,actorId:actor,caseId,liabilityId,requestKey:request.requestKey,eventType:rule[0],previousState:rule[1],newState:rule[2]}]);
 const event=after.events.find(e=>e.id===result.eventId);assert(event&&/^[a-f0-9]{64}$/.test(event.requestHash),"FINANCE_REQUEST_HASH");
 const changed=new Set<keyof FinanceState>(["events"]);
 if(action==="PREPARE_LIABILITY"){
  changed.add("liabilities");changed.add("balances");assert(after.liabilities.length===before.liabilities.length+1,"FINANCE_LIABILITY_COUNT");const l=after.liabilities.find(l=>l.id===liabilityId);assert(l&&l.studentId===request.studentId&&l.preparerId===actor&&l.status==="SOURCE_YEAR_UNVERIFIED"&&l.version===1&&cents(l.openingAmount)===100000n&&cents(l.existingCredits)===5000n,"FINANCE_LIABILITY_PREPARATION");
 }else if(action==="VERIFY"||action==="VERIFY_PAYMENT"){
  changed.add("liabilities");changed.add("attributions");changed.add("balances");const b=before.liabilities.find(l=>l.id===liabilityId),a=after.liabilities.find(l=>l.id===liabilityId);assert(b&&a&&a.version===b.version+1&&a.status==="VERIFIED","FINANCE_VERIFICATION");
  if(action==="VERIFY")assert(a.verifierId===actor&&a.verifiedAt&&a.preparerId!==actor,"FINANCE_VERIFIER_IDENTITY");
  const newLinks=after.attributions.filter(l=>!before.attributions.some(b=>b.id===l.id));const ids=action==="VERIFY"?request.paymentIds:[event.referenceId];assert(newLinks.length===ids.length,"FINANCE_ATTRIBUTION_COUNT");for(const link of newLinks)assert(ids.includes(link.paymentId)&&link.reviewedById===actor&&link.recordedById!==actor&&link.sourceYear==="2025-26","FINANCE_ATTRIBUTION_ACTOR");
 }else if(action==="PREPARE"){
  changed.add("cases");assert(after.cases.length===before.cases.length+1,"FINANCE_CASE_COUNT");const c=after.cases.find(c=>c.id===caseId);assert(c&&c.preparerId===actor&&c.kind===request.kind&&c.status==="DRAFT"&&c.version===1&&cents(c.requestedAmount)===cents(request.requestedAmount),"FINANCE_PREPARED_CASE");
 }else if(action==="INCOME"){
  changed.add("income");changed.add("cases");const c=after.cases.find(c=>c.id===caseId),i=after.income.find(i=>i.caseId===caseId);assert(c&&previous&&c.version===previous.version+1&&c.status===previous.status&&i&&i.status===request.income.status&&i.recordedById===actor,"FINANCE_INCOME_UPDATE");assert(i.exactAnnualAmount===(request.income.exactAnnualAmount??null),"FINANCE_INCOME_VALUE");assert(i.encrypted===(request.income.exactAnnualAmount!=null),"FINANCE_INCOME_ENCRYPTION");
 }else if(!["REVIEW_REVERSAL","PROPOSE_PAYMENT"].includes(action)){
  changed.add("cases");const c=after.cases.find(c=>c.id===caseId);assert(previous&&c&&previous.status===rule[1]&&c.status===rule[2]&&c.version===previous.version+1,"FINANCE_CASE_TRANSITION");
  if(action==="REVIEW")assert(c.reviewerId===actor&&c.preparerId!==actor,"FINANCE_REVIEW_ACTOR");
  if(action==="APPROVE")assert(c.approverId===actor&&c.preparerId!==actor&&c.reviewerId!==actor&&c.reviewerId!==c.preparerId&&cents(c.approvedAmount)===cents(request.approvedAmount),"FINANCE_APPROVAL_ACTOR_AMOUNT");
  if(action==="APPLY"||action==="REVERSE"){
   changed.add("liabilities");changed.add("balances");assert(cents(event.amount)===cents(previous.approvedAmount),"FINANCE_RELIEF_AMOUNT");const b=before.balances.find(r=>r.liabilityId===liabilityId),a=after.balances.find(r=>r.liabilityId===liabilityId);assert(b?.status==="VERIFIED"&&a?.status==="VERIFIED","FINANCE_BALANCE_REQUIRED");assert(cents(a.remaining)===cents(b.remaining)+(action==="APPLY"?-1n:1n)*cents(event.amount),"FINANCE_RECONCILIATION");
   if(action==="APPLY")assert(actor!==previous.approverId&&event.reversesEventId===null,"FINANCE_SEPARATE_APPLICATION");
   else {const original=before.events.filter(e=>e.caseId===caseId&&e.eventType==="RELIEF_APPLIED");assert(original.length===1&&event.reversesEventId===original[0].id,"FINANCE_REVERSAL_LINK");}
  }
 }
 if(previous){const current=after.cases.find(c=>c.id===caseId);assert(current,"FINANCE_CASE_DISAPPEARED");for(const key of ["id","liabilityId","kind","requestedAmount","preparerId","applicantReference","reason","scopeJson","validFrom","validTo"])financeSame(current[key],previous[key]);}
 if(["PREPARE","APPROVE","REVIEW_REVERSAL","APPLY","REVERSE"].includes(action))assert(cents(event.amount)===cents(action==="PREPARE"?request.requestedAmount:action==="APPROVE"?request.approvedAmount:previous?.approvedAmount),"FINANCE_AUDIT_AMOUNT");
 for(const key of ["cases","liabilities","income","attributions"] as const)if(changed.has(key))for(const row of before[key])if((key==="cases"||key==="income")?(key==="income"?row.caseId:row.id)!==caseId:key==="liabilities"?row.id!==liabilityId:true)financeSame(row,after[key].find(a=>a.id===row.id));
 for(const key of Object.keys(before) as (keyof FinanceState)[])if(!changed.has(key))financeSame(before[key],after[key]);
}
export function assertFinanceRead(before:FinanceState,after:FinanceState,actor:string,caseId:string,kinds:string[]){
 assertFinanceScope(after,before.scope,before.studentId);const c=before.cases.find(c=>c.id===caseId);assert(c,"FINANCE_READ_TARGET");assertEventDelta(before.events,after.events,kinds.map(eventType=>({actorId:actor,caseId,liabilityId:c.liabilityId,eventType,previousState:null,newState:null})));for(const key of Object.keys(before) as (keyof FinanceState)[])if(key!=="events")financeSame(before[key],after[key]);
}
export function assertIncomePrivacy(text:string,sentinels:string[]){assert(sentinels.every(v=>v.length>0&&!text.includes(v)),"FINANCE_PRIVATE_DISCLOSURE");}
export function assertFinanceCsv(bytes:Buffer,expected:{caseId:string;studentId:string;status:string;requested:string;approved:string;remaining:string;includeIncome:boolean;incomeCanary:string}){
 assert(bytes.length>0&&bytes.length<=128*1024,"FINANCE_CSV_BOUND");const text=bytes.toString("utf8");assertIncomePrivacy(text,[expected.incomeCanary,"exactAmountEnvelope","Exact annual INR"]);const rows=parseCsv(text);
 financeSame(rows,[ ["Case","Student reference","Source year","Operating year","Status","Requested","Approved","Previous-year remaining",...(expected.includeIncome?["Income status","Annual income band"]:[])], [expected.caseId,expected.studentId,"2025-26","2026-27",expected.status,expected.requested,expected.approved,expected.remaining,...(expected.includeIncome?["PROVIDED","SYNTHETIC_ONLY"]:[])] ]);
}
