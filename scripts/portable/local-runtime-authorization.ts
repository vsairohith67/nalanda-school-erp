import {verify} from 'node:crypto';
import {boundedJson,requireInput as check} from './product-input-contract';
import {nativeObject} from './native-artifact';
import {verifyRegisteredEd25519Key} from './product-trust-policy';
import {hashBytes,assertVerifiedArtifactReceipt,artifactEvidenceIdentity,type verifyArtifactEvidence} from './artifact-handoff';

type Key=Parameters<typeof verifyRegisteredEd25519Key>[0];
export type RuntimeRegistration={contract:'NALANDA_LOCAL_RUNTIME_TRUST_V1';namespace:'PRODUCTION'|'HARNESS_ONLY';generation:number;validUntil:number;ownerApproval:string;custodyApproval:string;authority:Key;attestor:Key;host:{dockerSha256:string;composeSha256:string;configurationSha256:string};custody:{directory:string;userSid:string;volumeSerial:string;kind:'WINDOWS_NTFS_LOCAL_V1'}};
export type RuntimeSubject={producerSource:string;producerTree:string;producerRunId:string;producerAttempt:string;architecture:'amd64';evidenceSha256:string;receiptSha256:string;profileSha256:string;consumerRunId:string};
export type RuntimeDecision=Readonly<{classification:'PRODUCTION'|'HARNESS_ONLY';expiresAt:number;maxDurationMs:number;profileSha256:string;authorizationSha256:string;claimKey:string}>;
type Receipt=ReturnType<typeof verifyArtifactEvidence>;
const decisions=new WeakMap<RuntimeDecision,{receipt:Receipt;receiptHash:string;guard:(now:number)=>void}>();
const hex=/^[a-f0-9]{64}$/;
export const receiptIdentity=(r:Receipt)=>hashBytes(JSON.stringify(r));
export const runtimeSubjectIdentity=(s:RuntimeSubject)=>hashBytes(JSON.stringify(s));
function signed(bytes:Buffer,key:ReturnType<typeof verifyRegisteredEd25519Key>){
 const envelope=boundedJson(bytes,32768);nativeObject(envelope,['payload','signature']);
 check(typeof envelope.payload==='string'&&/^[A-Za-z0-9_-]+$/.test(envelope.payload)&&typeof envelope.signature==='string'&&/^[A-Za-z0-9_-]{86}$/.test(envelope.signature),'LOCAL_AUTHORIZATION_ENVELOPE');
 const payload=Buffer.from(envelope.payload,'base64url'),signature=Buffer.from(envelope.signature,'base64url');
 check(payload.toString('base64url')===envelope.payload&&signature.toString('base64url')===envelope.signature&&verify(null,payload,key,signature),'LOCAL_AUTHORIZATION_SIGNATURE');
 return boundedJson(payload,24576);
}
function interval(a:any,r:RuntimeRegistration,k:Key,now:number){
 check(Number.isSafeInteger(a.issuedAt)&&Number.isSafeInteger(a.expiresAt)&&a.issuedAt>=k.notBefore&&a.issuedAt<=now&&now<a.expiresAt&&a.expiresAt-a.issuedAt<=6*3600000&&a.expiresAt<=r.validUntil&&a.expiresAt<=k.notAfter,'LOCAL_AUTHORIZATION_STALE');
}
/** Pure verifier. HARNESS_ONLY is available only to explicit in-process test
 * ports; neither the disk loader nor the ordinary CLI can choose that mode. */
