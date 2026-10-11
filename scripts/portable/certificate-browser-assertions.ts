import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {assertEventDelta} from "./http-assertions";
import {GRADUATION_DISCLAIMER} from "../../lib/certificate-templates";

export type CertificateBrowserState={scope:string;studentId:string;academicYear:string;requests:any[];certificates:any[];charges:any[];receipts:any[];versions:any[];artifacts:any[];events:any[];payments:any[]};
export type CertificateBrowserAction="request"|"review"|"requestApprove"|"prepareCharge"|"approveCharge"|"collect"|"draft"|"submit"|"approve"|"issue"|"reissue"|"void"|"unchanged";
const hash=(value:Buffer|string)=>createHash("sha256").update(value).digest("hex");
const same=(a:unknown,b:unknown)=>assert.deepEqual(a,b,"CERTIFICATE_BROWSER_UNEXPECTED_EFFECT");
export function assertCertificateSnapshot(s:CertificateBrowserState,scope:string,studentId:string){
 assert.equal(s.scope,scope,"CERTIFICATE_BROWSER_SCOPE_MISMATCH");assert.equal(s.studentId,studentId,"CERTIFICATE_BROWSER_TARGET_MISMATCH");assert.equal(s.academicYear,"2026-27");
 for(const rows of [s.requests,s.certificates,s.charges,s.receipts])for(const row of rows){assert.equal(row.studentId,studentId);assert.equal(row.academicYear,s.academicYear);}
 const ids=s.certificates.map(c=>c.id),requests=s.requests.map(r=>r.id);
 for(const row of [...s.versions,...s.artifacts])assert(ids.includes(row.certificateId),"FOREIGN_CERTIFICATE_EFFECT");
 for(const row of s.events)assert(row.certificateId?ids.includes(row.certificateId):requests.includes(row.requestId),"FOREIGN_CERTIFICATE_EVENT");
 for(const key of ["requests","certificates","charges","receipts","versions","artifacts","events"] as const)assert.equal(new Set(s[key].map(r=>r.id)).size,s[key].length,"DUPLICATE_CERTIFICATE_EFFECT");
}
/** Raw state remains in private pipes/memory. Callers publish only scenario IDs.
 * Security/access metadata is deliberately separate from these domain rows. */
