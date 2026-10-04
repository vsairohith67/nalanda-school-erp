import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { exampleConsumerProfile, validateConsumerProfile, profileHash, assertLocalEnvironment, canonicalDirectory } from './consumer-profile';
import { planConsumer, SERVICES, NETWORKS, VOLUMES } from './consumer-plan';
import { executeConsumer, qualifyProducer, loadConsumerProfile,assertOperationSource } from './consumer-connection';
import { localCompose, LocalLifecycle } from './consumer-lifecycle';
import { evidenceFixture, harnessConnection, simulatedService, composeFixture } from './consumer-test-support';
import { assertRuntimeAdmission, verifyArtifactEvidence, hashBytes } from '../portable/artifact-handoff';
import { captureProductProcess } from '../portable/producer-process';
import { reserveOutput } from './output.mjs';
const workspace=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const token=()=>randomUUID().replaceAll('-','');
const fixture=()=>evidenceFixture(workspace,token());
const execute=(f:ReturnType<typeof fixture>,h:ReturnType<typeof harnessConnection>,signal?:AbortSignal)=>executeConsumer(f.profile,workspace,profileHash(f.profile),signal,h.ports);
test('producer operation source accepts equal normalized bytes without borrowing consumer commit identity',()=>{
 let reads=0;assertOperationSource(workspace,file=>{reads++;return readFileSync(path.join(workspace,file),'utf8').replaceAll('\r\n','\n').replaceAll('\n','\r\n');});assert.equal(reads,5);
});
test('producer operation source refuses an absent immutable helper',()=>{
 assert.throws(()=>assertOperationSource(workspace,file=>{if(file.endsWith('consumer-session.ts'))throw Error('ABSENT_BLOB');return readFileSync(path.join(workspace,file),'utf8');}),/PRODUCER_OPERATION_SOURCE_REQUIRED/);
});
test('producer operation source refuses a changed immutable helper',()=>{
 assert.throws(()=>assertOperationSource(workspace,file=>readFileSync(path.join(workspace,file),'utf8')+(file.endsWith('acceptance-readback.ts')?'CHANGED':'')),/PRODUCER_OPERATION_SOURCE_REQUIRED/);
});

