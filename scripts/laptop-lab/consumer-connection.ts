import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import { loadEvidence, verifyArtifactEvidence, assertRuntimeAdmission, hashBytes, resolveBaseImages, type EvidenceFiles } from '../portable/artifact-handoff';
import { validateConsumerProfile, profileHash, assertLocalEnvironment, canonicalDirectory } from './consumer-profile';
import { planConsumer } from './consumer-plan';
import { runConnectedScenario } from './consumer-runner.mjs';
import { createLocalLifecycle, type Lifecycle } from './consumer-lifecycle';
import type { ConsumerProfile, ArtifactReceipt, SourceBinding, LabAdapter } from './consumer-types';

export type ConnectionPorts={
  mode:'REAL'|'HARNESS_ONLY'; environment:Record<string,string|undefined>; now():number;
  source(producer:ConsumerProfile['producer']):SourceBinding;
  evidence(profile:ConsumerProfile):EvidenceFiles;
  admission(receipt:ArtifactReceipt):void;
  authorize(profile:ConsumerProfile,receipt:ArtifactReceipt):void;
  lifecycle(profile:ConsumerProfile,receipt:ArtifactReceipt,signal?:AbortSignal):Lifecycle;
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
  authorize(){throw Error('LOCAL_CONSUMER_PROFILE_NOT_AUTHORIZED');},
  lifecycle:createLocalLifecycle};

export function qualifyProducer(p:ConsumerProfile,ports:ConnectionPorts){
  assert(p.producer.runId&&p.producer.attempt&&p.producer.provenanceSha256,'PRODUCER_RAW_CI_EVIDENCE_REQUIRED');
  const binding=ports.source(p.producer);assert.equal(binding.source,p.producer.source);assert.equal(binding.tree,p.producer.tree);
  const files=ports.evidence(p);assert.equal(hashBytes(files['provenance.json']),p.producer.provenanceSha256,'PRODUCER_PROVENANCE_MISMATCH');
  const receipt=verifyArtifactEvidence(files,{source:p.producer.source,architecture:p.producer.architecture,runId:p.producer.runId,attempt:p.producer.attempt,now:ports.now(),inputs:binding.inputs,baseImages:binding.baseImages});
  ports.admission(receipt); // unchanged real decision, before context/process/output/image/target side effects
  ports.authorize(p,receipt); // distinct consumer authorization; producer receipt cannot replace it
  return receipt;
}
/** Test-only dependencies are in-process; no CLI/env/profile chooses them. */
export async function executeConsumer(raw:unknown,workspace:string,expectedProfile:string,signal?:AbortSignal,ports:ConnectionPorts=REAL_PORTS){
  assertLocalEnvironment(ports.environment);const p=validateConsumerProfile(raw,workspace);
  assert.equal(profileHash(p),expectedProfile,'LOCAL_PROFILE_IDENTITY_MISMATCH');
  assert(!signal?.aborted,'LOCAL_CONSUMER_CANCELLED');
  const receipt=qualifyProducer(p,ports);
  assert(ports.mode==='HARNESS_ONLY'||receipt.classification==='HOSTED_EXACT_IMAGE_EVIDENCE','HARNESS_FIXTURE_CANNOT_QUALIFY_RUNTIME');
  const life=ports.lifecycle(p,receipt,signal);let failure:string|null=null,report:Awaited<ReturnType<typeof runConnectedScenario>>|null=null,launchAttempted=false,launchComplete=false,operationAttempted=false;
  const check=()=>{if(signal?.aborted)throw Error('LOCAL_CONSUMER_CANCELLED');};
  try{
    check();await life.resolve();check();await life.reserve();check();await life.prepare();check();launchAttempted=true;await life.launch();launchComplete=true;check();
    const adapter=await life.bind();
    if(!adapter||ports.mode==='REAL'&&adapter.classification!=='AUTHENTICATED_ERP')throw Error('REAL_OPERATION_ADAPTER_UNAVAILABLE');
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
  return result;
}
export function loadConsumerProfile(file:string,workspace:string){
  assert(path.isAbsolute(file)&&path.normalize(file)===file,'EXPLICIT_PROFILE_PATH_REQUIRED');
  canonicalDirectory(path.dirname(file));const stat=lstatSync(file);
  assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size<=16384&&realpathSync(file).toLowerCase()===file.toLowerCase(),'LOCAL_PROFILE_FILE_UNSAFE');
  return validateConsumerProfile(JSON.parse(readFileSync(file,'utf8')),workspace);
}
export { planConsumer };