export function assertCertificateStep(before:CertificateBrowserState,after:CertificateBrowserState,operation:CertificateBrowserAction,actor:string,target?:string){
 assertCertificateSnapshot(after,before.scope,before.studentId);assertCertificateSnapshot(before,before.scope,before.studentId);
 if(operation==="unchanged"){same(after,before);return;}
 const changed=new Set<string>(["events"]),expected:any[]=[];
 const add=(key:"requests"|"certificates")=>{changed.add(key);assert.equal(after[key].length,before[key].length+1);for(const row of before[key])same(after[key].find(r=>r.id===row.id),row);const rows=after[key].filter(r=>!before[key].some(b=>b.id===r.id));assert.equal(rows.length,1);return rows[0];};
 const transition=(key:"requests"|"certificates",from:string,to:string,event:string,field:string)=>{
  changed.add(key);assert(target,"CERTIFICATE_TARGET_REQUIRED");assert.equal(after[key].length,before[key].length);
  const b=before[key].find(r=>r.id===target),a=after[key].find(r=>r.id===target);assert(b&&a);assert.equal(b.status,from);assert.equal(a.status,to);assert.equal(a[field],actor);
  for(const field of ["id","studentId","academicYear","certificateType","templateId","draftDataJson","createdByUserId","supersedesCertificateId","requestId","requestNumber","purpose"])same(a[field],b[field]);
  for(const row of before[key].filter(r=>r.id!==target))same(after[key].find(r=>r.id===row.id),row);
  expected.push({[key==="requests"?"requestId":"certificateId"]:target,eventType:event,previousStatus:from,newStatus:to,recordedByUserId:actor});return a;
 };
 if(operation==="request"){const row=add("requests");assert.equal(row.status,"SUBMITTED");assert.equal(row.createdByUserId,actor);expected.push({requestId:row.id,eventType:"REQUEST_CREATED",previousStatus:null,newStatus:"SUBMITTED",recordedByUserId:actor});}
 else if(operation==="review")transition("requests","SUBMITTED","UNDER_REVIEW","REQUEST_REVIEWED","reviewedByUserId");
 else if(operation==="requestApprove")transition("requests","UNDER_REVIEW","APPROVED","REQUEST_APPROVED","approvedByUserId");
 else if(["prepareCharge","approveCharge","collect"].includes(operation)){
  changed.add("charges");assert.equal(after.charges.length,1);const charge=after.charges[0];assert.equal(charge.requestId,target);const rate=JSON.parse(charge.snapshotJson);assert.equal(rate.amount,"125");assert.equal(rate.quantity,1);
  if(operation==="prepareCharge"){assert.equal(before.charges.length,0);assert.equal(charge.status,"PENDING_APPROVAL");assert.equal(charge.preparedBy,actor);assert.equal(charge.receiptId,null);}
  else{assert.equal(before.charges.length,1);same(rate,JSON.parse(before.charges[0].snapshotJson));assert.equal(charge.id,before.charges[0].id);
   if(operation==="approveCharge"){assert.equal(before.charges[0].status,"PENDING_APPROVAL");assert.equal(charge.status,"APPROVED");assert.equal(charge.approvedBy,actor);assert.notEqual(charge.preparedBy,actor);assert.equal(charge.receiptId,null);}
   else{changed.add("receipts");assert.equal(before.charges[0].status,"APPROVED");assert.equal(before.receipts.length,0);assert.equal(after.receipts.length,1);const r=after.receipts[0];assert.equal(charge.status,"PAID");assert.equal(charge.receiptId,r.id);assert.equal(r.createdByUserId,actor);assert.equal(r.netAmount,"125");assert.equal(r.lines.length,1);assert.equal(r.lines[0].quantity,1);assert.equal(r.lines[0].itemId,rate.itemId);}
  }
 }else if(operation==="draft"||operation==="reissue"){
  const row=add("certificates");assert.equal(row.status,"DRAFT");assert.equal(row.createdByUserId,actor);assert.equal(row.currentVersionNumber,0);assert.equal(row.certificateNumber,null);assert.equal(row.certificateType,"GRADUATION");
  if(operation==="draft")expected.push({certificateId:row.id,requestId:row.requestId,eventType:"CERTIFICATE_CREATED",previousStatus:null,newStatus:"DRAFT",recordedByUserId:actor});
  else{assert.equal(row.supersedesCertificateId,target);const original=before.certificates.find(r=>r.id===target);assert(original);assert.equal(row.requestId,original.requestId);assert.equal(row.templateId,original.templateId);}
 }else if(operation==="submit")transition("certificates","DRAFT","READY_FOR_REVIEW","CERTIFICATE_SUBMITTED","submittedByUserId");
 else if(operation==="approve")transition("certificates","READY_FOR_REVIEW","APPROVED","CERTIFICATE_APPROVED","approvedByUserId");
 else if(operation==="void")transition("certificates","ISSUED","CANCELLED","CERTIFICATE_CANCELLED","cancelledByUserId");
 else if(operation==="issue"){
  const row=transition("certificates","APPROVED","ISSUED","CERTIFICATE_ISSUED","issuedByUserId");assert.equal(row.currentVersionNumber,1);
  for(const key of ["versions","artifacts"] as const){changed.add(key);assert.equal(after[key].length,before[key].length+1);for(const prior of before[key])same(after[key].find(r=>r.id===prior.id),prior);}
  const versions=after.versions.filter(v=>v.certificateId===target),artifacts=after.artifacts.filter(v=>v.certificateId===target);assert.equal(versions.length,1);assert.equal(artifacts.length,1);
  const v=versions[0],a=artifacts[0];assert.equal(v.issuedByUserId,actor);assert.equal(v.versionNumber,1);assert.equal(a.versionId,v.id);assert.equal(hash(v.snapshotJson),a.snapshotHash);assert.equal(a.storedPdfHash,a.pdfHash);assert.equal(a.fontFamily,"Georgia Bold");assert(/^[a-f0-9]{64}$/.test(a.fontHash));
  const snapshot=JSON.parse(v.snapshotJson);assert.equal(snapshot.school.name.toUpperCase(),"NALANDA PUBLIC SCHOOL");assert(snapshot.template.definition.disclaimer.includes(GRADUATION_DISCLAIMER));assert.equal(snapshot.student.admissionNumber,before.scope);assert.equal(snapshot.currentEnrollment.academicYear,before.academicYear);assert.equal(snapshot.currentEnrollment.className,"X");
  expected[0].versionId=v.id;expected[0].requestId=row.requestId;
  changed.add("requests");assert.equal(after.requests.length,before.requests.length);for(const b of before.requests){const a=after.requests.find(r=>r.id===b.id);if(b.id===row.requestId){assert.equal(a.status,"COMPLETED");assert(["APPROVED","COMPLETED"].includes(b.status));}else same(a,b);}
 }
 assertEventDelta(before.events,after.events,expected);
 for(const key of ["requests","certificates","charges","receipts","versions","artifacts","payments"] as const)if(!changed.has(key))same(after[key],before[key]);
}
export function assertDocumentIdentity(bytes:Buffer,artifact:{pdfHash:string;fontFamily:string}){
 assert(bytes.length>0&&bytes.length<=16*1024*1024&&bytes.subarray(0,5).toString()==="%PDF-","CERTIFICATE_DOWNLOAD_INVALID");
 assert.equal(artifact.fontFamily,"Georgia Bold");assert.equal(hash(bytes),artifact.pdfHash,"CERTIFICATE_DOWNLOAD_CHANGED");
}
