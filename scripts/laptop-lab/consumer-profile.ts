import assert from 'node:assert/strict';
import path from 'node:path';
import { lstatSync, realpathSync, existsSync } from 'node:fs';
import { hashBytes } from '../portable/artifact-handoff';
import { scheduleFor } from './consumer-runner.mjs';
import type { ConsumerProfile } from './consumer-types';
import {codeIdentity} from './consumer-identity';
export const RELEASE_SOURCE='a48c077cf7d803fa2e690d4fed7d0a6421924f8b';
export const RELEASE_TREE='d12b1745b376646fa5cba86bd9dea33a79cb9381';
export const LOCAL_ENDPOINT='npipe:////./pipe/dockerDesktopLinuxEngine';
const exact=(v:unknown,keys:string[])=>assert(v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join()===keys.sort().join(),'LOCAL_PROFILE_FIELDS_INVALID');
export function canonicalDirectory(input:string,allowMissing=false) {
  assert(typeof input==='string'&&path.isAbsolute(input)&&path.normalize(input)===input&&!input.startsWith('\\\\')&&!input.startsWith('//')&&!/[\x00-\x1f]/.test(input),'LOCAL_PATH_INVALID');
  let cursor=input;
  while(!existsSync(cursor)){assert(allowMissing,'LOCAL_PATH_MISSING');const parent=path.dirname(cursor);assert(parent!==cursor);cursor=parent;}
  for(;;cursor=path.dirname(cursor)){
    const s=lstatSync(cursor);assert(s.isDirectory()&&!s.isSymbolicLink(),'LOCAL_PATH_ALIAS');
    assert.equal(path.resolve(realpathSync(cursor)).toLowerCase(),cursor.toLowerCase(),'LOCAL_PATH_ALIAS');
    if(path.dirname(cursor)===cursor)break;
  }
  return input;
}
export function profileHash(profile:ConsumerProfile){return hashBytes(JSON.stringify(profile));}
export function validateConsumerProfile(raw:unknown,workspace:string):ConsumerProfile {
  exact(raw,['contract','producer','consumer','scope']);const p=raw as ConsumerProfile;
  exact(p.producer,['repository','source','tree','architecture','runId','attempt','provenanceSha256']);
  exact(p.consumer,['kind','runId','project','context','endpoint','architecture','workspace','outputName','codeSha256']);
  exact(p.scope,['scenario','operations','cpu','memoryBytes','pids','phaseTimeoutMs','outputLimitBytes','origin']);
  assert.equal(p.contract,'NPS_LAPTOP_CONSUMER_V1');assert.equal(p.producer.repository,'vsairohith67/nalanda-school-erp');
  for(const v of [p.producer.source,p.producer.tree])assert(/^[a-f0-9]{40}$/.test(v),'PRODUCER_SOURCE_INVALID');
  assert(p.producer.runId===null||/^[1-9][0-9]{0,19}$/.test(p.producer.runId),'PRODUCER_RUN_INVALID');
  assert(p.producer.attempt===null||/^[1-9][0-9]{0,3}$/.test(p.producer.attempt),'PRODUCER_ATTEMPT_INVALID');
  assert(p.producer.provenanceSha256===null||/^[a-f0-9]{64}$/.test(p.producer.provenanceSha256),'PRODUCER_EVIDENCE_INVALID');
  assert(p.producer.architecture==='amd64'&&p.consumer.architecture==='amd64','LOCAL_ARCHITECTURE_UNSUPPORTED');
  assert(p.consumer.kind==='LOCAL_LAPTOP'&&/^[a-f0-9]{32}$/.test(p.consumer.runId),'LOCAL_RUN_INVALID');
  assert.equal(p.consumer.project,'nps-laptop-'+p.consumer.runId,'LOCAL_PROJECT_FOREIGN');
  assert(p.consumer.context==='desktop-linux'&&p.consumer.endpoint===LOCAL_ENDPOINT,'LOCAL_ENDPOINT_FORBIDDEN');
  canonicalDirectory(workspace);assert.equal(p.consumer.workspace,workspace,'LOCAL_WORKSPACE_MISMATCH');
  assert.equal(p.consumer.codeSha256,codeIdentity(workspace).fingerprint,'LOCAL_CODE_IDENTITY_MISMATCH');
  assert(/^[a-z][a-z0-9-]{0,39}$/.test(p.consumer.outputName)&&! /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:-|$)/i.test(p.consumer.outputName),'LOCAL_OUTPUT_INVALID');
  const output=path.join(workspace,'scripts','laptop-lab','outputs',p.consumer.outputName);
  canonicalDirectory(path.dirname(output),true);assert(!existsSync(output),'LOCAL_OUTPUT_COLLISION');
  assert.equal(p.scope.origin,'https://portable-staging.localhost:8443');
  for(const [value,min,max] of [[p.scope.cpu,0.25,4],[p.scope.memoryBytes,256*2**20,8*2**30],[p.scope.pids,16,256],[p.scope.phaseTimeoutMs,100,60000],[p.scope.outputLimitBytes,1024,2**20]])assert(Number.isFinite(value)&&value>=min&&value<=max,'LOCAL_RESOURCE_BOUND_INVALID');
  for(const v of [p.scope.memoryBytes,p.scope.pids,p.scope.phaseTimeoutMs,p.scope.outputLimitBytes])assert(Number.isSafeInteger(v),'LOCAL_RESOURCE_BOUND_INVALID');
  assert(Array.isArray(p.scope.operations)&&p.scope.operations.length>0&&p.scope.operations.length<=2&&new Set(p.scope.operations).size===p.scope.operations.length,'LOCAL_OPERATIONS_INVALID');
  assert(p.scope.operations.every(x=>['certificate_list','certificate_request'].includes(x)),'LOCAL_OPERATIONS_INVALID');
  scheduleFor(p.scope);return structuredClone(p);
}
export function assertLocalEnvironment(env:Record<string,string|undefined>) {
  assert(!env.DOCKER_HOST&&!env.DOCKER_CONTEXT,'LOCAL_DOCKER_OVERRIDE_REFUSED');
  assert(!['GITHUB_ACTIONS','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT','RUNNER_ENVIRONMENT','PORTABLE_CI_EXCEPTION'].some(k=>env[k]),'LOCAL_CI_IDENTITY_REFUSED');
}
export function exampleConsumerProfile(workspace:string,runId:string):ConsumerProfile {
  return {contract:'NPS_LAPTOP_CONSUMER_V1',producer:{repository:'vsairohith67/nalanda-school-erp',source:RELEASE_SOURCE,tree:RELEASE_TREE,architecture:'amd64',runId:null,attempt:null,provenanceSha256:null},
    consumer:{kind:'LOCAL_LAPTOP',runId,project:'nps-laptop-'+runId,context:'desktop-linux',endpoint:LOCAL_ENDPOINT,architecture:'amd64',workspace,outputName:'d4-'+runId.slice(0,12),codeSha256:codeIdentity(workspace).fingerprint},
    scope:{scenario:'read-only',operations:['certificate_list'],cpu:1,memoryBytes:1536*2**20,pids:128,phaseTimeoutMs:60000,outputLimitBytes:2**20,origin:'https://portable-staging.localhost:8443'}};
}
