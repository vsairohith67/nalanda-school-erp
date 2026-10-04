import assert from "node:assert/strict";
import {createPrivateKey} from "node:crypto";
import {readFileSync} from "node:fs";
import {execFileSync} from "node:child_process";
import path from "node:path";
import {admitSyntheticArtifact} from "./admit-artifact";
import {producerIdentity,producerPaths,readSigningRoot,syntheticEvidenceRoot,validateProducerRoot} from "./synthetic-build-lifecycle";
import {inspectTarget} from "./integrated-acceptance";
import {readNativeQaInput,validateNativeQaProfile} from "./native-qa-profile";
import {nativeInventorySchema,nativeObject,validateNativeInventory,signNativeInventory,NATIVE_INPUTS,type NativeContext,type NativeInventory} from "./native-artifact";
import {authenticateNativeBuild} from "./native-build-origin";

export function parseNativeControl(raw:string){
 assert(Buffer.byteLength(raw)<=81920,"NATIVE_CONTROLLER_BOUND");const r=JSON.parse(raw);
 assert.equal(JSON.stringify(r),raw,"NATIVE_CONTROLLER_NONCANONICAL_OR_DUPLICATE");
 nativeObject(r,["kind","operation","source","runId","attempt","containerId","imageConfigDigest",...(r?.operation==="seal"?["inventory","buildToken"]:[])]);
 assert(r.kind==="native-artifact"&&["context","seal"].includes(r.operation));
 for(const [k,p] of Object.entries({source:/^[a-f0-9]{40}$/,runId:/^\d{1,20}$/,attempt:/^\d{1,6}$/,containerId:/^[a-f0-9]{64}$/,imageConfigDigest:/^sha256:[a-f0-9]{64}$/}))assert(typeof r[k]==="string"&&p.test(r[k]));
 if(r.operation==="seal"){nativeInventorySchema.parse(r.inventory);assert(typeof r.buildToken==="string"&&r.buildToken.length>0&&r.buildToken.length<=16384);}return r as {kind:"native-artifact";operation:"context"|"seal";source:string;runId:string;attempt:string;containerId:string;imageConfigDigest:string;inventory:NativeInventory;buildToken:string};
}
export function assertNativeContext(context:NativeContext,expected:Pick<NativeContext,"source"|"runId"|"attempt"|"containerId"|"imageConfigDigest">){
 assert.deepEqual(Object.keys(context).sort(),["source","runId","attempt","containerId","imageConfigDigest","trust","profile"].sort());
 for(const k of ["source","runId","attempt","containerId","imageConfigDigest"] as const)assert.equal(context[k],expected[k],"NATIVE_CONTROLLER_TARGET_CHANGED");
 const p=validateNativeQaProfile(context.trust,context.profile);for(const k of ["source","runId","attempt"] as const)assert.equal(p[k],expected[k]);return context;
}
type NativeControlPorts={admit():NativeContext;bind():void;authenticate(token:string,v:NativeInventory):Promise<unknown>;seal(v:NativeInventory,c:NativeContext):unknown};
/** Contract seam only; the fixed forced-command constructs real ports below. */
export async function dispatchNativeControl(raw:string,ports:NativeControlPorts){
 const r=parseNativeControl(raw),context=assertNativeContext(ports.admit(),r);ports.bind();
 if(r.operation==="context")return {contract:"NALANDA_NATIVE_CONTROL_V1",context};
 const v=validateNativeInventory(r.inventory,context);assert.equal(v.classification,"HOSTED_EXACT_NATIVE_BUILD","HARNESS_FIXTURE_CANNOT_QUALIFY_NATIVE");
 await ports.authenticate(r.buildToken,v);ports.bind();
 const receipt=ports.seal(v,context);ports.bind();return {contract:"NALANDA_NATIVE_CONTROL_V1",context,receipt};
}
export async function nativeController(raw:string){
 assert.equal(process.platform,"linux");assert(!process.env.SSH_ORIGINAL_COMMAND,"WINDOWS_CONTROLLER_REMOTE_COMMAND_REFUSED");
 let bind:()=>void=()=>{throw Error("NATIVE_BACKEND_NOT_ADMITTED");};
 return dispatchNativeControl(raw,{
  admit(){
   const id=producerIdentity(),signer=readSigningRoot(process.cwd(),id);
   // Existing Linux security/platform checks and unconditional runtime hold.
   const artifact=admitSyntheticArtifact(syntheticEvidenceRoot(),signer.bytes);
   const containerId=process.env.WINDOWS_CONTROLLER_CONTAINER_ID;assert(containerId&&/^[a-f0-9]{64}$/.test(containerId));
   const target=inspectTarget(artifact,containerId);bind=()=>target.bind();
   const work=validateProducerRoot(process.cwd(),id,"work"),profile=readNativeQaInput(path.join(work,"native-qa/profile.json"));
   return {source:id.source,runId:id.runId,attempt:id.attempt,containerId,imageConfigDigest:artifact.imageConfigDigest,trust:signer.trust,profile};
  },
  bind(){bind();},authenticate:authenticateNativeBuild,
  seal(v,c){
   assert.equal(v.tree,execFileSync("git",["show","-s","--format=%T",c.source],{encoding:"utf8"}).trim(),"NATIVE_SOURCE_TREE_CHANGED");
   for(const name of NATIVE_INPUTS)assert.equal(v.inputs[name].gitBlob,execFileSync("git",["rev-parse",`${c.source}:${name}`],{encoding:"utf8"}).trim(),"NATIVE_SOURCE_INPUT_CHANGED");
   const id=producerIdentity(),signer=readSigningRoot(process.cwd(),id);assert.deepEqual(signer.trust,c.trust);
   return signNativeInventory(v,c,createPrivateKey(readFileSync(path.join(producerPaths().signing,"private-key.pem"))));
  },
 });
}