test('safe plan connects profile/source/owned lifecycle/runner/reports with no Docker process or output writes',()=>{
 const p=exampleConsumerProfile(workspace,token()),out=path.join(workspace,'scripts/laptop-lab/outputs',p.consumer.outputName);
 const plan=planConsumer(p,workspace,{});
 assert.equal(plan.classification,'PLANNED_NOT_EXECUTED');assert.equal(plan.runtimeSideEffects,0);assert.equal(plan.producer.runId,null);
 assert.equal(plan.resources.containers.length,SERVICES.length);assert.equal(plan.resources.networks.length,NETWORKS.length);assert.equal(plan.resources.volumes.length,VOLUMES.length);
 assert.equal(new Set(plan.requiredInputs).size,plan.requiredInputs.length);assert(plan.requiredInputs.includes('LOCAL_CONSUMER_PROFILE_AUTHORIZATION'));
 assert(plan.code.fingerprint);assert.equal(plan.erpExecuted,false);assert.equal(existsSync(out),false);assert(plan.scenarios.every(s=>s.realAdapter==='AUTHENTICATED_OPERATION_ADAPTER'&&s.status==='IMPLEMENTED_EXECUTION_GATED'&&!s.fallback));
});
test('complete declared producer identity leaves approval/admission missing once, and keeps consumer token separate',()=>{
 const f=fixture(),plan=planConsumer(f.profile,workspace,{});assert.equal(plan.producer.runId,'123');assert.notEqual(plan.consumer.runId,plan.producer.runId);
 assert(!plan.requiredInputs.includes('PRODUCER_RAW_CI_EVIDENCE'));assert(plan.enforcementPoints.includes('EXTERNAL_RUNTIME_BLOCKED'));
});
for(const [name,mutate] of [
 ['remote endpoint',(p:any)=>p.consumer.endpoint='tcp://remote.invalid:2375'],['alternate context',(p:any)=>p.consumer.context='default'],
 ['architecture',(p:any)=>p.consumer.architecture='arm64'],['foreign project',(p:any)=>p.consumer.project='nalanda-ci-123-stack'],
 ['swapped consumer ID',(p:any)=>p.consumer.runId='123'],['swapped producer ID',(p:any)=>p.producer.runId=p.consumer.runId],
 ['borrowed workspace',(p:any)=>p.consumer.workspace=path.dirname(workspace)],['output escape',(p:any)=>p.consumer.outputName='../foreign'],
 ['Windows device alias',(p:any)=>p.consumer.outputName='con'],['non-local origin',(p:any)=>p.scope.origin='https://remote.invalid'],
 ['unsupported operation',(p:any)=>p.scope.operations=['certificate_list','other']],['mutation under read-only',(p:any)=>p.scope.operations=['certificate_request']],
 ['resource escalation',(p:any)=>p.scope.memoryBytes=16*2**30],['host mount field',(p:any)=>p.consumer.mount=workspace],['approval boolean',(p:any)=>p.approved=true],
 ['producer override field',(p:any)=>p.producer.GITHUB_RUN_ID='123']
 ,['changed connection code',(p:any)=>p.consumer.codeSha256='0'.repeat(64)]
] as const)test('profile refuses '+name,()=>{const p=exampleConsumerProfile(workspace,token());mutate(p);assert.throws(()=>validateConsumerProfile(p,workspace));});
for(const key of ['DOCKER_HOST','DOCKER_CONTEXT','GITHUB_ACTIONS','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','PORTABLE_CI_EXCEPTION'])test('local environment refuses '+key,()=>assert.throws(()=>assertLocalEnvironment({[key]:'forged'})));
test('spaces work, noncanonical aliases and existing output names refuse without overwrite',async()=>{
 const p=exampleConsumerProfile(workspace,token());assert(workspace.includes(' '));assert.equal(canonicalDirectory(workspace),workspace);
 assert.throws(()=>canonicalDirectory(workspace+path.sep+'..'+path.sep+path.basename(workspace)));
 const dir=await reserveOutput(p.consumer.outputName);writeFileSync(path.join(dir,'existing-marker'),'preserve',{flag:'wx'});
 assert.throws(()=>validateConsumerProfile(p,workspace),/LOCAL_OUTPUT_COLLISION/);assert.equal(readFileSync(path.join(dir,'existing-marker'),'utf8'),'preserve');
 const alias=path.join(dir,'alias');symlinkSync(workspace,alias,'junction');assert.throws(()=>canonicalDirectory(alias),/LOCAL_PATH_ALIAS/);
});
test('profile file must be exact absolute canonical regular bounded bytes, not a symlink',async()=>{
 const f=fixture(),dir=await reserveOutput('d4-input-'+token().slice(0,12)),file=path.join(dir,'profile.json');writeFileSync(file,JSON.stringify(f.profile),{flag:'wx'});
 assert.deepEqual(loadConsumerProfile(file,workspace),f.profile);assert.throws(()=>loadConsumerProfile('relative.json',workspace));
 const alias=path.join(dir,'profile-alias.json');symlinkSync(file,alias,'file');assert.throws(()=>loadConsumerProfile(alias,workspace));
});
for(const kind of ['missing','stale','mismatched source','harness-only','hosted-complete-held','profile mismatch'])test('ordinary admission refuses '+kind+' before lifecycle creation',async()=>{
 const f=fixture(),h=harnessConnection(f);h.ports.admission=assertRuntimeAdmission;
 if(kind==='missing')f.profile.producer.provenanceSha256=null;
 if(kind==='stale')h.ports.now=()=>f.now+7*3600000;
 if(kind==='mismatched source')f.profile.producer.source='e'.repeat(40);
 if(kind==='hosted-complete-held'){const p=JSON.parse(f.files['provenance.json'].toString());p.classification='HOSTED_EXACT_IMAGE_EVIDENCE';f.files['provenance.json']=Buffer.from(JSON.stringify(p));f.profile.producer.provenanceSha256=hashBytes(f.files['provenance.json']);}
 const refusal={'missing':'PRODUCER_RAW_CI_EVIDENCE_REQUIRED','stale':'ARTIFACT_EVIDENCE_STALE','mismatched source':'ARTIFACT_CONTEXT_MISMATCH','harness-only':'HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME','hosted-complete-held':'EXTERNAL_RUNTIME_BLOCKED','profile mismatch':'LOCAL_PROFILE_IDENTITY_MISMATCH'}[kind];
 assert(refusal);
 await assert.rejects(()=>executeConsumer(f.profile,workspace,kind==='profile mismatch'?'0'.repeat(64):profileHash(f.profile),undefined,h.ports),new RegExp(refusal));
 assert.equal(h.calls.length,0);assert.equal(existsSync(path.join(workspace,'scripts/laptop-lab/outputs',f.profile.consumer.outputName)),false);
});
test('producer identity is used unchanged even when hostile CI values are present',async()=>{
 const f=fixture(),h=harnessConnection(f);h.ports.environment={GITHUB_RUN_ID:'123',GITHUB_ACTIONS:'true'};await assert.rejects(()=>execute(f,h),/LOCAL_CI_IDENTITY_REFUSED/);assert.deepEqual(h.calls,[]);
});
test('connected test prerequisite reaches actual lifecycle recipe, original runner and saved JSON/CSV/HTML',async()=>{
 const f=fixture(),h=harnessConnection(f),r=await execute(f,h);
 assert.equal(r.state,'COMPLETE');assert.equal(r.classification,'HARNESS_ONLY');assert.equal(r.erpExecuted,false);assert.equal(r.artifactAdmitted,false);
 assert(r.report?.result.coverageComplete);assert.equal(r.report?.result.counts.success,12);
 assert(h.calls.includes('create')&&h.calls.includes('migrate')&&h.calls.includes('serving-target'));
 assert.equal(h.state.containers.size+h.state.networks.size+h.state.volumes.size,0);
 const saved=JSON.parse(readFileSync(path.join(h.life.root,'result.json'),'utf8'));assert.equal(saved.connection.adapter,'SIMULATED_SERVICE');assert.equal(saved.artifact,null);
 assert(readFileSync(path.join(h.life.root,'summary.html'),'utf8').includes('HARNESS_ONLY'));assert(readFileSync(path.join(h.life.root,'operations.csv'),'utf8').includes('certificate_list'));
 const snapshots=readdirSync(h.life.root).filter(n=>/^runtime-private-\d+\.json$/.test(n)).sort((a,b)=>Number(a.split('-').at(-1)?.split('.')[0])-Number(b.split('-').at(-1)?.split('.')[0]));
 const manifest=JSON.parse(readFileSync(path.join(h.life.root,snapshots.at(-1)!),'utf8'));
 const create=manifest.commands.find((c:any)=>c.stage==='create');assert(create.args.includes('--pull')&&create.args.includes('never')&&!create.args.includes('--build'));
});
test('real operation adapter selection never falls back to the memory fixture',async()=>{
 for(const adapter of [null,{...simulatedService(),classification:'AUTHENTICATED_ERP'} as any]){
  const f=fixture(),h=harnessConnection(f,{adapter:()=>adapter}),r=await execute(f,h);assert.equal(r.state,'INCOMPLETE');assert.equal(r.report,null);assert.equal(r.erpExecuted,false);
 }
});
for(const [name,stage,change] of [
 ['effective remote endpoint','resolve-context',(v:any)=>v[0].Endpoints.docker.Host='tcp://remote.invalid:2375'],
 ['wrong engine architecture','resolve-engine',(v:any)=>v.architecture='aarch64'],
 ['wrong image','image-inspect',(v:any)=>v[0].Id='sha256:'+'0'.repeat(64)],
 ['wrong image architecture','image-inspect',(v:any)=>v[0].Architecture='arm64'],
 ['partial child JSON','resolve-context',()=>null]
] as const)test('connected lifecycle refuses '+name,async()=>{
 const f=fixture(),h=harnessConnection(f,{response:(s,text)=>{if(s!==stage)return text;if(name==='partial child JSON')return '{';const v=JSON.parse(text);change(v);return JSON.stringify(v);}});
 const r=await execute(f,h);assert.equal(r.state,'INCOMPLETE');assert(!h.calls.includes('create'));
});
for(const [name,mutate] of [
 ['foreign project labels',(s:any)=>[...s.containers.values()][0].Config.Labels['io.nps.consumer.run']='0'.repeat(32)],
 ['wrong serving image',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='web-1')c.Image='sha256:'+'0'.repeat(64);} ],
 ['different database secret',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='web-1')c.Mounts[0].Source+='-other';}],
 ['public proxy listener',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='reverse-proxy')c.NetworkSettings.Ports['8443/tcp'][0].HostIp='0.0.0.0';}],
 ['wrong network alias',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='web-1')Object.values(c.NetworkSettings.Networks).forEach((n:any)=>n.Aliases.push('postgres'));}]
 ,['foreign infrastructure network',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='valkey')c.NetworkSettings.Networks['foreign-network']={NetworkID:hashBytes('foreign'),Aliases:[]};}]
 ,['infrastructure DNS override',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='object-init')c.HostConfig.ExtraHosts=['foreign.invalid:1.2.3.4'];}]
 ,['same-named foreign network ID',(s:any)=>{for(const c of s.containers.values())if(c.Config.Labels['com.docker.compose.service']==='valkey')Object.values(c.NetworkSettings.Networks).forEach((n:any)=>n.NetworkID=hashBytes('foreign-same-name'));}]
] as const)test('actual target contract refuses '+name,async()=>{
 const f=fixture(),h=harnessConnection(f,{mutate:(stage,state)=>{if(stage==='serving-target')mutate(state);}}),r=await execute(f,h);assert.equal(r.state,'INCOMPLETE');assert.equal(r.report,null);
});
test('resource collision prevents creation and leaves the unrelated state alone',async()=>{
 const f=fixture(),h=harnessConnection(f,{response:(stage,text)=>stage==='collision-container'?'existing-owner-container':text}),r=await execute(f,h);assert.equal(r.state,'INCOMPLETE');assert(!h.calls.includes('create'));
});
test('failed launch remains incomplete after successful exact cleanup',async()=>{
 const f=fixture(),h=harnessConnection(f,{mutate:(stage)=>{if(stage==='dependencies')throw Error('NONZERO_CHILD');}}),r=await execute(f,h);
 assert.equal(r.state,'INCOMPLETE');assert.equal(r.cleanup,'COMPLETE');assert.equal(h.state.containers.size,0);assert.equal(r.report,null);
});
test('cleanup refusal retains proved-owned residue and cannot turn the experiment green',async()=>{
 const f=fixture(),h=harnessConnection(f,{mutate:(stage)=>{if(stage==='cleanup-remove')throw Error('DELETION_DENIED');}}),r=await execute(f,h);
 assert.equal(r.state,'INCOMPLETE');assert.equal(r.cleanup,'RETAINED');assert(h.state.containers.size>0);assert(r.report?.result.coverageComplete);
});
test('unsettled child capture forbids destructive cleanup',async()=>{
 const f=fixture(),h=harnessConnection(f,{mutate:stage=>{if(stage==='dependencies'){h.life.markUnsettled();throw Error('UNSETTLED');}}}),r=await execute(f,h);
 assert.equal(r.cleanup,'RETAINED');assert(!h.calls.includes('cleanup-remove'));assert(h.state.containers.size>0);
});
test('cancellation before launch performs no calls, and later cancellation stays incomplete with cleanup',async()=>{
 const f=fixture(),h=harnessConnection(f),early=new AbortController();early.abort();await assert.rejects(()=>execute(f,h,early.signal));assert.deepEqual(h.calls,[]);
 const later=fixture(),controller=new AbortController(),late=harnessConnection(later,{mutate:stage=>{if(stage==='readiness')controller.abort();}}),r=await execute(later,late,controller.signal);
 assert.equal(r.state,'INCOMPLETE');assert.equal(r.cleanup,'COMPLETE');assert.equal(late.state.containers.size,0);
});
test('shared production process capture preserves actual harmless-child nonzero/partial/cancel results',async()=>{
 const dir=await reserveOutput('d4-child-'+token().slice(0,12)),unsettled=new Set<number>();
 const command=(code:string)=>({stage:'harmless-child',tool:process.execPath,args:['-e',code],timeoutMs:2000});
 const good=await captureProductProcess(command('process.stdout.write(JSON.stringify({synthetic:true}))'),dir,1,unsettled);assert.equal(good.exit,0);assert(good.settled);assert.deepEqual(JSON.parse(readFileSync(path.join(dir,'process-1.stdout'),'utf8')),{synthetic:true});
 const bad=await captureProductProcess(command('process.stdout.write("{");process.exitCode=7'),dir,2,unsettled);assert.equal(bad.exit,7);assert.throws(()=>JSON.parse(readFileSync(path.join(dir,'process-2.stdout'),'utf8')));
 const controller=new AbortController();controller.abort();const cancelled=await captureProductProcess(command('throw Error("must not run")'),dir,3,unsettled,controller.signal);assert(cancelled.interrupted&&cancelled.settled);assert.equal(cancelled.exit,null);
});
test('shared capture enforces a smaller combined byte ceiling while preserving the existing default',async()=>{
 const dir=await reserveOutput('d4-limit-'+token().slice(0,12)),pending=new Set<number>(),command={stage:'harmless-output-limit',tool:process.execPath,args:['-e','process.stdout.write("x".repeat(4096))'],timeoutMs:2000};
 const limited=await captureProductProcess(command,dir,1,pending,undefined,{maxOutputBytes:1024});assert(limited.ioFailed);assert(limited.stdoutBytes+limited.stderrBytes<=1024);assert.equal(limited.settled,process.platform!=='win32');
 const ordinary=await captureProductProcess(command,dir,2,pending);assert.equal(ordinary.exit,0);assert.equal(ordinary.stdoutBytes,4096);assert(!ordinary.ioFailed&&ordinary.settled);
 await assert.rejects(()=>captureProductProcess(command,dir,3,pending,undefined,{maxOutputBytes:0}),/PRODUCT_PROCESS_OUTPUT_LIMIT_INVALID/);assert(!existsSync(path.join(dir,'process-3.stdout')));
});
test('connected lifecycle uses shared capture for a real harmless child before original runner/report completion',async()=>{
 let captured=false;
 const f=fixture(),h=harnessConnection(f,{response:async(stage,text)=>{
  if(stage!=='readiness')return text;
  const pending=new Set<number>(),r=await captureProductProcess({stage:'harmless-connected-child',tool:process.execPath,args:['-e','process.stdout.write(JSON.stringify({synthetic:true,stage:"connected"}))'],timeoutMs:2000},h.life.root,1,pending);
  assert(r.settled&&r.exit===0&&!r.timedOut);captured=true;assert.deepEqual(JSON.parse(readFileSync(path.join(h.life.root,'process-1.stdout'),'utf8')),{synthetic:true,stage:'connected'});return text;
 }});
 const lifecycle=h.ports.lifecycle;h.ports.lifecycle=(...args)=>{const life=lifecycle(...args);life.harmlessChildCaptured=()=>captured;return life;};
 const result=await execute(f,h);assert.equal(result.state,'COMPLETE');assert.equal(result.classification,'HARNESS_ONLY');
 for(const file of ['result.json','operations.csv','summary.html']){const text=readFileSync(path.join(h.life.root,file),'utf8');assert(text.includes('HARMLESS_CHILD_CAPTURED')&&text.includes('SIMULATED_SERVICE')&&text.includes('HARNESS_ONLY'));}
});
test('cleanup reconciles partial newly owned resources and confirms final absence',async()=>{
 const f=fixture(),h=harnessConnection(f,{mutate:(stage,state)=>{if(stage==='dependencies'){const c=structuredClone([...state.containers.values()][0]);c.Id=hashBytes('replacement');state.containers.clear();state.containers.set(c.Id,c);throw Error('PARTIAL_CREATION');}}}),r=await execute(f,h);
 assert.equal(r.state,'INCOMPLETE');assert.equal(r.cleanup,'RETAINED'); // stale IDs were not silently considered removed
 assert(h.calls.includes('cleanup-owned-container-ids'));assert.equal(h.state.containers.size,0);
});
test('failed final absence verification retains cleanup state',async()=>{
 const f=fixture(),h=harnessConnection(f,{response:(stage,text)=>stage==='cleanup-absence-volume'?'owned-residue':text}),r=await execute(f,h);assert.equal(r.state,'INCOMPLETE');assert.equal(r.cleanup,'RETAINED');
});
test('private snapshot collision preserves the existing file and leaves the connection incomplete',async()=>{
 let marker='';const f=fixture(),h=harnessConnection(f,{mutate:(stage)=>{if(stage!=='readiness')return;const snapshots=readdirSync(h.life.root).filter(n=>/^runtime-private-\d+\.json$/.test(n));const next=Math.max(...snapshots.map(n=>Number(n.match(/\d+/)![0])))+1;marker=path.join(h.life.root,'runtime-private-'+next+'.json');writeFileSync(marker,'preserve',{flag:'wx'});}}),r=await execute(f,h);
 assert.equal(r.state,'INCOMPLETE');assert.equal(readFileSync(marker,'utf8'),'preserve');
});
test('real entrypoint has no adapter/approval/command injection switch',()=>{
 const cli=path.join(workspace,'scripts/laptop-lab/cli.mjs');
 assert.throws(()=>execFileSync(process.execPath,[cli,'plan','--adapter','fake'],{encoding:'utf8',stdio:'pipe',timeout:5000}));
});
test('actual plan CLI keeps the loader cache in memory and creates no output',async()=>{
 const dir=await reserveOutput('d4-plan-'+token().slice(0,12));writeFileSync(path.join(dir,'preserved-marker'),'preserve',{flag:'wx'});
 const before=readdirSync(dir).sort();
 const plan=JSON.parse(execFileSync(process.execPath,[path.join(workspace,'scripts/laptop-lab/cli.mjs'),'plan'],{cwd:workspace,encoding:'utf8',timeout:10000,env:{...process.env,TEMP:dir,TMP:dir,TMPDIR:dir,TSX_DISABLE_CACHE:''}}));
 assert.equal(plan.classification,'PLANNED_NOT_EXECUTED');assert.deepEqual(readdirSync(dir).sort(),before);assert(!existsSync(plan.reports.root));assert.equal(readFileSync(path.join(dir,'preserved-marker'),'utf8'),'preserve');
});
