import {beforeAll,afterAll,expect,it,vi} from "vitest";
import {generateKeyPairSync,createPrivateKey,createHash,sign,X509Certificate} from "node:crypto";
import {execFileSync} from "node:child_process";
import {mkdtempSync,readFileSync,rmSync,readdirSync,writeFileSync,symlinkSync,unlinkSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {validateNativeQaProfile,signNativeQaProfile,prepareNativeQaInputs,readNativeQaInput,NATIVE_QA_PATHS,NATIVE_QA_ORIGIN,type NativeQaProfile} from "../scripts/portable/native-qa-profile";
import {createProducerRoot,prepareSigningRoot,producerPaths,cleanupProducerRoot} from "../scripts/portable/synthetic-build-lifecycle";
import {createWindowsQaTrust} from "../scripts/portable/windows-qa-trust";
import {verifySyntheticCapability,NATIVE_QA_OPERATIONS,syntheticNativeOperation,type SyntheticBuildTrust} from "../lib/portable-runtime/synthetic-capability";
const pair=generateKeyPairSync("ed25519"),now=Date.now();
const trust:SyntheticBuildTrust={contract:"NALANDA_SYNTHETIC_BUILD_V1",source:"a".repeat(40),buildId:"b".repeat(64),runId:"123",attempt:"1",publicKey:pair.publicKey.export({type:"spki",format:"pem"}).toString()};
let directory:string,p:NativeQaProfile;
beforeAll(()=>{
 directory=mkdtempSync(path.join(tmpdir(),"nalanda-qa-profile-contract-"));
 const openssl=process.platform==="win32"?"C:/Program Files/Git/usr/bin/openssl.exe":"openssl";
 execFileSync(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(directory,"key.pem"),"-out",path.join(directory,"ca.pem"),"-days","1","-subj","/CN=Nalanda synthetic contract CA","-addext","basicConstraints=critical,CA:TRUE"],{stdio:"pipe",timeout:20000});
 const caPem=readFileSync(path.join(directory,"ca.pem"),"utf8");
 p={contract:"NALANDA_NATIVE_QA_PROFILE_V1",source:trust.source,runId:trust.runId,attempt:trust.attempt,buildId:trust.buildId,nativeBuildId:"c".repeat(64),databaseSha256:"d".repeat(64),origin:NATIVE_QA_ORIGIN,environment:"synthetic-staging",phase:"windows-auth",appId:"com.nalandaps.erp",architecture:"x64",issuedAt:Date.now(),expiresAt:Date.now()+60000,caPem,caSha256:createHash("sha256").update(new X509Certificate(caPem).raw).digest("hex"),paths:[...NATIVE_QA_PATHS]};
},30000);
afterAll(()=>{if(directory){expect(path.basename(directory).startsWith("nalanda-qa-profile-contract-")).toBe(true);rmSync(directory,{recursive:true});}});
const envelope=(value:unknown)=>{const b=Buffer.from(JSON.stringify(value));return {payload:b.toString("base64url"),signature:sign(null,b,pair.privateKey).toString("base64url")};};
it("verifies real Ed25519 public profile and rejects production/missing trust",()=>{
 const e=signNativeQaProfile(p,trust,pair.privateKey);expect(validateNativeQaProfile(trust,e)).toEqual(p);
 expect(()=>validateNativeQaProfile(null,e)).toThrow("NATIVE_QA_PROFILE_REJECTED");
 expect(JSON.stringify(e)).not.toContain("PRIVATE KEY");
 expect(()=>validateNativeQaProfile(trust,{...e,signature:"a".repeat(86)})).toThrow();
});
it("rejects signed but wrong source/run/attempt/backend/origin/port/CA/scope/expiry/schema",()=>{
 for(const delta of [{source:"e".repeat(40)},{runId:"124"},{attempt:"2"},{buildId:"f".repeat(64)},{origin:"https://portable-staging.localhost:9443"},{environment:"production"},{caSha256:"e".repeat(64)},{paths:[...NATIVE_QA_PATHS,"/api/native/v1/sync"]},{expiresAt:now-1},{issuedAt:Date.now()+60000},{extra:true},{caPem:p.caPem+"PRIVATE KEY"},{caPem:"a".repeat(33000)}])expect(()=>validateNativeQaProfile(trust,envelope({...p,...delta}))).toThrow();
 expect(()=>validateNativeQaProfile(trust,{...envelope(p),extra:true})).toThrow();
 expect(()=>validateNativeQaProfile(trust,envelope(p),p.expiresAt)).toThrow();
});
it("native capability uses existing verifier, exact target and no general offline/business flags",()=>{
 const binding={hostname:"e".repeat(12),databaseSha256:p.databaseSha256,origin:p.origin,deploymentEnvironment:"synthetic-staging",provider:"postgresql",nodeEnvironment:"production"};
 const c={contract:"NALANDA_SYNTHETIC_FEATURE_CAPABILITY_V1",purpose:"RELEASE_ACCEPTANCE_FEATURES",source:p.source,runId:p.runId,attempt:p.attempt,buildId:p.buildId,hostname:binding.hostname,databaseSha256:p.databaseSha256,origin:p.origin,issuedAt:p.issuedAt,expiresAt:p.expiresAt,features:[{key:"real-user-access-readiness-1a",version:1,environment:"PRODUCTION",activationRole:"SUPER_ADMIN"}],native:{phase:"windows-auth",profileSha256:"e".repeat(64),nativeBuildId:p.nativeBuildId,caSha256:p.caSha256,operations:[...NATIVE_QA_OPERATIONS]}};
 expect(verifySyntheticCapability(trust,envelope(c),binding)).toEqual(c);
 for(const delta of [{native:{...c.native,operations:[...NATIVE_QA_OPERATIONS,"SYNC"]}},{features:[...c.features,{key:"real-data-imports",version:1,environment:"PRODUCTION",activationRole:"SUPER_ADMIN"}]},{native:{...c.native,unknown:true}}])expect(verifySyntheticCapability(trust,envelope({...c,...delta}),binding)).toBeNull();
 expect(verifySyntheticCapability(trust,envelope(c),{...binding,databaseSha256:"f".repeat(64)})).toBeNull();
 expect(syntheticNativeOperation("AUTH",{NODE_ENV:"production",CI:"true",SYNTHETIC_CAPABILITY:JSON.stringify(envelope(c))})).toBe(false);
});
it("trust ports verify before action, cleanup on caller failure, and retain refusal",async()=>{
 const calls:string[]=[],e=envelope(p),target={root:"C:\\owned\\run-123-1",userSid:"S-1-5-21-1-2-3-4",source:p.source,runId:p.runId,attempt:p.attempt,origin:p.origin,databaseSha256:p.databaseSha256,nativeBuildId:p.nativeBuildId};
 const ports=createWindowsQaTrust(target,trust,e,(v:any)=>{calls.push(v.operation);expect(v.caDer).not.toContain("PRIVATE");return v.operation==="cleanup"?{state:"CLEANED",preexistingPreserved:false,store:"CurrentUser/Root"}:{state:v.operation==="prepare"?"INSTALLED":"VERIFIED",...(v.operation==="prepare"?{preexisting:false}:{}),store:"CurrentUser/Root",browserHandshake:"NOT_EXECUTED",webviewHandshake:"NOT_EXECUTED"};});
 await expect(ports.withTrust(async()=>{throw Error("caller failed");})).rejects.toThrow("caller failed");expect(calls).toEqual(["prepare","verify","cleanup"]);
 expect(()=>createWindowsQaTrust({...target,source:"f".repeat(40)},trust,e)).toThrow();
 expect(()=>createWindowsQaTrust({...target,databaseSha256:"f".repeat(64)},trust,e)).toThrow();
 expect(()=>createWindowsQaTrust({...target,origin:"https://foreign.invalid"},trust,e)).toThrow();
 expect(()=>createWindowsQaTrust({...target,root:"C:\\personal"},trust,e)).toThrow();
 const failed=createWindowsQaTrust(target,trust,e,()=>{throw Error("trust unavailable");});await expect(failed.withTrust(async()=>true)).rejects.toThrow("trust unavailable");
 const privateOutput=createWindowsQaTrust(target,trust,e,()=>({state:"INSTALLED",store:"CurrentUser/Root",secret:"bad"}));expect(()=>privateOutput.prepare()).toThrow();
});
it("cleans an installed-but-lost response, preserves preexisting trust and surfaces cleanup refusal",async()=>{
 const target={root:"C:\\owned\\run-123-1",userSid:"S-1-5-21-1-2-3-4",source:p.source,runId:p.runId,attempt:p.attempt,origin:p.origin,databaseSha256:p.databaseSha256,nativeBuildId:p.nativeBuildId},calls:string[]=[];
 const ports=createWindowsQaTrust(target,trust,envelope(p),(v:any)=>{calls.push(v.operation);if(v.operation==="prepare")throw Error("response lost after installation");return {state:"CLEANED",preexistingPreserved:true,store:"CurrentUser/Root"};});
 await expect(ports.withTrust(async()=>true)).rejects.toThrow("response lost");expect(calls).toEqual(["prepare","cleanup"]);
 const refused=createWindowsQaTrust(target,trust,envelope(p),(v:any)=>{if(v.operation==="cleanup")throw Error("AMBIGUOUS_SETUP_RECONCILIATION_REQUIRED");return {state:"INSTALLED",preexisting:true,store:"CurrentUser/Root",browserHandshake:"NOT_EXECUTED",webviewHandshake:"NOT_EXECUTED"};});
 await expect(refused.withTrust(async()=>true)).rejects.toThrow("AMBIGUOUS_SETUP_RECONCILIATION_REQUIRED");
 vi.useFakeTimers();vi.setSystemTime(p.expiresAt+1000);
 try{const historical=createWindowsQaTrust(target,trust,envelope(p),()=>({state:"CLEANED",preexistingPreserved:true,store:"CurrentUser/Root"}));
 expect(()=>historical.prepare()).toThrow("NATIVE_QA_PROFILE_REJECTED");expect(historical.cleanup().preexistingPreserved).toBe(true);}finally{vi.useRealTimers();}
});
it("reuses real owned signer, exports only public inputs and refuses stale or linked paths",()=>{
 const workspace=mkdtempSync(path.join(tmpdir(),"nalanda-qa-producer-contract-")),id={source:trust.source,runId:"456",attempt:"1",architecture:"amd64" as const};
 const roots=producerPaths(workspace,id);
 try {
  createProducerRoot(workspace,id,"signing");const actualTrust=prepareSigningRoot(workspace,id);createProducerRoot(workspace,id,"work");
  const key=createPrivateKey(readFileSync(path.join(roots.signing,"private-key.pem")));
  const result=prepareNativeQaInputs(workspace,id,p.caPem,p.databaseSha256,key);
  expect(validateNativeQaProfile(actualTrust,readNativeQaInput(path.join(result.directory,"profile.json")))).toEqual(result.profile);
  expect(readdirSync(result.directory).sort()).toEqual(["profile.json","trust.json"]);
  for(const file of readdirSync(result.directory))expect(readFileSync(path.join(result.directory,file),"utf8")).not.toContain("PRIVATE KEY");
  expect(()=>prepareNativeQaInputs(workspace,id,p.caPem,p.databaseSha256,key)).toThrow();
  const linked=path.join(roots.work,"linked");symlinkSync(result.directory,linked,process.platform==="win32"?"junction":"dir");
  expect(()=>readNativeQaInput(path.join(linked,"profile.json"))).toThrow("NATIVE_QA_INPUT_UNSAFE");
  expect(()=>cleanupProducerRoot(workspace,id,"work")).toThrow();unlinkSync(linked);
  writeFileSync(path.join(result.directory,"oversized.json"),"a".repeat(32769));expect(()=>readNativeQaInput(path.join(result.directory,"oversized.json"))).toThrow();
 }finally{cleanupProducerRoot(workspace,id,"work");cleanupProducerRoot(workspace,id,"signing");expect(path.basename(workspace).startsWith("nalanda-qa-producer-contract-")).toBe(true);rmSync(workspace,{recursive:true});}
});
