import assert from 'node:assert/strict';
import {hashBytes} from '../portable/artifact-handoff';
import type {LabAdapter} from './consumer-types';

export type CertificateBinding={source:string;consumerRunId:string;containerId:string;databaseIdentitySha256:string;userId:string;username:string;studentId:string;academicYear:'2026-27';sessionId:string;sessionSecretSha256:string};
export type CertificateRow={id:string;studentId:string;academicYear:string;certificateType:string;purpose:string;requestedCopies:number;urgency:string;status:string;requestSource:string;createdByUserId:string;requestNumber:string;createdEvents:number};
export type CertificateSnapshot={contract:'NPS_CERTIFICATE_READBACK_V1';source:string;consumerRunId:string;containerId:string;databaseIdentitySha256:string;userId:string;studentId:string;sessionId:string;sessionState:'CURRENT_BOUND';rows:CertificateRow[]};
export type CertificatePorts={clock:LabAdapter['clock'];drive<T>(work:Promise<T>):Promise<T>;measurement:'CONTROLLED_TRANSPORT'|'BOUND_HTTP';
  rebind(signal:AbortSignal):Promise<void>;snapshot(signal:AbortSignal):Promise<unknown>;
  http(method:'GET'|'POST',route:'/api/certificates/requests',body:unknown,signal:AbortSignal):Promise<Response>};
