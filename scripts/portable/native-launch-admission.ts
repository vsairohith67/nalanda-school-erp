import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync,lstatSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import {nativeJson,nativeOwnedPath,NATIVE_INPUTS,verifyNativeReceipt,verifyNativeOutputs,verifyNativeSecurity} from "./native-artifact";
import {validateProducerRoot} from "./synthetic-build-lifecycle";
import type {WindowsPrivateTransport} from "./windows-private-transport";
import type {WindowsTarget} from "./windows-auth-lifecycle";

/** Actual launch consumer. No injected admission callback, test receipt, local
 * trust key or Linux environment spoof can substitute for the live controller. */
export async function admitWindowsNativeLaunch(target:WindowsTarget,transport:WindowsPrivateTransport){
 assert.equal(process.platform,"win32");assert.equal(target.profile,"SYNTHETIC_QA","NATIVE_CONNECTED_QA_PROFILE_REQUIRED");
 for(const k of ["source","runId","attempt","root","userSid"] as const)assert.equal(target[k],transport[k],"NATIVE_LAUNCH_TARGET_CHANGED");
 const {createPrivateWindowsChannel}=await import("./windows-private-transport");
 const {privateWindowsOs}=await import("./windows-webdriver-host");
 const channel=createPrivateWindowsChannel(transport,target);
 // This SSH-authenticated result is freshly produced by the fixed controller,
 // which performs Linux runtime + exact serving-replica admission itself.
 const context=channel.native().context;
 const work=validateProducerRoot(target.root,{source:target.source,runId:target.runId,attempt:target.attempt,architecture:"amd64"},"work");
 const receiptFile=nativeOwnedPath(work,"native-receipt.json");assert(lstatSync(receiptFile).size<=65536,"NATIVE_EVIDENCE_BOUND");const receipt=nativeJson(readFileSync(receiptFile));
 const inventory=verifyNativeReceipt(receipt,context);
 const git=(...args:string[])=>execFileSync("git",args,{encoding:"utf8",timeout:30000,stdio:["ignore","pipe","pipe"]}).trim();
 assert.equal(git("show","-s","--format=%T",target.source),inventory.tree);
 for(const name of NATIVE_INPUTS){assert.equal(git("rev-parse",`${target.source}:${name}`),inventory.inputs[name].gitBlob);assert.equal(hashBytes(readFileSync(name)),inventory.inputs[name].sha256,"NATIVE_BUILD_INPUT_SUBSTITUTED");}
 const reports=Object.fromEntries(["rootAudit","appAudit","rustAudit"].map(name=>{const file=nativeOwnedPath(work,`security/${name}.json`);assert(lstatSync(file).size<=4*1024*1024);return [name,readFileSync(file)];})) as Parameters<typeof verifyNativeSecurity>[0];
 verifyNativeSecurity(reports,inventory.security);
 const verifyFiles=()=>{
  const executable=verifyNativeOutputs(work,inventory);assert.equal(path.resolve(target.executable),executable,"NATIVE_LAUNCH_EXECUTABLE_NOT_INVENTORIED");assert.equal(target.artifactSha256,inventory.outputs[0].sha256);
  // Root ACL is protected by the existing transport. Descendants may inherit
  // only that disposable user's/System/Administrators access. No ACL mutation.
  for(const relative of ["launch","package",...inventory.outputs.map(f=>f.path)]){
   const file=nativeOwnedPath(work,relative,!relative.includes("/"));
   const acl=privateWindowsOs({operation:"file-security",file});
   assert(acl.userSid===target.userSid&&acl.owner===target.userSid&&Array.isArray(acl.rules)&&acl.rules.length>0&&acl.rules.length<=8,"NATIVE_OUTPUT_OWNER");
   assert(acl.rules.every((r:{sid:string;type:string})=>r.type==="Allow"&&[target.userSid,"S-1-5-18","S-1-5-32-544"].includes(r.sid)),"NATIVE_OUTPUT_FOREIGN_ACL");
  }
  return executable;
 };
 verifyFiles();return {inventory,verifyFiles};
}