export function resolveLocalRuntimeAuthorization(registration:unknown,endorsement:Buffer,authorization:Buffer,subject:RuntimeSubject,receipt:Receipt,now:number,classification:'PRODUCTION'|'HARNESS_ONLY'='PRODUCTION'):RuntimeDecision{
 check(registration!==null,'LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');
 const r=registration as RuntimeRegistration;
 nativeObject(r,['contract','namespace','generation','validUntil','ownerApproval','custodyApproval','authority','attestor','host','custody']);
 nativeObject(r.host,['dockerSha256','composeSha256','configurationSha256']);for(const value of Object.values(r.host))check(hex.test(value),'LOCAL_HOST_PIN_INVALID');
 check(r.contract==='NALANDA_LOCAL_RUNTIME_TRUST_V1'&&r.namespace===classification&&Number.isSafeInteger(now)&&Number.isSafeInteger(r.generation)&&r.generation>0&&Number.isSafeInteger(r.validUntil)&&now<r.validUntil,'LOCAL_RUNTIME_REGISTRATION_INVALID');
 for(const ref of [r.ownerApproval,r.custodyApproval])check(typeof ref==='string'&&/^https:\/\/[^\s]{1,500}$/.test(ref),'LOCAL_APPROVAL_REFERENCE_REQUIRED');
 nativeObject(r.custody,['directory','userSid','volumeSerial','kind']);
 check(r.custody.kind==='WINDOWS_NTFS_LOCAL_V1'&&typeof r.custody.directory==='string'&&/^[A-Z]:\\[^\x00-\x1f]{1,220}$/.test(r.custody.directory)&&/^S-1-5-21-(?:\d+-){3}\d+$/.test(r.custody.userSid)&&/^[A-F0-9]{8}$/.test(r.custody.volumeSerial),'LOCAL_CUSTODY_REGISTRATION_INVALID');
 const authority=verifyRegisteredEd25519Key(r.authority,now),attestor=verifyRegisteredEd25519Key(r.attestor,now);
 check(r.authority.id!==r.attestor.id,'LOCAL_KEY_ROLE_COLLISION');
 nativeObject(subject,['producerSource','producerTree','producerRunId','producerAttempt','architecture','evidenceSha256','receiptSha256','profileSha256','consumerRunId']);
 check(/^[a-f0-9]{40}$/.test(subject.producerSource)&&/^[a-f0-9]{40}$/.test(subject.producerTree)&&/^[1-9][0-9]{0,19}$/.test(subject.producerRunId)&&/^[1-9][0-9]{0,3}$/.test(subject.producerAttempt)&&subject.architecture==='amd64'&&/^[a-f0-9]{32}$/.test(subject.consumerRunId),'LOCAL_RUNTIME_SUBJECT_INVALID');
 for(const h of [subject.evidenceSha256,subject.receiptSha256,subject.profileSha256])check(hex.test(h),'LOCAL_RUNTIME_SUBJECT_INVALID');
 assertVerifiedArtifactReceipt(receipt,now);
 check(receipt.classification===(classification==='PRODUCTION'?'HOSTED_EXACT_IMAGE_EVIDENCE':'HARNESS_FIXTURE_ONLY'),'HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME');
 check(receipt.source===subject.producerSource&&receipt.architecture===subject.architecture&&receipt.runId===subject.producerRunId&&receipt.attempt===subject.producerAttempt&&receiptIdentity(receipt)===subject.receiptSha256&&artifactEvidenceIdentity(receipt)===subject.evidenceSha256,'LOCAL_ARTIFACT_SUBJECT_MISMATCH');
 const e=signed(endorsement,attestor);
 nativeObject(e,['contract','namespace','generation','attestorId','operation','issuedAt','expiresAt','producerSource','producerTree','producerRunId','producerAttempt','architecture','evidenceSha256','receiptSha256']);
 check(e.contract==='NALANDA_LOCAL_ARTIFACT_ENDORSEMENT_V1'&&e.operation==='ENDORSE_LOCAL_SYNTHETIC_ARTIFACT'&&e.namespace===classification&&e.generation===r.generation&&e.attestorId===r.attestor.id,'LOCAL_ARTIFACT_ENDORSEMENT_SCOPE');
 for(const field of ['producerSource','producerTree','producerRunId','producerAttempt','architecture','evidenceSha256','receiptSha256'] as const)check(e[field]===subject[field],'LOCAL_ARTIFACT_ENDORSEMENT_SUBJECT');
 interval(e,r,r.attestor,now);
 const a=signed(authorization,authority);
 nativeObject(a,['contract','namespace','generation','authorityId','operation','issuedAt','expiresAt','subjectSha256','endorsementSha256','maxDurationMs']);
 check(a.contract==='NALANDA_LOCAL_RUNTIME_AUTHORIZATION_V1'&&a.operation==='LOCAL_SYNTHETIC_LAB'&&a.namespace===classification&&a.generation===r.generation&&a.authorityId===r.authority.id,'LOCAL_RUNTIME_AUTHORIZATION_SCOPE');
 interval(a,r,r.authority,now);
 check(a.subjectSha256===runtimeSubjectIdentity(subject)&&a.endorsementSha256===hashBytes(endorsement),'LOCAL_RUNTIME_AUTHORIZATION_SUBJECT');
 check(Number.isSafeInteger(a.maxDurationMs)&&a.maxDurationMs>=100&&a.maxDurationMs<=3600000&&a.expiresAt<=e.expiresAt,'LOCAL_RUNTIME_DURATION_INVALID');
 const snapshots=[JSON.stringify(r),JSON.stringify(subject),hashBytes(endorsement),hashBytes(authorization)];
 const decision=Object.freeze({classification,expiresAt:a.expiresAt,maxDurationMs:a.maxDurationMs,profileSha256:subject.profileSha256,authorizationSha256:hashBytes(authorization),claimKey:hashBytes(JSON.stringify({domain:'NALANDA_LOCAL_RUNTIME_CLAIM_V1',authority:r.authority.id,generation:r.generation,consumerRunId:subject.consumerRunId}))});
 decisions.set(decision,{receipt,receiptHash:receiptIdentity(receipt),guard:time=>{
  check(snapshots[0]===JSON.stringify(r)&&snapshots[1]===JSON.stringify(subject)&&snapshots[2]===hashBytes(endorsement)&&snapshots[3]===hashBytes(authorization),'LOCAL_AUTHORIZATION_CHANGED');
  verifyRegisteredEd25519Key(r.authority,time);verifyRegisteredEd25519Key(r.attestor,time);interval(a,r,r.authority,time);interval(e,r,r.attestor,time);assertVerifiedArtifactReceipt(receipt,time);
 }});
 return decision;
}
export function assertLocalRuntimeDecision(receipt:Receipt,value:unknown,now:number,classification:'PRODUCTION'|'HARNESS_ONLY'='PRODUCTION'){
 const decision=value as RuntimeDecision;check(decision&&decisions.has(decision),'EXTERNAL_RUNTIME_BLOCKED');const verified=decisions.get(decision)!;
 check(decision.classification===classification&&verified.receipt===receipt&&verified.receiptHash===receiptIdentity(receipt),'LOCAL_RUNTIME_DECISION_SUBSTITUTED');verified.guard(now);
}
