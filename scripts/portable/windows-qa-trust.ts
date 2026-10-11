import assert from "node:assert/strict";
import {createHash,X509Certificate} from "node:crypto";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import type {SyntheticBuildTrust} from "../../lib/portable-runtime/synthetic-capability";
import {validateNativeQaProfile,type NativeQaEnvelope} from "./native-qa-profile";
export type WindowsQaTrustTarget={root:string;userSid:string;source:string;runId:string;attempt:string;origin:string;databaseSha256:string;nativeBuildId:string};
type Invoke=(input:unknown)=>unknown;
const hash=(b:string|Buffer)=>createHash("sha256").update(b).digest("hex");
function invoke(input:unknown){
 assert.equal(process.platform,"win32");
 const script="scripts/portable/windows-qa-trust.ps1",source=process.env.EXPECTED_SHA;
 assert(source&&/^[a-f0-9]{40}$/.test(source));
 assert.equal(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),source);
 // Git's path-specific clean filter handles the repository's mandated CRLF PS
 // checkout without accepting arbitrary whitespace or edited source.
 assert.equal(execFileSync("git",["hash-object",`--path=${script}`,script],{encoding:"utf8"}).trim(),execFileSync("git",["rev-parse",`${source}:${script}`],{encoding:"utf8"}).trim());
 try{return JSON.parse(execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-File",path.resolve(script)],{input:JSON.stringify(input),encoding:"utf8",windowsHide:true,timeout:30000,maxBuffer:4096,stdio:["pipe","pipe","pipe"]}));}
 catch{throw Error("WINDOWS_QA_TRUST_REFUSED_RECONCILIATION_REQUIRED");}
}
/** Concrete preparation/verification/cleanup ports for the later owned host.
 * Store evidence is not evidence of an Edge or WebView TLS navigation. */
export function createWindowsQaTrust(target:WindowsQaTrustTarget,trust:SyntheticBuildTrust,envelope:NativeQaEnvelope,call:Invoke=invoke){
 // Historical signature validation allows exact cleanup after profile expiry;
 // preparation and verification always revalidate against the current time.
 assert(envelope&&typeof envelope.payload==="string"&&envelope.payload.length<=24576);
 const issuedAt=JSON.parse(Buffer.from(envelope.payload,"base64url").toString()).issuedAt;
 const p=validateNativeQaProfile(trust,envelope,issuedAt);
 assert.deepEqual(Object.keys(target).sort(),["root","userSid","source","runId","attempt","origin","databaseSha256","nativeBuildId"].sort());
 for(const key of ["source","runId","attempt","origin","databaseSha256","nativeBuildId"] as const)assert.equal(target[key],p[key],"WINDOWS_QA_TRUST_BINDING");
 assert(/^S-1-5-21-(?:\d+-){3}\d+$/.test(target.userSid));
 assert.equal(path.win32.basename(target.root),`run-${p.runId}-${p.attempt}`);
 const {root,userSid,source,runId,attempt}=target;
 const input={root,userSid,source,runId,attempt,profileSha256:hash(JSON.stringify(envelope)),caSha256:p.caSha256,caDer:new X509Certificate(p.caPem).raw.toString("base64")};
 let dispatched=false,preexisting:boolean|undefined;
 const execute=(operation:"prepare"|"verify"|"cleanup")=>{
  // Expiry must not prevent cleaning an already installed, exactly owned CA.
  if(operation!=="cleanup")validateNativeQaProfile(trust,envelope);
  if(operation==="prepare")dispatched=true;
  const result=call({operation,...input}) as Record<string,unknown>;
  assert(result&&result.state===({prepare:"INSTALLED",verify:"VERIFIED",cleanup:"CLEANED"})[operation]&&result.store==="CurrentUser/Root","WINDOWS_QA_TRUST_RESULT_INVALID");
  const allowed=operation==="cleanup"?["state","preexistingPreserved","store"]:operation==="prepare"?["state","preexisting","store","browserHandshake","webviewHandshake"]:["state","store","browserHandshake","webviewHandshake"];
  assert.deepEqual(Object.keys(result).sort(),allowed.sort());
  if(operation==="prepare"){assert.equal(typeof result.preexisting,"boolean");preexisting=result.preexisting as boolean;}
  if(operation==="cleanup"){assert.equal(typeof result.preexistingPreserved,"boolean");if(preexisting!==undefined)assert.equal(result.preexistingPreserved,preexisting);}
  if(operation!=="cleanup"){assert.equal(result.browserHandshake,"NOT_EXECUTED");assert.equal(result.webviewHandshake,"NOT_EXECUTED");}
  return result;
 };
 return {prepare:()=>execute("prepare"),verify:()=>execute("verify"),cleanup:()=>execute("cleanup"),async withTrust<T>(action:()=>Promise<T>){try{execute("prepare");execute("verify");return await action();}finally{if(dispatched)execute("cleanup");}}};
}

if(/(?:^|[\\/])windows-qa-trust\.(?:ts|mjs)$/.test(process.argv[1]??"")){
 try {
  const raw=readFileSync(0);assert(raw.length<=32768);const input=JSON.parse(raw.toString());
  assert.deepEqual(Object.keys(input).sort(),["target","trust","envelope"].sort());
  const operation=process.argv[2];assert(process.argv.length===3&&["prepare","verify","cleanup"].includes(operation));
  const ports=createWindowsQaTrust(input.target,input.trust,input.envelope);
  console.log(JSON.stringify(ports[operation as "prepare"|"verify"|"cleanup"]()));
 }catch{console.error("WINDOWS_QA_TRUST_REFUSED_RECONCILIATION_REQUIRED");process.exitCode=1;}
}
