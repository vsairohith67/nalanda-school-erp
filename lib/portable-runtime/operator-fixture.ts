import assert from "node:assert/strict";
import {parseAndValidateBackup} from "../restore";
import {recoveryHash} from "./recovery-handoff";

/** Genuine exporter output, never a relabelled backup or fabricated catalogue. */
export function validateOperatorFixture(bytes:Buffer,receipt:unknown,expected:{source:string;runId:string;attempt:string}){
 const r=receipt as Record<string,unknown>;
 assert(r&&r.contract==="NALANDA_OPERATOR_FIXTURE_V1"&&r.complete===true,"OPERATOR_FIXTURE_UNPROVEN");
 for(const key of ["source","runId","attempt"] as const)assert.equal(r[key],expected[key],"OPERATOR_FIXTURE_PROVENANCE");
 assert.equal(r.sha256,recoveryHash(bytes),"OPERATOR_FIXTURE_HASH");
 const raw=JSON.parse(bytes.toString());
 assert.equal(raw.metadata.backupVersion,48);assert.equal(raw.metadata.schemaContract,"NALANDA_RECOVERY_INTEGRATED:v48:certificates-concessions-items");
 const parsed=parseAndValidateBackup(bytes.toString());
 for(const key of ["students","payments","certificateTemplates","studentCertificates","studentCertificateVersions","certificateIssueArtifacts","certificateRequestCharges","studentItemReceiptSnapshots","priorYearLiabilities","priorYearPaymentAttributions","priorYearConcessionCases","priorYearIncomeSupports","priorYearConcessionEvents"]){
  assert(Array.isArray(raw[key])&&raw[key].length>0,"OPERATOR_FIXTURE_HISTORY_MISSING");
 }
 assert(raw.studentCertificates.some((r:any)=>r.status==="CANCELLED"));assert(raw.studentCertificates.some((r:any)=>r.supersedesCertificateId));
 for(const kind of ["RELIEF_APPLIED","RELIEF_REVERSED"])assert(raw.priorYearConcessionEvents.some((r:any)=>r.eventType===kind));
 return parsed;
}
