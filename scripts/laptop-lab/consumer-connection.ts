import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {performance} from 'node:perf_hooks';
import { loadEvidence, verifyArtifactEvidence, assertRuntimeAdmission, hashBytes, resolveBaseImages, artifactEvidenceIdentity, type EvidenceFiles } from '../portable/artifact-handoff';
import { validateConsumerProfile, profileHash, assertLocalEnvironment, canonicalDirectory } from './consumer-profile';
import { planConsumer } from './consumer-plan';
import { runConnectedScenario } from './consumer-runner.mjs';
import { createLocalLifecycle, type Lifecycle } from './consumer-lifecycle';
import type { ConsumerProfile, ArtifactReceipt, SourceBinding, LabAdapter } from './consumer-types';
import {loadLocalAuthorization,type LocalAuthorization} from './consumer-authorization';
import {codeIdentity} from './consumer-identity';
import type {LocalHost} from './consumer-host';

export type ConnectionPorts={
  mode:'REAL'|'HARNESS_ONLY'; environment:Record<string,string|undefined>; now():number;
  monotonic?():number;
  source(producer:ConsumerProfile['producer']):SourceBinding;
  evidence(profile:ConsumerProfile):EvidenceFiles;
  admission(receipt:ArtifactReceipt,decision?:unknown):void;
  authorize(profile:ConsumerProfile,receipt:ArtifactReceipt):LocalAuthorization|void;
  lifecycle(profile:ConsumerProfile,receipt:ArtifactReceipt,signal?:AbortSignal,guard?:()=>number|void,host?:LocalHost):Lifecycle;
};
const OPERATION_SOURCE_FILES=['scripts/portable/acceptance-fixture.ts','scripts/portable/acceptance-readback.ts','scripts/portable/synthetic-foundation.ts','scripts/laptop-lab/consumer-session.ts','scripts/laptop-lab/consumer-fixture-foundation.ts'] as const;
export function assertOperationSource(workspace:string,readBlob:(relative:string)=>string){
  try{for(const file of OPERATION_SOURCE_FILES)assert.equal(hashBytes(readBlob(file).replaceAll('\r\n','\n')),hashBytes(readFileSync(path.join(workspace,file),'utf8').replaceAll('\r\n','\n')));}
  catch{throw Error('PRODUCER_OPERATION_SOURCE_REQUIRED');}
}
function realSource(p:ConsumerProfile['producer']):SourceBinding {
  const git=(args:string[])=>execFileSync('git',args,{cwd:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),encoding:'utf8',timeout:5000,maxBuffer:8*2**20,stdio:['ignore','pipe','pipe']});
  assert.equal(git(['cat-file','-t',p.source]).trim(),'commit');
  assert.equal(git(['show','-s','--format=%T',p.source]).trim(),p.tree,'PRODUCER_TREE_MISMATCH');
  // A genuinely qualified older image cannot acquire new helper contracts
  // through profile JSON. Match required shipped bytes, not consumer HEAD.
  assertOperationSource(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),file=>git(['show',p.source+':'+file]));
  const files=['Dockerfile','pnpm-lock.yaml','package.json','pnpm-workspace.yaml','deploy/portable/compose.yml'];
  return {source:p.source,tree:p.tree,inputs:Object.fromEntries(files.map(file=>[file,hashBytes(git(['show',p.source+':'+file]))])),baseImages:resolveBaseImages(git(['show',p.source+':Dockerfile']))};
}
function realEvidence(p:ConsumerProfile) {
  const root=path.join(p.consumer.workspace,'scripts/laptop-lab/inputs','producer-'+p.producer.runId+'-'+p.producer.attempt);
  canonicalDirectory(root);return loadEvidence(root);
}
const REAL_PORTS:ConnectionPorts={mode:'REAL',environment:process.env,now:()=>Date.now(),source:realSource,evidence:realEvidence,admission:assertRuntimeAdmission,
  authorize:loadLocalAuthorization,
  lifecycle:createLocalLifecycle};

