import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {readFileSync} from "node:fs";
import path from "node:path";
import {admitSyntheticArtifact} from "./admit-artifact";
import {syntheticEvidenceRoot} from "./synthetic-build-lifecycle";
import {inspectTarget} from "./integrated-acceptance";
import {windowsProbeBinding,parseWindowsProbe,validateWindowsProbeResult,windowsFixtureResult,windowsReadback,type WindowsProbeBinding} from "./windows-server-contract";
import {runWindowsAuthentication,validateOriginalAuthorization,type WindowsLifecycleHost,type WindowsFixture} from "./windows-auth-lifecycle";

type Invocation=(input:string)=>Promise<string>;
type ServerMethods="totp"|"read"|"approvePendingDevice"|"revokeSession";
/** Contract-test injectable transport; constructing this class does NOT admit a
 * target. Production orchestration must use createAdmittedWindowsServerPorts. */
export class WindowsServerPorts {
 private originals=new Map<string,string>();private sessions=new Map<string,string>();private closed=false;
 constructor(private readonly binding:WindowsProbeBinding,private readonly invoke:Invocation,private readonly bind:()=>void,private password:string,private governancePassword:string){this.binding=Object.freeze({...windowsProbeBinding.parse(binding)});}
 private async call(operation:string,extra:Record<string,unknown>={}){
  try{
   assert(!this.closed,"WINDOWS_SERVER_PORTS_CLOSED");
   this.bind();const raw=JSON.stringify({...this.binding,operation,...extra}),input=parseWindowsProbe(raw);
   const text=await this.invoke(raw);assert(Buffer.byteLength(text)<=16_384);
   this.bind();return validateWindowsProbeResult(input.operation,JSON.parse(text));
  }catch{throw Error("WINDOWS_SERVER_OPERATION_FAILED_PRIVATE_DETAILS_WITHHELD");}
 }
 async prepare(){const f=windowsFixtureResult.parse(await this.call("prepare",{password:this.password,governancePassword:this.governancePassword}));assert(f.databaseIdentitySha256===this.binding.databaseIdentitySha256,"WINDOWS_FIXTURE_TARGET");return {...f,password:this.password};}
 assertPlatform(target:{source:string;runId:string;attempt:string;origin:string}){assert(target.source===this.binding.source&&target.runId===this.binding.runId&&target.attempt===this.binding.attempt&&target.origin==="https://portable-staging.localhost:8443","WINDOWS_PLATFORM_SERVER_BINDING");}
 observe(original:string){assert(!this.closed,"WINDOWS_SERVER_PORTS_CLOSED");const {requestId}=validateOriginalAuthorization(original,"https://portable-staging.localhost:8443");assert(this.originals.size<16,"WINDOWS_REQUEST_BOUND");const previous=this.originals.get(requestId);assert(!previous||previous===original,"WINDOWS_REQUEST_SUBSTITUTED");this.originals.set(requestId,original);}
 private original(requestId:string){const original=this.originals.get(requestId);assert(original,"WINDOWS_ORIGINAL_REQUEST_NOT_OBSERVED");return original;}
 async totp(){const r=await this.call("totp") as {token:string};return r.token;}
 async read(requestId:string){
  const r=windowsReadback.parse(await this.call("read",{original:this.original(requestId)}));
  assert(r.source===this.binding.source&&r.runId===this.binding.runId&&r.attempt===this.binding.attempt&&r.databaseIdentitySha256===this.binding.databaseIdentitySha256&&r.publicDeviceId===this.binding.publicDeviceId&&r.requestId===requestId,"WINDOWS_READBACK_SUBSTITUTED");
  if(r.sessionId){assert(!this.sessions.has(r.sessionId)||this.sessions.get(r.sessionId)===requestId,"WINDOWS_SESSION_REBOUND");this.sessions.set(r.sessionId,requestId);}return r;
 }
 async approvePendingDevice(requestId:string){await this.call("approve",{original:this.original(requestId),governancePassword:this.governancePassword});}
 async revokeSession(sessionId:string){const requestId=this.sessions.get(sessionId);assert(requestId,"WINDOWS_UNOBSERVED_SESSION");const result=await this.call("revoke-session",{original:this.original(requestId),sessionId,governancePassword:this.governancePassword}) as {sessionId:string};assert.equal(result.sessionId,sessionId,"WINDOWS_REVOCATION_TARGET_MISMATCH");}
 clear(){this.closed=true;this.originals.clear();this.sessions.clear();this.password="";this.governancePassword="";}
}

/** Real controller-side docker pipe, using the retained exact-artifact and all
 * serving-replica checks. No remotely exposed probe/database or arbitrary command.
 * Linux controller transport only: it is NOT a Windows cross-host topology. */
export function createAdmittedWindowsServerPorts(binding:WindowsProbeBinding,containerId:string){
 windowsProbeBinding.parse(binding);assert(/^[a-f0-9]{64}$/.test(containerId));
 const trust=readFileSync(path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`,"trust.json"));
 const artifact=admitSyntheticArtifact(syntheticEvidenceRoot(),trust);
 assert(artifact.source===binding.source&&process.env.GITHUB_RUN_ID===binding.runId&&process.env.GITHUB_RUN_ATTEMPT===binding.attempt,"WINDOWS_SERVER_ARTIFACT_BINDING");
 const target=inspectTarget(artifact,containerId);
 return new WindowsServerPorts(binding,async input=>execFileSync("docker",["--context","default","exec","-i","-e","PORTABLE_ACCEPTANCE_FIXTURE=synthetic-ON",containerId,"/nodejs/bin/node","dist/portable/browser-probe.mjs","windows-native"],{encoding:"utf8",input,stdio:["pipe","pipe","pipe"],timeout:90_000,maxBuffer:16_384}),target.bind,randomBytes(48).toString("base64url"),randomBytes(48).toString("base64url"));
}

/** Concrete consumer connection, not a full Windows host factory. Platform
 * admission, process ownership and original OS observation remain compulsory. */
export async function runWindowsWithServerPorts(platform:Omit<WindowsLifecycleHost,ServerMethods>,server:WindowsServerPorts,local:Pick<WindowsFixture,"pin"|"wrongPin"|"canaries">){
 let admitted=false,enteredLifecycle=false;
 try{
  const target=await platform.admit();admitted=true;server.assertPlatform(target);
  const f=await server.prepare();
  const host:WindowsLifecycleHost={
   admit:()=>platform.admit(),launch:()=>platform.launch(),bind:p=>platform.bind(p),
   observeOriginalAuthorization:async browser=>{const original=await platform.observeOriginalAuthorization(browser);server.observe(original);return original;},
   totp:()=>server.totp(),read:id=>server.read(id),approvePendingDevice:id=>server.approvePendingDevice(id),revokeSession:id=>server.revokeSession(id),
   observeCallback:(p,id)=>platform.observeCallback(p,id),restart:p=>platform.restart(p),background:p=>platform.background(p),foreground:p=>platform.foreground(p),assertProfilePreserved:()=>platform.assertProfilePreserved(),cleanup:()=>platform.cleanup(),
  };
  enteredLifecycle=true;return await runWindowsAuthentication(host,{...local,...f});
 }finally{try{if(admitted&&!enteredLifecycle)await platform.cleanup();}finally{server.clear();}}
}
