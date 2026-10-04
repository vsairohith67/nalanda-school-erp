import {it,expect} from 'vitest';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {mkdtempSync,openSync,closeSync,writeFileSync,readFileSync,existsSync,fsyncSync} from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {evidenceFixture,harnessConnection} from '../scripts/laptop-lab/consumer-test-support';
import {executeConsumer,loadConsumerProfile} from '../scripts/laptop-lab/consumer-connection';
import {localRuntimeSubject,loadLocalAuthorization} from '../scripts/laptop-lab/consumer-authorization';
import {profileHash} from '../scripts/laptop-lab/consumer-profile';
import {resolveLocalRuntimeAuthorization,assertLocalRuntimeDecision,runtimeSubjectIdentity,type RuntimeRegistration} from '../scripts/portable/local-runtime-authorization';
import {verifyArtifactEvidence,assertRuntimeAdmission,hashBytes} from '../scripts/portable/artifact-handoff';
const workspace=process.cwd(),token=()=>randomUUID().replaceAll('-','');
function key(now:number){const pair=generateKeyPairSync('ed25519');return {pair,registration:{id:hashBytes(pair.publicKey.export({type:'spki',format:'der'})),algorithm:'Ed25519' as const,publicKey:pair.publicKey.export({type:'spki',format:'pem'}).toString(),notBefore:now-1000,notAfter:now+3600000,revoked:false}};}
const envelope=(payload:unknown,k:ReturnType<typeof key>)=>{const bytes=Buffer.from(JSON.stringify(payload));return Buffer.from(JSON.stringify({payload:bytes.toString('base64url'),signature:sign(null,bytes,k.pair.privateKey).toString('base64url')}));};
function fixture(){
 const f=evidenceFixture(workspace,token()),r=verifyArtifactEvidence(f.files,{source:f.profile.producer.source,architecture:'amd64',runId:'123',attempt:'1',now:f.now,inputs:f.inputs,baseImages:f.baseImages});
 const authority=key(f.now),attestor=key(f.now),subject=localRuntimeSubject(f.profile,r);
 const registration:RuntimeRegistration={contract:'NALANDA_LOCAL_RUNTIME_TRUST_V1',namespace:'HARNESS_ONLY',generation:1,validUntil:f.now+3600000,ownerApproval:'https://review.invalid/synthetic',custodyApproval:'https://review.invalid/synthetic-custody',authority:authority.registration,attestor:attestor.registration,host:{dockerSha256:'1'.repeat(64),composeSha256:'2'.repeat(64),configurationSha256:'3'.repeat(64)},custody:{directory:'C:\\SYNTHETIC-CUSTODY',userSid:'S-1-5-21-100-200-300-400',volumeSerial:'ABCDEF12',kind:'WINDOWS_NTFS_LOCAL_V1'}};
 const endorsementPayload={contract:'NALANDA_LOCAL_ARTIFACT_ENDORSEMENT_V1',namespace:'HARNESS_ONLY',generation:1,attestorId:attestor.registration.id,operation:'ENDORSE_LOCAL_SYNTHETIC_ARTIFACT',issuedAt:f.now,expiresAt:f.now+60000,producerSource:subject.producerSource,producerTree:subject.producerTree,producerRunId:subject.producerRunId,producerAttempt:subject.producerAttempt,architecture:subject.architecture,evidenceSha256:subject.evidenceSha256,receiptSha256:subject.receiptSha256};
 const endorsement=envelope(endorsementPayload,attestor);
 const payload={contract:'NALANDA_LOCAL_RUNTIME_AUTHORIZATION_V1',namespace:'HARNESS_ONLY',generation:1,authorityId:authority.registration.id,operation:'LOCAL_SYNTHETIC_LAB',issuedAt:f.now,expiresAt:f.now+60000,subjectSha256:runtimeSubjectIdentity(subject),endorsementSha256:hashBytes(endorsement),maxDurationMs:60000};
 const authorization=envelope(payload,authority);
 const resolve=()=>resolveLocalRuntimeAuthorization(registration,endorsement,authorization,subject,r,f.now,'HARNESS_ONLY');
 return {...f,r,subject,registration,authority,attestor,endorsementPayload,endorsement,payload,authorization,resolve};
}
it('pure cryptographic path requires both genuine signatures and a branded raw-evidence receipt',()=>{
 const f=fixture(),d=f.resolve();expect(d.classification).toBe('HARNESS_ONLY');assertLocalRuntimeDecision(f.r,d,f.now,'HARNESS_ONLY');
 expect(()=>assertLocalRuntimeDecision(f.r,{...d},f.now,'HARNESS_ONLY')).toThrow('EXTERNAL_RUNTIME_BLOCKED');
 expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,f.authorization,f.subject,{...f.r},f.now,'HARNESS_ONLY')).toThrow('ARTIFACT_VERIFIER_RECEIPT_REQUIRED');
});
it.each(['authority','attestor'] as const)('rejects revoked, expired, future or substituted %s',role=>{
 for(const change of [(k:any)=>k.revoked=true,(k:any)=>k.notAfter=0,(k:any)=>k.notBefore=Number.MAX_SAFE_INTEGER,(k:any)=>k.publicKey=key(0).registration.publicKey]){const f=fixture();change(f.registration[role]);expect(f.resolve).toThrow();}
});
it.each(['ACQUIRE_DEPENDENCIES_ONLY','BUILD_SCAN_ONLY_NOT_ADMITTED','GENERIC_RUNTIME'])('rejects correctly signed wrong-purpose grant %s',operation=>{
 const f=fixture();expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,envelope({...f.payload,operation},f.authority),f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow('LOCAL_RUNTIME_AUTHORIZATION_SCOPE');
});
it.each(['generation','authorityId','expiresAt','issuedAt','subjectSha256','endorsementSha256','maxDurationMs'])('rejects altered signed grant field %s',field=>{
 const f=fixture(),p:any={...f.payload};p[field]=field==='generation'?2:field==='expiresAt'?f.now:field==='issuedAt'?f.now+1:field==='maxDurationMs'?3600001:'0'.repeat(64);
 expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,envelope(p,f.authority),f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow();
});
it.each(['producerTree','evidenceSha256','receiptSha256','producerRunId'])('rejects wrong attested producer %s',field=>{
 const f=fixture();expect(()=>resolveLocalRuntimeAuthorization(f.registration,envelope({...f.endorsementPayload,[field]:'0'.repeat(64)},f.attestor),f.authorization,f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow();
});
it('rejects envelope-selected authority, malformed signature and duplicate-key payload',()=>{
 const f=fixture(),e=JSON.parse(f.authorization.toString());expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,Buffer.from(JSON.stringify({...e,publicKey:f.authority.registration.publicKey})),f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow();
 expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,envelope(f.payload,key(f.now)),f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow('LOCAL_AUTHORIZATION_SIGNATURE');
 const payload=Buffer.from('{"contract":"one","contract":"two"}');const duplicate=Buffer.from(JSON.stringify({payload:payload.toString('base64url'),signature:sign(null,payload,f.authority.pair.privateKey).toString('base64url')}));
 expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,duplicate,f.subject,f.r,f.now,'HARNESS_ONLY')).toThrow();
});
it.each(['endpoint','origin','operations','cpu','memoryBytes','workspace','outputName','codeSha256'])('complete profile identity invalidates authorization on %s change',field=>{
 const f=fixture(),p=structuredClone(f.profile);const target=field in p.consumer?p.consumer:p.scope;(target as any)[field]=field==='cpu'?2:field==='memoryBytes'?2**30:field==='operations'?['certificate_request']:'changed';
 const subject={...f.subject,profileSha256:profileHash(p)};
 expect(()=>resolveLocalRuntimeAuthorization(f.registration,f.endorsement,f.authorization,subject,f.r,f.now,'HARNESS_ONLY')).toThrow('LOCAL_RUNTIME_AUTHORIZATION_SUBJECT');
});
it('preserves hosted/default refusal, rejects fixture promotion and production loader stays null',()=>{
 const f=fixture(),d=f.resolve();expect(()=>assertRuntimeAdmission(f.r,d)).toThrow('HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME');
 expect(()=>assertLocalRuntimeDecision(f.r,d,f.now)).toThrow('LOCAL_RUNTIME_DECISION_SUBSTITUTED');
 expect(()=>resolveLocalRuntimeAuthorization({...f.registration,namespace:'PRODUCTION'},f.endorsement,f.authorization,f.subject,f.r,f.now)).toThrow('HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME');
 expect(()=>loadLocalAuthorization(f.profile,f.r)).toThrow('LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');
 expect(JSON.parse(readFileSync('scripts/portable/local-runtime-trust-registration.json','utf8'))).toBeNull();
});
it('caller supplied production registration and relabeled fixture evidence cannot mint production admission',()=>{
 const f=fixture(),p=JSON.parse(f.files['provenance.json'].toString());p.classification='HOSTED_EXACT_IMAGE_EVIDENCE';f.files['provenance.json']=Buffer.from(JSON.stringify(p));f.profile.producer.provenanceSha256=hashBytes(f.files['provenance.json']);
 const r=verifyArtifactEvidence(f.files,{source:f.profile.producer.source,architecture:'amd64',runId:'123',attempt:'1',now:f.now,inputs:f.inputs,baseImages:f.baseImages}),subject=localRuntimeSubject(f.profile,r);
 const e=envelope({...f.endorsementPayload,namespace:'PRODUCTION',evidenceSha256:subject.evidenceSha256,receiptSha256:subject.receiptSha256},f.attestor);
 const a=envelope({...f.payload,namespace:'PRODUCTION',subjectSha256:runtimeSubjectIdentity(subject),endorsementSha256:hashBytes(e)},f.authority);
 const pure=resolveLocalRuntimeAuthorization({...f.registration,namespace:'PRODUCTION'},e,a,subject,r,f.now);
 expect(()=>assertRuntimeAdmission(r,pure)).toThrow('EXTERNAL_RUNTIME_BLOCKED');expect(()=>assertRuntimeAdmission(r,{purpose:'LOCAL_SYNTHETIC_LAB'})).toThrow('EXTERNAL_RUNTIME_BLOCKED');
});
it('rechecks immutable decision inputs, receipt and validity before effects',()=>{
 for(const mutate of [(f:ReturnType<typeof fixture>)=>f.registration.generation++,(f:ReturnType<typeof fixture>)=>f.subject.profileSha256='0'.repeat(64),(f:ReturnType<typeof fixture>)=>f.authorization[1]=0,(f:ReturnType<typeof fixture>)=>f.r.inputs['Dockerfile']='0'.repeat(64)]){const f=fixture(),d=f.resolve();mutate(f);expect(()=>assertLocalRuntimeDecision(f.r,d,f.now,'HARNESS_ONLY')).toThrow();}
 const f=fixture(),d=f.resolve();expect(()=>assertLocalRuntimeDecision(f.r,d,f.now+60000,'HARNESS_ONLY')).toThrow();
});
// Controlled local files prove CreateNew replay semantics only, not Windows
// ACL/volume/power-loss/recovery qualification. No fixture keys leave memory.
function connect(f:ReturnType<typeof fixture>,root:string){
 const h=harnessConnection(f),original=h.ports.lifecycle;
 h.ports.authorize=(p,r)=>{
  const d=resolveLocalRuntimeAuthorization(f.registration,f.endorsement,f.authorization,localRuntimeSubject(p,r),r,f.now,'HARNESS_ONLY');
  return {decision:d,guard:()=>assertLocalRuntimeDecision(r,d,f.now,'HARNESS_ONLY'),claim:()=>{const fd=openSync(path.join(root,d.claimKey),'wx');try{writeFileSync(fd,d.authorizationSha256);fsyncSync(fd);}finally{closeSync(fd);}}};
 };
 h.ports.admission=(r,d)=>assertLocalRuntimeDecision(r,d,f.now,'HARNESS_ONLY');
 h.ports.lifecycle=(...args)=>original(...args);return h;
}
it('separately signed HARNESS_ONLY authorization reaches existing lifecycle and reports through ordinary selector',async()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-claim-')),h=connect(f,root);
 const result=await executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports);
 expect(result.state).toBe('COMPLETE');expect(result.classification).toBe('HARNESS_ONLY');expect(result.erpExecuted).toBe(false);expect(h.calls).toContain('create');expect(existsSync(path.join(root,f.resolve().claimKey))).toBe(true);
},30000);
it('concurrent duplicate semantic claims admit at most one lifecycle and retain the burned receipt',async()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-race-')),h=connect(f,root);
 const results=await Promise.allSettled([executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports),executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports)]);
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);expect(h.calls.filter(x=>x==='create')).toHaveLength(1);
},30000);
it('valid artifact without grant, or grant without qualifying raw evidence, refuses before lifecycle',async()=>{
 const f=fixture(),h=harnessConnection(f);h.ports.authorize=()=>{throw Error('LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');};
 await expect(executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports)).rejects.toThrow('LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');expect(h.calls).toEqual([]);
 const root=mkdtempSync(path.join(workspace,'tmp','a4-invalid-')),signed=connect(f,root);f.files['native.json']=Buffer.from('{}');
 await expect(executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,signed.ports)).rejects.toThrow();expect(signed.calls).toEqual([]);
});
it('blocking authorization guards cannot outlive signed duration before the first effect',async()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-duration-')),h=connect(f,root);let elapsed=0;h.ports.monotonic=()=>elapsed;
 const authorize=h.ports.authorize;h.ports.authorize=(p,r)=>{const a=authorize(p,r)!;return {...a,guard:()=>{a.guard();elapsed+=61000;}};};
 await expect(executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports)).rejects.toThrow('LOCAL_AUTHORIZATION_STALE');expect(h.calls).toEqual([]);
});
it('failed lifecycle retains consumed authorization and never turns partial results into completed measurement',async()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-failure-')),h=connect(f,root);h.ports.lifecycle=()=>({resolve:async()=>{throw Error('LOCAL_TEST_REFUSAL');},reserve:async()=>{},prepare:async()=>{},launch:async()=>{},bind:async()=>null,cleanup:async()=>'RETAINED',record:async()=>{}});
 const result=await executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports);expect(result.state).toBe('INCOMPLETE');expect(result.erpExecuted).toBe(false);expect(existsSync(path.join(root,f.resolve().claimKey))).toBe(true);
 await expect(executeConsumer(f.profile,workspace,profileHash(f.profile),undefined,h.ports)).rejects.toThrow();
});
it('profile-file replacement after load refuses before lifecycle even with valid signed in-process inputs',async()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-profile-')),file=path.join(root,'profile.json');writeFileSync(file,JSON.stringify(f.profile));const p=loadConsumerProfile(file,workspace);writeFileSync(file,JSON.stringify({...f.profile,scope:{...f.profile.scope,cpu:2}}));const h=connect(f,root);
 await expect(executeConsumer(p,workspace,profileHash(p),undefined,h.ports)).rejects.toThrow('LOCAL_PROFILE_FILE_CHANGED');expect(h.calls).toEqual([]);
});
it('ordinary CLI absent producer inputs refuses and forged environment cannot enable execution',()=>{
 const f=fixture(),root=mkdtempSync(path.join(workspace,'tmp','a4-cli-')),file=path.join(root,'profile.json');f.profile.producer.runId=null;writeFileSync(file,JSON.stringify(f.profile));
 // Only this refusal fixture models a local child. Hosted identity must not
 // silently change its baseline; the explicit negative still exercises it.
 const environment={...process.env};for(const name of ['GITHUB_ACTIONS','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','RUNNER_ENVIRONMENT','PORTABLE_CI_EXCEPTION','DOCKER_HOST','DOCKER_CONTEXT'])delete environment[name];
 const run=(extra:Record<string,string>)=>spawnSync(process.execPath,['scripts/laptop-lab/cli.mjs','runtime','--profile',file,'--expected-profile',profileHash(f.profile)],{cwd:workspace,env:{...environment,...extra},encoding:'utf8',windowsHide:true,stdio:'pipe',timeout:20000});
 for(const [extra,reason] of [[{},'PRODUCER_RAW_CI_EVIDENCE_REQUIRED'],[{GITHUB_ACTIONS:'true'},'LOCAL_CI_IDENTITY_REFUSED']] as const){const result=run(extra);expect(result.error).toBeUndefined();expect(result.status).toBe(1);expect(result.stdout).toBe('');expect(result.stderr).toContain(reason);expect(existsSync(path.join(workspace,'scripts/laptop-lab/outputs',f.profile.consumer.outputName))).toBe(false);}
});