function qualifyConnection(p:ConsumerProfile,ports:ConnectionPorts){
  assert(p.producer.runId&&p.producer.attempt&&p.producer.provenanceSha256,'PRODUCER_RAW_CI_EVIDENCE_REQUIRED');
  const binding=ports.source(p.producer);assert.equal(binding.source,p.producer.source);assert.equal(binding.tree,p.producer.tree);
  const files=ports.evidence(p);assert.equal(hashBytes(files['provenance.json']),p.producer.provenanceSha256,'PRODUCER_PROVENANCE_MISMATCH');
  const receipt=verifyArtifactEvidence(files,{source:p.producer.source,architecture:p.producer.architecture,runId:p.producer.runId,attempt:p.producer.attempt,now:ports.now(),inputs:binding.inputs,baseImages:binding.baseImages});
  const authorization=ports.authorize(p,receipt);
  ports.admission(receipt,authorization?.admission??authorization?.decision); // pure verification alone never mints production authority
  return {receipt,authorization};
}
export function qualifyProducer(p:ConsumerProfile,ports:ConnectionPorts){return qualifyConnection(p,ports).receipt;}
const loadedProfiles=new WeakMap<object,()=>void>();
/** Test-only dependencies are in-process; no CLI/env/profile chooses them. */
export async function executeConsumer(raw:unknown,workspace:string,expectedProfile:string,signal?:AbortSignal,ports:ConnectionPorts=REAL_PORTS){
  assertLocalEnvironment(ports.environment);const p=validateConsumerProfile(raw,workspace);
  assert.equal(profileHash(p),expectedProfile,'LOCAL_PROFILE_IDENTITY_MISMATCH');
  assert(!signal?.aborted,'LOCAL_CONSUMER_CANCELLED');
  const {receipt,authorization}=qualifyConnection(p,ports);
  assert(ports.mode==='HARNESS_ONLY'||receipt.classification==='HOSTED_EXACT_IMAGE_EVIDENCE','HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME');
  const profileSnapshot=profileHash(p),sourceSnapshot=JSON.stringify(ports.source(p.producer)),evidenceSnapshot=artifactEvidenceIdentity(receipt);
  const monotonic=ports.monotonic??(()=>performance.now()),started=monotonic();
  const remaining=()=>{if(!authorization)return Infinity;const ms=Math.min(authorization.decision.expiresAt-ports.now(),authorization.decision.maxDurationMs-(monotonic()-started));assert(Number.isFinite(ms)&&ms>0,'LOCAL_AUTHORIZATION_STALE');return ms;};
  const profileFileGuard=raw&&typeof raw==='object'?loadedProfiles.get(raw):undefined;
  const guard=()=>{
    remaining();
    assertLocalEnvironment(ports.environment);assert(!signal?.aborted,'LOCAL_CONSUMER_CANCELLED');
    assert.equal(profileHash(p),profileSnapshot,'LOCAL_PROFILE_IDENTITY_MISMATCH');profileFileGuard?.();
    if(!authorization)return; // legacy test-only harness ports have no runtime capability
    assert.equal(codeIdentity(workspace).fingerprint,p.consumer.codeSha256,'LOCAL_CODE_IDENTITY_MISMATCH');
    assert.equal(JSON.stringify(ports.source(p.producer)),sourceSnapshot,'PRODUCER_SOURCE_CHANGED');
    const binding=ports.source(p.producer),again=verifyArtifactEvidence(ports.evidence(p),{source:p.producer.source,architecture:p.producer.architecture,runId:p.producer.runId!,attempt:p.producer.attempt!,now:ports.now(),inputs:binding.inputs,baseImages:binding.baseImages});
    assert.equal(artifactEvidenceIdentity(again),evidenceSnapshot,'PRODUCER_EVIDENCE_CHANGED');authorization?.guard();return remaining();
  };
  guard();authorization?.claim();guard(); // burn before lifecycle construction/output/endpoint probes; never unclaim
  const deadline=authorization?remaining():undefined;
  if(deadline!==undefined)assert(deadline>0,'LOCAL_AUTHORIZATION_STALE');
  const duration=new AbortController(),timer=deadline===undefined?undefined:setTimeout(()=>duration.abort(),deadline);
  timer?.unref();signal=signal?AbortSignal.any([signal,duration.signal]):duration.signal;
  let life:Lifecycle;
  try{life=ports.lifecycle(p,receipt,signal,guard,authorization?.host);}catch(error){if(timer)clearTimeout(timer);throw error;}
  let failure:string|null=null,report:Awaited<ReturnType<typeof runConnectedScenario>>|null=null,launchAttempted=false,launchComplete=false,operationAttempted=false;
  const check=()=>{if(signal?.aborted)throw Error('LOCAL_CONSUMER_CANCELLED');};
  try{
    check();guard();await life.resolve();check();guard();await life.reserve();check();guard();await life.prepare();check();guard();launchAttempted=true;await life.launch();launchComplete=true;check();guard();
    const adapter=await life.bind();
    if(!adapter||ports.mode==='REAL'&&adapter.classification!=='AUTHENTICATED_ERP')throw Error('REAL_OPERATION_ADAPTER_UNAVAILABLE');
    if(authorization){const transport=adapter.transport.bind(adapter);adapter.transport=async input=>{guard();return transport(input);};}
    operationAttempted=true;report=await runConnectedScenario(p.scope,adapter,{mode:ports.mode,adapter:adapter.classification==='AUTHENTICATED_ERP'?'AUTHENTICATED_OPERATION_ADAPTER':'SIMULATED_SERVICE',profileSha256:profileHash(p),producerSource:receipt.source,...(ports.mode==='REAL'?{producerTree:p.producer.tree}:{}),consumerRunId:p.consumer.runId,lifecycle:ports.mode==='REAL'?'OWNED_LOCAL_RUNTIME':'SIMULATED_RUNTIME',processIntegration:ports.mode==='REAL'?'BOUND_DOCKER_PROCESS':life.harmlessChildCaptured?.()?'HARMLESS_CHILD_CAPTURED':'SIMULATED_PROCESS'},signal);
    if(!report.result.coverageComplete)failure='SCENARIO_INCOMPLETE';
  }catch(error){failure=error instanceof Error&&/^[A-Z][A-Z0-9_]{1,100}$/.test(error.message)?error.message:'CONNECTION_FAILED_OR_INCOMPLETE';}
  let cleanup:'COMPLETE'|'RETAINED';try{cleanup=await life.cleanup();}catch{cleanup='RETAINED';}
  if(cleanup!=='COMPLETE')failure??='CLEANUP_INCOMPLETE';
  const result={state:failure?'INCOMPLETE':'COMPLETE',classification:ports.mode==='HARNESS_ONLY'?'HARNESS_ONLY':report?'LOCAL_SYNTHETIC_HTTP':'NOT_MEASURED',failure,cleanup,profileApproved:ports.mode==='REAL',artifactAdmitted:ports.mode==='REAL',erpExecuted:ports.mode==='REAL'?(launchComplete?'STARTED':launchAttempted?'UNKNOWN_AFTER_LAUNCH_ATTEMPT':'NOT_STARTED'):false,
    lifecycleLaunchAttempted:launchAttempted,lifecycleReadinessReached:launchComplete,scenarioAttempted:operationAttempted,runtimeState:ports.mode==='HARNESS_ONLY'?'SIMULATED_ONLY':launchComplete?'READINESS_REACHED':launchAttempted?'UNKNOWN_AFTER_LAUNCH_ATTEMPT':'NOT_STARTED',report};
  // Persist only in the newly reserved owned directory; even a failed scenario
  // keeps its actual outcomes. Cleanup cannot erase a preceding failure.
  try{await life.record(result);}catch{result.state='INCOMPLETE';result.failure??='OUTPUT_INCOMPLETE';}
  if(timer)clearTimeout(timer);
  return result;
}
export function loadConsumerProfile(file:string,workspace:string){
  assert(path.isAbsolute(file)&&path.normalize(file)===file,'EXPLICIT_PROFILE_PATH_REQUIRED');
  canonicalDirectory(path.dirname(file));const stat=lstatSync(file);
  assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=16384&&realpathSync(file).toLowerCase()===file.toLowerCase(),'LOCAL_PROFILE_FILE_UNSAFE');
  const bytes=readFileSync(file),profile=validateConsumerProfile(JSON.parse(bytes.toString('utf8')),workspace);
  loadedProfiles.set(profile,()=>{const current=lstatSync(file);assert(current.ino===stat.ino&&current.ctimeMs===stat.ctimeMs&&current.mtimeMs===stat.mtimeMs&&current.nlink===1&&!current.isSymbolicLink()&&hashBytes(readFileSync(file))===hashBytes(bytes),'LOCAL_PROFILE_FILE_CHANGED');});return profile;
}
export { planConsumer };
