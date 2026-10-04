import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync,realpathSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {boundedJson} from '../portable/product-input-contract';
import {hashBytes,artifactEvidenceIdentity} from '../portable/artifact-handoff';
import {resolveLocalRuntimeAuthorization,assertLocalRuntimeDecision,receiptIdentity,type RuntimeRegistration,type RuntimeSubject,type RuntimeDecision} from '../portable/local-runtime-authorization';
import {profileHash,canonicalDirectory,validateConsumerProfile} from './consumer-profile';
import type {ConsumerProfile,ArtifactReceipt} from './consumer-types';
import {registeredLocalHost,type LocalHost} from './consumer-host';

export type LocalAuthorization={decision:RuntimeDecision;admission?:object;host?:LocalHost;guard():void;claim():void};
// Pure cryptographic results are NOT production authority. Only the fixed
// committed-registration loader below can mint this in-process capability.
const admissions=new WeakMap<object,{receipt:ArtifactReceipt;guard:()=>void}>();
export function assertProductionLocalAdmission(receipt:ArtifactReceipt,value:unknown){
 assert(value&&typeof value==='object'&&admissions.has(value),'EXTERNAL_RUNTIME_BLOCKED');
 const proof=admissions.get(value)!;assert(proof.receipt===receipt,'LOCAL_RUNTIME_DECISION_SUBSTITUTED');proof.guard();
}
export function localRuntimeSubject(p:ConsumerProfile,r:ArtifactReceipt):RuntimeSubject{
 return {producerSource:p.producer.source,producerTree:p.producer.tree,producerRunId:p.producer.runId!,producerAttempt:p.producer.attempt!,architecture:p.producer.architecture,evidenceSha256:artifactEvidenceIdentity(r),receiptSha256:receiptIdentity(r),profileSha256:profileHash(p),consumerRunId:p.consumer.runId};
}
function bytes(file:string,max:number){
 const s=lstatSync(file);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=max&&realpathSync(file).toLowerCase()===file.toLowerCase(),'LOCAL_AUTHORIZATION_FILE_UNSAFE');
 const b=readFileSync(file),after=lstatSync(file);assert(s.ino===after.ino&&s.mtimeMs===after.mtimeMs&&s.ctimeMs===after.ctimeMs&&b.length===s.size,'LOCAL_AUTHORIZATION_FILE_CHANGED');return b;
}
/** Fixed source-bound registration and registered custody, never profile/env
 * selected trust. The current null registration refuses before a custody probe. */
export function loadLocalAuthorization(p:ConsumerProfile,receipt:ArtifactReceipt):LocalAuthorization{
 assert.equal(p.consumer.workspace,path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),'LOCAL_AUTHORITY_WORKSPACE_MISMATCH');
 validateConsumerProfile(p,p.consumer.workspace);
 const relative='scripts/portable/local-runtime-trust-registration.json',file=path.join(p.consumer.workspace,relative);
 const registeredBytes=bytes(file,16384),registration=boundedJson(registeredBytes,16384) as RuntimeRegistration|null;
 assert(registration!==null,'LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');
 const committed=execFileSync('git',['--no-optional-locks','show','HEAD:'+relative],{cwd:p.consumer.workspace,maxBuffer:16384,timeout:5000,stdio:['ignore','pipe','pipe']});
 assert.equal(registeredBytes.toString().replaceAll('\r\n','\n'),committed.toString().replaceAll('\r\n','\n'),'LOCAL_RUNTIME_REGISTRATION_CHANGED');
 assert(process.platform==='win32'&&process.arch==='x64','LOCAL_CUSTODY_PLATFORM_UNPROVEN');
 canonicalDirectory(registration.custody.directory);
 const authorizationName='authorization-'+p.consumer.runId+'.json',endorsementName='endorsement-'+p.producer.runId+'-'+p.producer.attempt+'.json';
 const authorizationPath=path.join(registration.custody.directory,authorizationName),endorsementPath=path.join(registration.custody.directory,endorsementName);
 const authorization=bytes(authorizationPath,32768),endorsement=bytes(endorsementPath,32768),subject=localRuntimeSubject(p,receipt);
 const fileIdentities=[file,authorizationPath,endorsementPath].map(name=>({name,stat:lstatSync(name)}));
 const decision=resolveLocalRuntimeAuthorization(registration,endorsement,authorization,subject,receipt,Date.now());
 const host=registeredLocalHost(registration.custody.directory,registration.host);
 const helper=path.join(p.consumer.workspace,'scripts/laptop-lab/consumer-custody.ps1'),helperHash=hashBytes(bytes(helper,16384));
 let claimed=false;
 const custody=(operation:'inspect'|'claim'|'verify')=>{
  assert.equal(hashBytes(bytes(helper,16384)),helperHash,'LOCAL_CUSTODY_HELPER_CHANGED');
  const request={operation,custody:registration.custody,claimKey:decision.claimKey,authorizationSha256:decision.authorizationSha256,authorizationName,endorsementName};
  let result:Buffer;try{result=execFileSync('C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',['-NoProfile','-NonInteractive','-File',helper],{input:JSON.stringify(request),cwd:p.consumer.workspace,timeout:15000,maxBuffer:16384,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{NODE_ENV:'production',SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows',PATH:'C:\\Windows\\System32',PSModulePath:'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\Modules'}});}catch{throw Error('LOCAL_CUSTODY_REFUSED');}
  const v=boundedJson(result,16384);assert(v.contract==='NALANDA_LOCAL_CUSTODY_CHECK_V1'&&v.operation===operation&&v.claimKey===decision.claimKey&&v.authorizationSha256===decision.authorizationSha256,'LOCAL_CUSTODY_RECEIPT_MISMATCH');
 };
 const guard=()=>{
  for(const {name,stat} of fileIdentities){const current=lstatSync(name);assert(current.ino===stat.ino&&current.mtimeMs===stat.mtimeMs&&current.ctimeMs===stat.ctimeMs,'LOCAL_AUTHORIZATION_FILE_CHANGED');}
  assert.equal(hashBytes(bytes(file,16384)),hashBytes(registeredBytes),'LOCAL_RUNTIME_REGISTRATION_CHANGED');
  assert.equal(hashBytes(bytes(authorizationPath,32768)),hashBytes(authorization),'LOCAL_AUTHORIZATION_CHANGED');
  assert.equal(hashBytes(bytes(endorsementPath,32768)),hashBytes(endorsement),'LOCAL_ENDORSEMENT_CHANGED');
  assert.equal(profileHash(p),subject.profileSha256,'LOCAL_PROFILE_IDENTITY_MISMATCH');
  assertLocalRuntimeDecision(receipt,decision,Date.now());custody(claimed?'verify':'inspect');host.guard();assertLocalRuntimeDecision(receipt,decision,Date.now());
 };
 guard();
 const admission=Object.freeze({purpose:'LOCAL_SYNTHETIC_LAB'});admissions.set(admission,{receipt,guard});
 return {decision,admission,host,guard,claim:()=>{assert(!claimed,'LOCAL_AUTHORIZATION_REPLAY');guard();custody('claim');claimed=true;guard();}};
}
