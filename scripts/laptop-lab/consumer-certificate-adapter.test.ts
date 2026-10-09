import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {certificateFixture} from './consumer-certificate-test-support';
import {createCertificateAdapter,validateCertificateSnapshot} from './consumer-certificate-adapter';
import {runConnectedScenario} from './consumer-runner.mjs';
import {executeConsumer} from './consumer-connection';
import {profileHash} from './consumer-profile';
import {evidenceFixture,harnessConnection} from './consumer-test-support';
import {assertReadonlyCertificateSession,type ReadonlySessionRow,type ReadonlyRoleRow} from './consumer-session';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const scope={scenario:'disposable-mutation' as const,operations:['certificate_list','certificate_request'] as ('certificate_list'|'certificate_request')[],cpu:1,memoryBytes:2**30,pids:128,phaseTimeoutMs:2000,outputLimitBytes:2**20,origin:'https://portable-staging.localhost:8443' as const};
const connection={mode:'HARNESS_ONLY' as const,adapter:'AUTHENTICATED_OPERATION_ADAPTER' as const,profileSha256:'d'.repeat(64),producerSource:'a'.repeat(40),consumerRunId:'e'.repeat(32),lifecycle:'SIMULATED_RUNTIME' as const,processIntegration:'SIMULATED_PROCESS' as const};
test('actual adapter executes GET/POST semantics through original scheduler and all three HARNESS_ONLY reports',async()=>{
 const f=certificateFixture(),r=await runConnectedScenario(scope,f.adapter(),connection);
 assert(r.result.coverageComplete);assert.equal(r.result.counts.success,12);assert(f.calls.some(c=>c.method==='GET')&&f.calls.some(c=>c.method==='POST'));
 for(const value of [r.json,r.csv,r.html])assert(value.includes('HARNESS_ONLY')&&value.includes('AUTHENTICATED_OPERATION_ADAPTER'));
 assert(!r.json.includes(f.binding.studentId));assert(!r.json.includes(f.binding.username));
});
test('normal connection/lifecycle selector binds actual adapter after existing target validation',async()=>{
 const f=certificateFixture(),e=evidenceFixture(workspace,f.binding.consumerRunId);f.binding.source=e.profile.producer.source;
 const h=harnessConnection(e,{adapter:()=>f.adapter()});e.profile.scope=scope;
 const r=await executeConsumer(e.profile,workspace,profileHash(e.profile),undefined,h.ports);
 assert.equal(r.state,'COMPLETE');assert(h.calls.includes('serving-target'));assert.equal(r.report?.result.counts.success,12);assert.equal(r.erpExecuted,false);assert.equal(r.artifactAdmitted,false);assert.equal(r.profileApproved,false);
});
for(const [name,response] of [
 ['expired',()=>Response.json({error:'expired'},{status:401})],['denied',()=>Response.json({error:'denied'},{status:403})],
 ['login HTML',()=>new Response('<html>login</html>',{headers:{'content-type':'text/html'}})],['redirect',()=>new Response(null,{status:302,headers:{location:'/login'}})],
 ['invalid JSON',()=>new Response('{',{headers:{'content-type':'application/json'}})],['partial list',()=>Response.json({requests:[{id:'foreign'}]})],
 ['wrong subject',()=>Response.json({request:{id:'wrong',studentId:'foreign',status:'SUBMITTED'}},{status:201})]
] as const)test('negative response '+name+' never contributes throughput success',async()=>{
 const f=certificateFixture();f.ports.http=async()=>response();const r=await runConnectedScenario(scope,f.adapter(),connection);
 assert.equal(r.result.counts.success,0);assert(!r.result.coverageComplete);assert.equal(r.result.counts.refused,name==='expired'||name==='denied'?3:0);
});
for(const key of ['source','containerId','databaseIdentitySha256','consumerRunId','userId','studentId'] as const)test('readback rejects substituted '+key,()=>{
 const f=certificateFixture(),s=f.snapshot();s[key]='foreign';assert.throws(()=>validateCertificateSnapshot(s,f.binding));
});
for(const kind of ['no event','duplicate effect','changed prior row','partial readback','wrong actor'] as const)test('mutation refuses '+kind,async()=>{
 const f=certificateFixture(),http=f.ports.http;f.ports.http=async(...args)=>{const r=await http(...args);if(args[0]==='POST'){
  if(kind==='no event')f.rows[0].createdEvents=0;
  if(kind==='duplicate effect')f.rows.push({...f.rows[0],id:'duplicate',requestNumber:'CR-DUPLICATE'});
  if(kind==='changed prior row'&&f.rows.length>1)f.rows[1].purpose='SYNTHETIC changed';
  if(kind==='partial readback')f.rows.length=0;
  if(kind==='wrong actor')f.rows[0].createdByUserId='foreign';
 }return r;};
 const r=await runConnectedScenario({...scope,operations:['certificate_request']},f.adapter(),connection);assert(!r.result.coverageComplete);assert(r.result.counts.failed>0);
});
test('timeout/cancellation preserve uncertain mutations and never retry an ordinal',async()=>{
 const f=certificateFixture();f.ports.http=async(_method,_route,_body,signal)=>{f.calls.push({method:'POST',body:null});await f.clock.sleep(1000,signal);return Response.json({});};
 const r=await runConnectedScenario({...scope,operations:['certificate_request']},f.adapter(),connection);assert.equal(r.result.counts.timeout,3);assert.equal(f.calls.length,3);assert(!r.result.coverageComplete);
 const c=certificateFixture(),controller=new AbortController();controller.abort();const cancelled=await runConnectedScenario(scope,c.adapter(),connection,controller.signal);assert(!cancelled.result.coverageComplete);assert.equal(c.calls.length,0);
});
test('duplicate ordinal and unsupported operation refuse without a second request',async()=>{
 const f=certificateFixture(),adapter=createCertificateAdapter(f.binding,f.ports),signal=new AbortController().signal;
 await f.clock.drive(adapter.transport({operation:'certificate_request',ordinal:0,signal}));
 await assert.rejects(adapter.transport({operation:'certificate_request',ordinal:0,signal}));
 await assert.rejects(adapter.transport({operation:'other',ordinal:1,signal}));assert.equal(f.calls.length,1);
});
test('stale target rebind refuses before authenticated request',async()=>{
 const f=certificateFixture();f.ports.rebind=async()=>{throw Error('CERTIFICATE_SERVING_TARGET_CHANGED');};
 const r=await runConnectedScenario(scope,f.adapter(),connection);assert.equal(f.calls.length,0);assert.equal(r.result.counts.success,0);
});
for(const kind of ['foreign actor','expired','revoked','credential change','authorization change','inactive role'] as const)test('read-only current session binding rejects '+kind+' before HTTP',async()=>{
 const f=certificateFixture(),now=new Date('2026-10-04T00:00:00Z');
 const session:ReadonlySessionRow={id:f.binding.sessionId,userId:f.binding.userId,tokenHash:f.binding.sessionSecretSha256,revokedAt:null,expiresAt:new Date(now.getTime()+60000),credentialVersion:1,authorizationVersion:1,activeRoleAssignmentId:'synthetic-role',user:{id:f.binding.userId,isActive:true,lifecycleStatus:'ACTIVE',mustChangePassword:false,credentialVersion:1,authorizationVersion:1}};
 const role:ReadonlyRoleRow={id:'synthetic-role',userId:f.binding.userId,role:'SUPER_ADMIN',status:'ACTIVE',validFrom:new Date(now.getTime()-60000),validUntil:null};
 if(kind==='foreign actor')session.userId='foreign';if(kind==='expired')session.expiresAt=now;if(kind==='revoked')session.revokedAt=now;
 if(kind==='credential change')session.user.credentialVersion=2;if(kind==='authorization change')session.user.authorizationVersion=2;if(kind==='inactive role')role.status='REVOKED';
 f.ports.snapshot=async()=>{assertReadonlyCertificateSession(session,role,f.binding,now);return f.snapshot();};
 const r=await runConnectedScenario(scope,f.adapter(),connection);assert.equal(f.calls.length,0);assert.equal(r.result.counts.success,0);
});
test('failure after lifecycle launch retains readiness/attempt facts independent of absent report',async()=>{
 const f=certificateFixture(),e=evidenceFixture(workspace,f.binding.consumerRunId),h=harnessConnection(e,{adapter:()=>null});
 const r=await executeConsumer(e.profile,workspace,profileHash(e.profile),undefined,h.ports);
 assert.equal(r.state,'INCOMPLETE');assert.equal(r.report,null);assert.equal(r.lifecycleLaunchAttempted,true);assert.equal(r.lifecycleReadinessReached,true);assert.equal(r.scenarioAttempted,false);assert.equal(r.runtimeState,'SIMULATED_ONLY');assert.equal(r.erpExecuted,false);
});
