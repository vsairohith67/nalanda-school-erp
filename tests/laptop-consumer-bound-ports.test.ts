import {beforeEach,it,expect,vi} from 'vitest';
import {EventEmitter} from 'node:events';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {RequestOptions} from 'node:https';
import {certificateFixture} from '../scripts/laptop-lab/consumer-certificate-test-support';
import {boundCertificateAdapter,loadCertificateInputs} from '../scripts/laptop-lab/consumer-operation-ports';
import {stageConsumerInputs} from '../scripts/laptop-lab/consumer-inputs';
import {certificateSessionProbe} from '../scripts/laptop-lab/consumer-session';
import {evidenceFixture,harnessConnection} from '../scripts/laptop-lab/consumer-test-support';
import {executeConsumer} from '../scripts/laptop-lab/consumer-connection';
import {profileHash} from '../scripts/laptop-lab/consumer-profile';
import {hashBytes,verifyArtifactEvidence} from '../scripts/portable/artifact-handoff';
import {runConnectedScenario} from '../scripts/laptop-lab/consumer-runner.mjs';
import {reserveOutput} from '../scripts/laptop-lab/output.mjs';
const state=vi.hoisted(()=>({request:vi.fn()}));vi.mock('node:https',()=>({request:state.request}));
beforeEach(()=>vi.resetAllMocks());
async function setup(){
 const f=certificateFixture(),e=evidenceFixture(process.cwd(),f.binding.consumerRunId),p=e.profile;
 p.scope.scenario='disposable-mutation';p.scope.operations=['certificate_list','certificate_request'];f.binding.source=p.producer.source;f.binding.containerId=hashBytes('container:'+p.consumer.project+'-web-1');
 const cookie='__Host-nalanda_session=v1.'+f.binding.sessionId+'.'+'S'.repeat(43)+'.'+'T'.repeat(43);Object.assign(f.binding,await certificateSessionProbe(cookie));
 const root=path.join(process.cwd(),'tmp/laptop-lab','consumer-'+p.consumer.runId);mkdirSync(path.join(root,'secrets'),{recursive:true});
 const fixture={contract:'NALANDA_INTEGRATED_HTTP_FIXTURE_V1',source:p.producer.source,phase:'production-OFF',origin:p.scope.origin,username:f.binding.username,studentId:f.binding.studentId,templateId:'synthetic-template',requestId:'synthetic-request',assessmentId:'synthetic-assessment'};
 const operation={academicYear:'2026-27',consumerRunId:p.consumer.runId,cookie,databaseIdentitySha256:f.binding.databaseIdentitySha256,userId:f.binding.userId,fixture:{...fixture,containerId:f.binding.containerId}};
 const operands:Record<string,string>={'secrets/database_url':'invented test placeholder','secrets/proxy_shared_secret':'invented test placeholder','secrets/synthetic_director_password':'invented test placeholder','fixture-password':'P'.repeat(48)};
 for(const [file,value] of Object.entries(operands))writeFileSync(path.join(root,file),value,{flag:'wx'});
 const receipt=verifyArtifactEvidence(e.files,{source:p.producer.source,architecture:'amd64',runId:'123',attempt:'1',now:e.now,inputs:e.inputs,baseImages:e.baseImages});
 const manifest={contract:'NPS_LAPTOP_OPERANDS_V1',profileSha256:profileHash(p),producerSource:p.producer.source,producerRunId:'123',producerAttempt:'1',imageConfigDigest:receipt.imageConfigDigest,consumerRunId:p.consumer.runId,files:Object.entries(operands).map(([name,bytes])=>({name,sizeBytes:Buffer.byteLength(bytes),sha256:hashBytes(bytes)}))};
 writeFileSync(path.join(root,'manifest.json'),JSON.stringify(manifest),{flag:'wx'});return {f,e,p,root,operands,manifest,receipt,cookie,fixture,operation};
}
const ca='-----BEGIN CERTIFICATE-----\nSYNTHETIC CA operand\n-----END CERTIFICATE-----';
async function staged(s:Awaited<ReturnType<typeof setup>>){const root=await reserveOutput(s.p.consumer.outputName);stageConsumerInputs(s.p,s.receipt,root,['database_url','proxy_shared_secret','synthetic_director_password']);writeFileSync(path.join(root,'operation-inputs.json'),JSON.stringify(s.operation),{flag:'wx'});writeFileSync(path.join(root,'secrets/http_ca'),ca,{flag:'wx'});return root;}
function mockHttp(f:ReturnType<typeof certificateFixture>,kind='valid'){
 state.request.mockImplementation((options:RequestOptions,listener:(res:EventEmitter&{headers:Record<string,string|string[]>;statusCode:number})=>void)=>{
  expect(options.hostname).toBe('127.0.0.1');expect(options.servername).toBe('portable-staging.localhost');expect(options.port).toBe(8443);expect(options.rejectUnauthorized).toBe(true);expect(options.ca?.toString()).toBe(ca);
  const req=Object.assign(new EventEmitter(),{end:(bytes?:Buffer)=>{queueMicrotask(()=>{
   if(options.path==='/api/auth/login'){expect(options.headers).not.toHaveProperty('cookie');const input=JSON.parse(bytes!.toString());expect(input.identifier).toBe(f.binding.username);expect(input.password).toBe('P'.repeat(48));
    const res=Object.assign(new EventEmitter(),{headers:{'content-type':'application/json','set-cookie':['__Host-nalanda_session=v1.'+f.binding.sessionId+'.'+'S'.repeat(43)+'.'+'T'.repeat(43)+'; Secure; HttpOnly; SameSite=Strict; Path=/']},statusCode:kind==='mfa'?202:200});listener(res);res.emit('data',Buffer.from(JSON.stringify(kind==='mfa'?{mfaRequired:true}:{user:{username:f.binding.username}})));res.emit('end');return;}
   expect(options.path).toBe('/api/certificates/requests');
   if(options.method==='POST'){const input=JSON.parse(bytes!.toString());f.rows.unshift({id:'synthetic-bound-'+f.rows.length,studentId:f.binding.studentId,academicYear:'2026-27',certificateType:'BONAFIDE',purpose:input.purpose,requestedCopies:1,urgency:'NORMAL',status:'SUBMITTED',requestSource:'INTERNAL',createdByUserId:f.binding.userId,requestNumber:'CR-BOUND-'+f.rows.length,createdEvents:1});}
   const res=Object.assign(new EventEmitter(),{headers:{'content-type':'application/json'},statusCode:options.method==='POST'?201:200});listener(res);
   if(kind==='partial'){res.emit('aborted');return;}
   if(kind==='oversized'){res.emit('data',Buffer.alloc(65537));return;}
   if(kind==='redirect')res.statusCode=302;
   res.emit('data',Buffer.from(JSON.stringify(options.method==='POST'?{request:f.rows[0]}:{requests:f.rows})));if(kind==='trickle')return;res.emit('end');
  });},destroy:(error:Error)=>{req.emit('error',error);return req;}});return req;
 });
}
it('CONTROLLED_TRANSPORT: ordinary lifecycle stages exact operands then invokes concrete bound factory/process/readback/HTTP/reports',async()=>{
 const s=await setup();mockHttp(s.f);const probes:string[]=[];
 const h=harnessConnection(s.e,{stageInputs:true,certificateFixture:input=>{expect(JSON.parse(Buffer.from(input!).toString())).toEqual({password:'P'.repeat(48),source:s.p.producer.source,initializeEmptySynthetic:true});return s.fixture;},certificateReadback:args=>{probes.push(args.at(-1)!);const p=JSON.parse(Buffer.from(args.at(-1)!,'base64url').toString());expect(p.containerId).toBe(s.f.binding.containerId);
  if(p.contract==='NPS_CERTIFICATE_FIXTURE_BINDING_V1')return {...p,contract:'NPS_CERTIFICATE_FIXTURE_IDENTITY_V1',userId:s.f.binding.userId,academicYear:'2026-27',databaseIdentitySha256:s.f.binding.databaseIdentitySha256};
  expect(p.sessionSecretSha256).toBe(s.f.binding.sessionSecretSha256);return s.f.snapshot();},boundFactory:async(...args)=>{
  expect(args[3]).toBe(s.f.binding.containerId);const adapter=await boundCertificateAdapter(...args);adapter.clock=s.f.clock;adapter.drive=work=>s.f.clock.drive(work);adapter.measurement='CONTROLLED_TRANSPORT';return adapter;
 }});
 const result=await executeConsumer(s.p,process.cwd(),profileHash(s.p),undefined,h.ports);expect(result.state).toBe('COMPLETE');expect(result.classification).toBe('HARNESS_ONLY');expect(result.erpExecuted).toBe(false);expect(result.report?.result.counts.success).toBe(12);expect(probes.length).toBeGreaterThan(12);
 expect(probes.join()).not.toContain(s.cookie);expect(probes.join()).not.toContain('S'.repeat(43));expect(h.calls).toContain('certificate-readback');expect(h.calls.filter(c=>c==='serving-target').length).toBeGreaterThan(12);
 expect(readFileSync(path.join(h.life.root,'secrets/http_ca'),'utf8')).toBe(ca);expect(h.calls.indexOf('certificate-fixture')).toBeGreaterThan(h.calls.indexOf('readiness'));expect(h.calls.indexOf('certificate-ca')).toBeGreaterThan(h.calls.indexOf('certificate-fixture'));expect(s.manifest.files.some(f=>f.name==='operation-inputs.json'||f.name==='secrets/http_ca')).toBe(false);
});
it('CONTROLLED_CLOCK_REPORT_CONTRACT: bound factory selects wall/source/target config through original runner/report, without network',async()=>{
 const s=await setup(),root=await staged(s);mockHttp(s.f);
 const adapter=await boundCertificateAdapter(s.p,s.receipt,root,s.f.binding.containerId,async()=>{},async()=>s.f.snapshot());
 // Controllable clock seam tests the real-format contract, not wall performance.
 adapter.clock={kind:'MONOTONIC_WALL',now:()=>s.f.clock.now(),iso:()=>s.f.clock.iso(),sleep:(ms,signal)=>s.f.clock.sleep(ms,signal)};adapter.drive=work=>s.f.clock.drive(work);
 const report=await runConnectedScenario(s.p.scope,adapter,{mode:'REAL',adapter:'AUTHENTICATED_OPERATION_ADAPTER',profileSha256:profileHash(s.p),producerSource:s.p.producer.source,producerTree:s.p.producer.tree,consumerRunId:s.p.consumer.runId,lifecycle:'OWNED_LOCAL_RUNTIME',processIntegration:'BOUND_DOCKER_PROCESS'});
 expect(report.result.coverageComplete).toBe(true);const result=JSON.parse(report.json);expect(result.evidence).toBe('LOCAL_SYNTHETIC_HTTP');expect(result.clockKind).toBe('MONOTONIC_WALL');expect(result.config.target).toBe(s.p.scope.origin);expect(result.source).toBe(s.p.producer.source);expect(result.tree).toBe(s.p.producer.tree);expect(result.resources).not.toBeUndefined();expect(result.achievedHttpRequestsPerSecond).toBeNull();expect(report.html).not.toContain('<h1>HARNESS_ONLY</h1>');
});
it.each(['partial','oversized','redirect'])('concrete HTTPS source port refuses %s without a socket',async kind=>{
 const s=await setup(),root=await staged(s);mockHttp(s.f,kind);
 const adapter=await boundCertificateAdapter(s.p,s.receipt,root,s.f.binding.containerId,async()=>{},async()=>s.f.snapshot());
 await expect(adapter.transport({operation:'certificate_list',ordinal:0,signal:new AbortController().signal})).rejects.toThrow();
});
it('absolute HTTPS deadline bounds a partial trickling exchange without relying on socket inactivity',async()=>{
 const s=await setup(),root=await staged(s);mockHttp(s.f,'trickle');
 const adapter=await boundCertificateAdapter(s.p,s.receipt,root,s.f.binding.containerId,async()=>{},async()=>s.f.snapshot());
 await expect(adapter.transport({operation:'certificate_list',ordinal:0,signal:new AbortController().signal})).rejects.toThrow('CERTIFICATE_HTTP_DEADLINE');expect(state.request).toHaveBeenCalledTimes(1);
});
it.each(['source','profile','extra-file','changed-bytes'])('operand staging refuses %s before creating secrets',async kind=>{
 const s=await setup(),out=await reserveOutput(s.p.consumer.outputName);
 if(kind==='source')s.manifest.producerSource='0'.repeat(40);if(kind==='profile')s.manifest.profileSha256='0'.repeat(64);if(kind==='extra-file')s.manifest.files.push({name:'../foreign',sizeBytes:1,sha256:'0'.repeat(64)});
 if(kind==='changed-bytes')writeFileSync(path.join(s.root,'secrets/database_url'),'changed');else writeFileSync(path.join(s.root,'manifest.json'),JSON.stringify(s.manifest));
 expect(()=>stageConsumerInputs(s.p,s.receipt,out,['database_url','proxy_shared_secret','synthetic_director_password'])).toThrow();expect(state.request).not.toHaveBeenCalled();
});
it('session loader refuses an unrecognized or duplicate cookie without HTTPS or signing-key access',async()=>{
 for(const cookie of ['foreign=opaque','__Host-nalanda_session=invalid','__Host-nalanda_session=x; __Host-nalanda_session=y'])await expect(certificateSessionProbe(cookie)).rejects.toThrow();
 const s=await setup(),out=await staged(s);await expect(loadCertificateInputs(out,s.p,s.receipt,'0'.repeat(64))).rejects.toThrow();expect(state.request).not.toHaveBeenCalled();expect(randomUUID()).toBeTruthy();
});
it.each(['mfa','source','actor','changed-container','initialization-refused'])('post-readiness preparation refuses %s without a certificate request',async kind=>{
 const s=await setup();mockHttp(s.f,kind);
 const h=harnessConnection(s.e,{stageInputs:true,certificateFixture:()=>{if(kind==='initialization-refused')throw Error('SYNTHETIC_DATABASE_NOT_EMPTY');return {...s.fixture,...(kind==='source'?{source:'0'.repeat(40)}:{})};},
  certificateReadback:args=>{const p=JSON.parse(Buffer.from(args.at(-1)!,'base64url').toString());return p.contract==='NPS_CERTIFICATE_FIXTURE_BINDING_V1'?{...p,contract:'NPS_CERTIFICATE_FIXTURE_IDENTITY_V1',userId:s.f.binding.userId,academicYear:'2026-27',databaseIdentitySha256:s.f.binding.databaseIdentitySha256}:kind==='actor'?{...s.f.snapshot(),userId:'foreign-actor'}:s.f.snapshot();},
  mutate:(stage,state)=>{if(kind==='changed-container'&&stage==='certificate-fixture'){const web=[...state.containers.values()].find(c=>c.Name.endsWith('-web-1'));web.Image='sha256:'+'0'.repeat(64);}}
 });
 const result=await executeConsumer(s.p,process.cwd(),profileHash(s.p),undefined,h.ports);expect(result.state).toBe('INCOMPLETE');expect(result.scenarioAttempted).toBe(false);expect(result.erpExecuted).toBe(false);expect(result.lifecycleReadinessReached).toBe(true);
 expect(state.request.mock.calls.every(([o])=>o.path==='/api/auth/login')).toBe(true);expect(s.f.rows).toHaveLength(0);
 expect(state.request).toHaveBeenCalledTimes(['mfa','actor'].includes(kind)?1:0);
 if(kind==='mfa')expect(result.failure).toBe('CERTIFICATE_NORMAL_LOGIN_REQUIRED');
 if(kind==='initialization-refused')expect(result.failure).toBe('SYNTHETIC_DATABASE_NOT_EMPTY');
});