const record=(value:unknown):Record<string,unknown>=>{assert(value&&typeof value==='object'&&!Array.isArray(value),'CERTIFICATE_OBJECT_REQUIRED');return value as Record<string,unknown>;};
const id=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(value);
export function validateCertificateBinding(b:CertificateBinding){
  assert(Object.keys(b).sort().join()==='academicYear,consumerRunId,containerId,databaseIdentitySha256,sessionId,sessionSecretSha256,source,studentId,userId,username','CERTIFICATE_BINDING_INVALID');
  assert(/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(b.sessionId)&&/^[a-f0-9]{64}$/.test(b.sessionSecretSha256),'CERTIFICATE_SESSION_BINDING_REQUIRED');
  assert(/^[a-f0-9]{40}$/.test(b.source)&&/^[a-f0-9]{32}$/.test(b.consumerRunId)&&/^[a-f0-9]{64}$/.test(b.containerId)&&/^[a-f0-9]{64}$/.test(b.databaseIdentitySha256),'CERTIFICATE_TARGET_IDENTITY_INVALID');
  assert(id(b.userId)&&id(b.studentId)&&/^synthetic-[A-Za-z0-9_-]{1,80}$/.test(b.username)&&b.academicYear==='2026-27','CERTIFICATE_FIXTURE_REQUIRED');
  return Object.freeze({...b});
}
export function validateCertificateSnapshot(raw:unknown,b:CertificateBinding):CertificateSnapshot{
  const s=record(raw);assert(s.contract==='NPS_CERTIFICATE_READBACK_V1','CERTIFICATE_READBACK_CONTRACT');
  for(const key of ['source','consumerRunId','containerId','databaseIdentitySha256','userId','studentId','sessionId'] as const)assert.equal(s[key],b[key],'CERTIFICATE_READBACK_IDENTITY_MISMATCH');
  assert(s.sessionState==='CURRENT_BOUND','CERTIFICATE_SESSION_NOT_CURRENT');
  assert(Array.isArray(s.rows)&&s.rows.length<=250,'CERTIFICATE_READBACK_BOUND');
  const rows:CertificateRow[]=s.rows.map(value=>{
    const r=record(value);assert(id(r.id)&&id(r.requestNumber)&&r.studentId===b.studentId&&r.createdByUserId===b.userId&&r.academicYear===b.academicYear&&r.requestSource==='INTERNAL','CERTIFICATE_ROW_SUBJECT_MISMATCH');
    assert(typeof r.certificateType==='string'&&['BONAFIDE','STUDY','CONDUCT','TRANSFER','GRADUATION'].includes(r.certificateType)&&typeof r.purpose==='string'&&r.purpose.length<=500&&typeof r.status==='string'&&['DRAFT','SUBMITTED','UNDER_REVIEW','APPROVED','REJECTED','CANCELLED'].includes(r.status),'CERTIFICATE_ROW_INVALID');
    assert(Number.isInteger(r.requestedCopies)&&Number(r.requestedCopies)>=1&&Number(r.requestedCopies)<=3&&['NORMAL','URGENT'].includes(String(r.urgency))&&Number.isInteger(r.createdEvents)&&Number(r.createdEvents)>=0,'CERTIFICATE_ROW_INVALID');
    return {id:String(r.id),studentId:b.studentId,academicYear:b.academicYear,certificateType:r.certificateType,purpose:r.purpose,requestedCopies:Number(r.requestedCopies),urgency:String(r.urgency),status:r.status,requestSource:'INTERNAL',createdByUserId:b.userId,requestNumber:String(r.requestNumber),createdEvents:Number(r.createdEvents)};
  });
  assert(new Set(rows.map(r=>r.id)).size===rows.length&&new Set(rows.map(r=>r.requestNumber)).size===rows.length,'CERTIFICATE_DUPLICATE_ROW');
  return {contract:'NPS_CERTIFICATE_READBACK_V1',source:b.source,consumerRunId:b.consumerRunId,containerId:b.containerId,databaseIdentitySha256:b.databaseIdentitySha256,userId:b.userId,studentId:b.studentId,sessionId:b.sessionId,sessionState:'CURRENT_BOUND',rows};
}
function matches(response:unknown,expected:CertificateRow){const row=record(response);return Object.entries(expected).filter(([k])=>k!=='createdEvents').every(([k,v])=>row[k]===v);}
const fingerprint=(rows:CertificateRow[])=>hashBytes(JSON.stringify([...rows].sort((a,b)=>a.id.localeCompare(b.id))));
export function createCertificateAdapter(input:CertificateBinding,ports:CertificatePorts):LabAdapter{
  const binding=validateCertificateBinding(input),expected=new Map<number,unknown>(),started=new Set<number>(),pending=new Set<Promise<unknown>>();
  const check=(signal:AbortSignal)=>assert(!signal.aborted,'CERTIFICATE_OPERATION_CANCELLED');
  const snapshot=async(signal:AbortSignal)=>{check(signal);await ports.rebind(signal);check(signal);const result=validateCertificateSnapshot(await ports.snapshot(signal),binding);check(signal);return result;};
  const operation=async({operation,ordinal,signal}:{operation:string;ordinal:number;signal:AbortSignal})=>{
    assert(['certificate_list','certificate_request'].includes(operation),'CERTIFICATE_SCENARIO_UNSUPPORTED');
    assert(Number.isSafeInteger(ordinal)&&ordinal>=0&&ordinal<250&&!started.has(ordinal),'CERTIFICATE_DUPLICATE_ACTION');started.add(ordinal);check(signal);
    const before=await snapshot(signal),purpose='SYNTHETIC NPS-LAPTOP:'+binding.consumerRunId+':'+ordinal;
    if(operation==='certificate_request')assert(!before.rows.some(r=>r.purpose===purpose),'CERTIFICATE_DUPLICATE_ACTION');
    const body=operation==='certificate_request'?{studentId:binding.studentId,academicYear:binding.academicYear,certificateType:'BONAFIDE',purpose,requestedCopies:1,urgency:'NORMAL'}:undefined;
    await ports.rebind(signal);check(signal);
    // Non-GRADUATION requests have no server idempotency key. Exactly one POST;
    // an uncertain/timeout action is never retried.
    const response=await ports.http(operation==='certificate_list'?'GET':'POST','/api/certificates/requests',body,signal);check(signal);
    const contentType=(response.headers.get('content-type')??'').split(';')[0].trim().toLowerCase();
    if([401,403].includes(response.status))return {status:response.status,contentType,body:{denied:true}};
    assert(!response.redirected&&response.status===(operation==='certificate_list'?200:201)&&contentType==='application/json','CERTIFICATE_HTTP_SEMANTICS');
    const bytes=await response.text();check(signal);assert(Buffer.byteLength(bytes)<=64*2**10,'CERTIFICATE_RESPONSE_BOUND');
    const result=record(JSON.parse(bytes));assert(!result.error&&!result.denied,'CERTIFICATE_HTTP_SEMANTICS');
    const after=await snapshot(signal);
    if(operation==='certificate_list'){
      assert(Array.isArray(result.requests)&&result.requests.length===after.rows.length,'CERTIFICATE_PARTIAL_LIST');
      assert(fingerprint(before.rows)===fingerprint(after.rows),'CERTIFICATE_READ_CHANGED');
      const rows=after.rows;assert(result.requests.every((r,i)=>matches(r,rows[i])),'CERTIFICATE_LIST_SEMANTICS');
      expected.set(ordinal,{ids:rows.map(r=>r.id)});return {status:200,contentType,body:result};
    }
    const row=record(result.request),effects=after.rows.filter(r=>r.purpose===purpose),saved=effects[0];
    assert(effects.length===1&&saved&&saved.id===row.id&&saved.status==='SUBMITTED'&&saved.certificateType==='BONAFIDE'&&saved.requestedCopies===1&&saved.urgency==='NORMAL'&&saved.createdEvents===1&&matches(row,saved),'CERTIFICATE_MUTATION_SEMANTICS');
    assert(after.rows.length===before.rows.length+1&&!before.rows.some(r=>r.id===saved.id)&&fingerprint(after.rows.filter(r=>r.id!==saved.id))===fingerprint(before.rows),'CERTIFICATE_DUPLICATE_OR_PARTIAL_EFFECT');
    expected.set(ordinal,{id:saved.id,studentId:binding.studentId});return {status:201,contentType,body:result,readback:{id:saved.id,status:saved.status,effectCount:effects.length}};
  };
  const {sessionId:_sessionId,sessionSecretSha256:_verifier,...subject}=binding;
  return {classification:'AUTHENTICATED_ERP',measurement:ports.measurement,binding:{source:binding.source,subjectSha256:hashBytes(JSON.stringify(subject))},clock:ports.clock,
    async drive(work){const result=await ports.drive(work);await Promise.allSettled([...pending]);return result;},
    transport(input){const work=operation(input);pending.add(work);void work.then(()=>pending.delete(work),()=>pending.delete(work));return work;},
    expected:(_op,n)=>{assert(expected.has(n),'CERTIFICATE_EXPECTATION_MISSING');return expected.get(n);},sample:()=>({}),owns:()=>true};
}
