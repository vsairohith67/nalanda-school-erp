import {beforeAll,afterAll,describe,it,expect,vi} from "vitest";
import {generateKeyPairSync,sign,X509Certificate} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,linkSync,unlinkSync,symlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {hashBytes} from "../scripts/portable/artifact-handoff";
import {NATIVE_INPUTS,NATIVE_OUTPUTS,nativeJson,inventoryNativeFile,verifyNativeOutputs,verifyNativeSecurity,signNativeInventory,verifyNativeReceipt,validateNativeInventory,validateNativeScratch,removeNativeScratch,type NativeInventory,type NativeContext} from "../scripts/portable/native-artifact";
import {NATIVE_QA_PATHS,NATIVE_QA_ORIGIN,signNativeQaProfile,type NativeQaProfile} from "../scripts/portable/native-qa-profile";
import {nativeAudience,verifyNativeBuildToken} from "../scripts/portable/native-build-origin";
import {dispatchNativeControl,parseNativeControl} from "../scripts/portable/native-controller";
import {OwnedWindowsWebDriver} from "../scripts/portable/windows-webdriver-host";
import {windowsTarget} from "./fixtures/windows-auth";

const pair=generateKeyPairSync("ed25519"),oidc=generateKeyPairSync("rsa",{modulusLength:2048});
let root:string,context:NativeContext,inventory:NativeInventory,profile:NativeQaProfile;
const pe=(machine=0x8664)=>{const b=Buffer.alloc(512,0);b.write("MZ");b.writeUInt32LE(128,0x3c);b.writeUInt32LE(0x4550,128);b.writeUInt16LE(machine,132);return b;};
const json=(v:unknown)=>Buffer.from(JSON.stringify(v));
const audit=json({metadata:{vulnerabilities:{high:0,critical:0}}});
const rust=json({vulnerabilities:{found:false,count:0,list:[]},database:{"last-commit":"a".repeat(40)},lockfile:{"dependency-count":500},warnings:{}});
beforeAll(()=>{
 root=mkdtempSync(path.join(tmpdir(),"nalanda-native-inventory-contract-"));for(const d of ["launch","package"])mkdirSync(path.join(root,d));
 const openssl=process.platform==="win32"?"C:/Program Files/Git/usr/bin/openssl.exe":"openssl";
 execFileSync(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(root,"ca-key.pem"),"-out",path.join(root,"ca.pem"),"-days","1","-subj","/CN=Synthetic native contract CA","-addext","basicConstraints=critical,CA:TRUE"],{stdio:"pipe",timeout:20000});
 const now=Date.now(),caPem=readFileSync(path.join(root,"ca.pem"),"utf8"),trust={contract:"NALANDA_SYNTHETIC_BUILD_V1" as const,source:"a".repeat(40),runId:"123",attempt:"1",buildId:"b".repeat(64),publicKey:pair.publicKey.export({type:"spki",format:"pem"}).toString()};
 profile={contract:"NALANDA_NATIVE_QA_PROFILE_V1",source:trust.source,runId:trust.runId,attempt:trust.attempt,buildId:trust.buildId,nativeBuildId:"c".repeat(64),databaseSha256:"d".repeat(64),origin:NATIVE_QA_ORIGIN,environment:"synthetic-staging",phase:"windows-auth",appId:"com.nalandaps.erp",architecture:"x64",issuedAt:now-1000,expiresAt:now+600000,caPem,caSha256:hashBytes(new X509Certificate(caPem).raw),paths:[...NATIVE_QA_PATHS]};
 context={source:trust.source,runId:trust.runId,attempt:trust.attempt,containerId:"e".repeat(64),imageConfigDigest:"sha256:"+"f".repeat(64),trust,profile:signNativeQaProfile(profile,trust,pair.privateKey)};
 for(const file of NATIVE_OUTPUTS)writeFileSync(path.join(root,file),pe(file.startsWith("package/")?0x14c:0x8664));
 inventory={contract:"NALANDA_WINDOWS_NATIVE_INVENTORY_V1",classification:"HOSTED_EXACT_NATIVE_BUILD",source:trust.source,tree:"b".repeat(40),runId:trust.runId,attempt:trust.attempt,nativeBuildId:profile.nativeBuildId,profile:"SYNTHETIC_QA",appId:profile.appId,version:"0.1.0",architecture:"x64",backendBuildId:trust.buildId,backendImage:context.imageConfigDigest,containerId:context.containerId,profileSha256:hashBytes(JSON.stringify(context.profile)),trustSha256:hashBytes(JSON.stringify(trust)),createdAt:now,expiresAt:profile.expiresAt,inputs:Object.fromEntries(NATIVE_INPUTS.map(n=>[n,{gitBlob:"1".repeat(40),sha256:"2".repeat(64)}])),tools:{node:"v24.19.0",pnpm:"11.21.0",rustc:"rustc 1.97.1 (abcdef 2026-09-01)",cargo:"cargo 1.97.1 (abcdef 2026-09-01)",tauri:"2.11.4",cargoAudit:"cargo-audit 0.22.2"},toolSha256:{node:"1".repeat(64),pnpm:"2".repeat(64),rustc:"3".repeat(64),cargo:"4".repeat(64),tauri:"5".repeat(64),cargoAudit:"6".repeat(64)},outputs:NATIVE_OUTPUTS.map(f=>inventoryNativeFile(root,f)),security:{rootAudit:hashBytes(audit),appAudit:hashBytes(audit),rustAudit:hashBytes(rust)}};
},30000);
afterAll(()=>{if(root){expect(path.basename(root).startsWith("nalanda-native-inventory-contract-")).toBe(true);rmSync(root,{recursive:true});}});
const clone=()=>structuredClone(inventory);
const signed=(v:unknown,key=pair.privateKey)=>({payload:json(v).toString("base64url"),signature:sign(null,json(v),key).toString("base64url")});
describe("UNIT_OR_CONTRACT: native inventory, signatures and exact binary identity (not runtime admission)",()=>{
 it("binds separately measured raw PE executable/NSIS bytes to the signed QA and backend",()=>{
  const e=signNativeInventory(inventory,context,pair.privateKey);expect(verifyNativeReceipt(e,context)).toEqual(inventory);expect(verifyNativeOutputs(root,inventory)).toBe(path.join(root,NATIVE_OUTPUTS[0]));
  expect(inventory.outputs[0].sha256).not.toBe(inventory.outputs[1].sha256);expect(JSON.stringify(e)).not.toContain("PRIVATE KEY");
 });
 it("rejects source/run/attempt/architecture/profile/target/trust tampering and expiry",()=>{
  for(const edit of [{source:"9".repeat(40)},{runId:"124"},{attempt:"2"},{architecture:"arm64"},{profile:"NO_REMOTE_SERVER_CONFIGURED"},{backendImage:"sha256:"+"8".repeat(64)},{containerId:"7".repeat(64)},{profileSha256:"6".repeat(64)},{trustSha256:"5".repeat(64)},{expiresAt:Date.now()-1},{extra:true}])expect(()=>verifyNativeReceipt(signed({...inventory,...edit}),context)).toThrow();
  expect(()=>verifyNativeReceipt(signed(inventory,generateKeyPairSync("ed25519").privateKey),context)).toThrow("NATIVE_SIGNATURE_REJECTED");
  expect(()=>verifyNativeReceipt({...signed(inventory),publicKey:pair.publicKey.export({format:"pem",type:"spki"})},context)).toThrow();
 });
 it("rejects compilation harness receipts even with a valid signature",()=>{
  const v={...inventory,classification:"HARNESS_FIXTURE_ONLY" as const};expect(()=>signNativeInventory(v,context,pair.privateKey)).toThrow("HARNESS_FIXTURE_CANNOT_QUALIFY_NATIVE");expect(()=>verifyNativeReceipt(signed(v),context)).toThrow("HARNESS_FIXTURE_CANNOT_QUALIFY_NATIVE");
 });
 it("rejects duplicate keys, unknown fields, oversized/truncated evidence and output path collisions",()=>{
  for(const b of [Buffer.from('{"a":1,"a":2}'),Buffer.alloc(65537),Buffer.from('{"broken"')])expect(()=>nativeJson(b)).toThrow();
  for(const edits of [[inventory.outputs[0],inventory.outputs[0]],[{...inventory.outputs[0],path:"../foreign.exe"},inventory.outputs[1]],[{...inventory.outputs[0],path:"launch\\foreign.exe"},inventory.outputs[1]]])expect(()=>validateNativeInventory({...inventory,outputs:edits},context)).toThrow();
  const v=clone();delete v.inputs["pnpm-lock.yaml"];expect(()=>validateNativeInventory(v,context)).toThrow();
 });
 it("does not accept the correct installer when the launched executable changes by one byte",()=>{
  const exe=path.join(root,NATIVE_OUTPUTS[0]),original=readFileSync(exe),changed=Buffer.from(original);changed[300]=1;writeFileSync(exe,changed);
  try{expect(()=>verifyNativeOutputs(root,inventory)).toThrow("NATIVE_OUTPUT_SUBSTITUTED");}finally{writeFileSync(exe,original);}
 });
 it("rejects missing/extra support files, partial output, hardlinks and linked roots",()=>{
  const extra=path.join(root,"launch","foreign.dll");writeFileSync(extra,"foreign");expect(()=>verifyNativeOutputs(root,inventory)).toThrow("NATIVE_UNEXPECTED_SUPPORT_FILE");unlinkSync(extra);
  const exe=path.join(root,NATIVE_OUTPUTS[0]),original=readFileSync(exe),hard=path.join(root,"hard.exe");linkSync(exe,hard);expect(()=>verifyNativeOutputs(root,inventory)).toThrow("NATIVE_LINK_OR_TYPE_REFUSED");unlinkSync(hard);
  writeFileSync(exe,Buffer.alloc(10));expect(()=>verifyNativeOutputs(root,inventory)).toThrow();writeFileSync(exe,original);
  const linked=root+"-linked";symlinkSync(root,linked,process.platform==="win32"?"junction":"dir");try{expect(()=>verifyNativeOutputs(linked,inventory)).toThrow("NATIVE_REPARSE_REFUSED");}finally{unlinkSync(linked);}
  unlinkSync(exe);expect(()=>verifyNativeOutputs(root,inventory)).toThrow();writeFileSync(exe,original);
 });
 it("validates real report bytes; failed, missing or substituted dependency findings do not become a flag",()=>{
  verifyNativeSecurity({rootAudit:audit,appAudit:audit,rustAudit:rust},inventory.security);
  expect(()=>verifyNativeSecurity({rootAudit:audit,appAudit:Buffer.from("malformed"),rustAudit:rust},inventory.security)).toThrow();
  const high=json({metadata:{vulnerabilities:{high:1,critical:0}}});expect(()=>verifyNativeSecurity({rootAudit:high,appAudit:audit,rustAudit:rust},{...inventory.security,rootAudit:hashBytes(high)})).toThrow("NATIVE_DEPENDENCY_SECURITY_REJECTED");
  const missing=json({vulnerabilities:{found:false}});expect(()=>verifyNativeSecurity({rootAudit:audit,appAudit:audit,rustAudit:missing},{...inventory.security,rustAudit:hashBytes(missing)})).toThrow();
 });
 it("permits Cargo's internal hardlink peers only in scratch, copying does not relax launch guards",()=>{
  const scratch=path.join(root,"cargo");mkdirSync(scratch);mkdirSync(path.join(scratch,"deps"));
  const output=path.join(scratch,"app.exe");writeFileSync(output,pe());linkSync(output,path.join(scratch,"deps","app-hash.exe"));
  expect(validateNativeScratch(root)).toBe(scratch);
  const external=path.join(root,"external-peer.exe");linkSync(output,external);expect(()=>validateNativeScratch(root)).toThrow("NATIVE_SCRATCH_FOREIGN_HARDLINK");expect(()=>removeNativeScratch(root)).toThrow();unlinkSync(external);
  removeNativeScratch(root);expect(()=>validateNativeScratch(root)).toThrow();
 });
});
function token(overrides:Record<string,unknown>={},headerOverrides:Record<string,unknown>={}){
 const now=Math.floor(Date.now()/1000),header={alg:"RS256",kid:"fixture-key",typ:"JWT",...headerOverrides};
 const claims={iss:"https://token.actions.githubusercontent.com",aud:nativeAudience(inventory),repository:"vsairohith67/nalanda-school-erp",repository_id:"1308508401",repository_owner:"vsairohith67",repository_owner_id:"290251166",event_name:"workflow_dispatch",ref:"refs/heads/release/recovery-integration-1a",workflow_ref:"vsairohith67/nalanda-school-erp/.github/workflows/cross-platform-apps.yml@refs/heads/release/recovery-integration-1a",workflow_sha:inventory.source,sha:inventory.source,run_id:inventory.runId,run_attempt:inventory.attempt,runner_environment:"github-hosted",iat:now,nbf:now-1,exp:now+300,...overrides};
 const input=`${json(header).toString("base64url")}.${json(claims).toString("base64url")}`;return input+"."+sign("RSA-SHA256",Buffer.from(input),oidc.privateKey).toString("base64url");
}
const jwks=()=>({keys:[{...oidc.publicKey.export({format:"jwk"}),kid:"fixture-key",alg:"RS256",use:"sig"}]});
it("UNIT_OR_CONTRACT: verifies real RSA signatures and exact hosted workflow/attempt/audience (keys are harness inputs)",()=>{
 expect(verifyNativeBuildToken(token(),jwks(),inventory).inventorySha256).toBe(hashBytes(JSON.stringify(inventory)));
 expect(verifyNativeBuildToken(token({}, {x5t:"a".repeat(27)}),jwks(),inventory).source).toBe(inventory.source);
 for(const edit of [{aud:"foreign"},{run_attempt:"2"},{repository_id:"1"},{repository_owner_id:"1"},{sha:"9".repeat(40)},{workflow_sha:"9".repeat(40)},{event_name:"pull_request"},{runner_environment:"self-hosted"},{exp:1},{iat:1},{job_workflow_ref:"foreign"}])expect(()=>verifyNativeBuildToken(token(edit),jwks(),inventory)).toThrow();
 expect(()=>verifyNativeBuildToken(token({}, {jku:"https://foreign.invalid"}),jwks(),inventory)).toThrow();expect(()=>verifyNativeBuildToken(token(),{keys:[]},inventory)).toThrow();
 const v=clone();v.outputs[0].sha256="0".repeat(64);expect(()=>verifyNativeBuildToken(token(),jwks(),v)).toThrow();
});
it("controller orders independent backend admission and authenticated origin before sealing; denials cannot launch",async()=>{
 const wire={kind:"native-artifact",operation:"seal",source:context.source,runId:context.runId,attempt:context.attempt,containerId:context.containerId,imageConfigDigest:context.imageConfigDigest,inventory,buildToken:"synthetic-contract-token"};
 const calls:string[]=[],ports={admit:()=>{calls.push("admit");return context;},bind:()=>{calls.push("bind");},authenticate:async()=>{calls.push("authenticate");},seal:(v:NativeInventory)=>{calls.push("seal");return signNativeInventory(v,context,pair.privateKey);}};
 const result=await dispatchNativeControl(JSON.stringify(wire),ports);expect(result.receipt).toEqual(signed(inventory));expect(calls).toEqual(["admit","bind","authenticate","bind","seal","bind"]);
 calls.length=0;await expect(dispatchNativeControl(JSON.stringify(wire),{...ports,admit(){throw Error("EXTERNAL_RUNTIME_BLOCKED");}})).rejects.toThrow("EXTERNAL_RUNTIME_BLOCKED");expect(calls).toEqual([]);
 calls.length=0;await expect(dispatchNativeControl(JSON.stringify(wire),{...ports,authenticate:async()=>{throw Error("origin denied");}})).rejects.toThrow();expect(calls).toEqual(["admit","bind"]);
 expect(()=>parseNativeControl(JSON.stringify({...wire,command:"foreign"}))).toThrow();expect(()=>parseNativeControl(" ".repeat(81921))).toThrow();
 const os=vi.fn(),host=new OwnedWindowsWebDriver(windowsTarget(),{} as any,os);await expect(host.start()).rejects.toThrow("WINDOWS_NATIVE_AND_BACKEND_ADMISSION_INPUT_REQUIRED");expect(os).not.toHaveBeenCalled();
});
