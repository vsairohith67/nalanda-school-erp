import {beforeAll,beforeEach,afterEach,afterAll,it,expect,vi} from "vitest";
import {generateKeyPairSync,X509Certificate} from "node:crypto";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,existsSync,linkSync} from "node:fs";
import path from "node:path";
import {tmpdir} from "node:os";
const state=vi.hoisted(()=>({realExec:null as any,context:null as any,fault:"",calls:[] as string[],directory:"",sealed:null as any,gitHashes:0}));
vi.mock("node:child_process",async()=>{const actual=await vi.importActual<any>("node:child_process");state.realExec=actual.execFileSync;return {...actual,execFileSync:(tool:string,args:string[],options:any)=>{
 state.calls.push(tool==="git"?`git:${args[0]}`:args.includes("build")?"build":args.includes("audit")||args.some(s=>s.startsWith("pnpm audit"))?"audit":tool);
 if(tool==="git"){
  if(args[0]==="status")return "";if(args[0]==="show")return "b".repeat(40);if(args[0]==="hash-object"){if(args.includes("scripts/portable/windows-host.ps1"))return state.fault==="cleanup-script"?"9".repeat(40):"a".repeat(40);state.gitHashes++;return state.fault==="changed-input"&&state.gitHashes>9?"9".repeat(40):"a".repeat(40);}return "a".repeat(40);
 }
 if(args.includes("build")){
  expect(args.slice(-2)).toEqual(["--","--locked"]);
  expect(existsSync(path.join(options.env.CARGO_TARGET_DIR,"../process-unreconciled"))).toBe(true);
  expect(()=>cleanupNativeBuild(config)).toThrow("NATIVE_BUILD_PROCESS_STATE_UNRECONCILED");
  const release=path.join(options.env.CARGO_TARGET_DIR,"x86_64-pc-windows-msvc/release");mkdirSync(path.join(release,"bundle/nsis"),{recursive:true});mkdirSync(path.join(release,"deps"));
  const pe=Buffer.alloc(512);pe.write("MZ");pe.writeUInt32LE(128,0x3c);pe.writeUInt32LE(0x4550,128);pe.writeUInt16LE(0x8664,132);
  writeFileSync(path.join(release,"nalanda-cross-platform.exe"),pe);linkSync(path.join(release,"nalanda-cross-platform.exe"),path.join(release,"deps/native-hash.exe"));pe[300]=1;writeFileSync(path.join(release,"bundle/nsis/Nalanda School_0.1.0_x64-setup.exe"),pe);
  expect(options.env.NALANDA_NATIVE_PROFILE).toBe("SYNTHETIC_QA");expect(options.env.NALANDA_QA_PROFILE_SHA256).toBe(hashBytes(JSON.stringify(state.context.profile)));expect(options.env).not.toHaveProperty("PRIVATE_KEY");
  if(["build","timeout","overflow"].includes(state.fault))throw Error("simulated tool failure");return Buffer.from("");
 }
 if(tool==="where.exe")return Buffer.from(path.join(state.directory,args[0]+".exe"));
 if(tool==="rustup")return Buffer.from(path.join(state.directory,args[1]+".exe"));
 if(args.includes("--version")||args.includes("pnpm --version"))return Buffer.from(tool==="rustc"?"rustc 1.97.1 (abcdef 2026-09-01)":tool==="cargo"?(args.includes("audit")?"cargo-audit-audit 0.22.2":"cargo 1.97.1 (abcdef 2026-09-01)"):"11.21.0");
 if(state.fault==="scan")throw Error("scanner failed");
 if(tool==="cargo")return Buffer.from(JSON.stringify({vulnerabilities:{found:false,count:0,list:[]},database:{"last-commit":"a".repeat(40)},lockfile:{"dependency-count":500},warnings:{}}));
 return Buffer.from(JSON.stringify({metadata:{vulnerabilities:{high:0,critical:0}}}));
 }};});
vi.mock("../scripts/portable/windows-private-transport",()=>({
 validateWindowsPrivateTransport:(c:any)=>c,assertPrivateWindowsAcl:()=>{},
 createPrivateWindowsChannel:()=>({native:(inventory:any)=>{state.calls.push(inventory?"seal":"context");if(!inventory)return {context:state.context};if(state.fault==="seal")throw Error("admission refused");state.sealed=inventory;return {context:state.context,receipt:signNativeInventory(inventory,state.context,pair.privateKey)};}}),
}));
vi.mock("../scripts/portable/windows-webdriver-host",()=>({privateWindowsOs:()=>{state.calls.push("private-os");return {};}}));
vi.mock("../scripts/portable/native-build-origin",()=>({requestNativeBuildToken:async()=>{state.calls.push("origin");return "HARNESS_TOKEN_NOT_REAL_PROVENANCE";}}));
import {buildNativeQa,cleanupNativeBuild} from "../scripts/portable/build-native-qa";
import {hashBytes} from "../scripts/portable/artifact-handoff";
import {signNativeInventory,verifyNativeOutputs,removeNativeScratch} from "../scripts/portable/native-artifact";
import {signNativeQaProfile,NATIVE_QA_PATHS,NATIVE_QA_ORIGIN} from "../scripts/portable/native-qa-profile";
import {producerPaths} from "../scripts/portable/synthetic-build-lifecycle";
const pair=generateKeyPairSync("ed25519"),source="a".repeat(40),id={source,runId:"123",attempt:"1",architecture:"amd64" as const};
let parent:string,config:any,inputs:string,platform:PropertyDescriptor|undefined;
beforeAll(()=>{
 parent=mkdtempSync(path.join(tmpdir(),"nalanda-native-producer-contract-"));
 const openssl=process.platform==="win32"?"C:/Program Files/Git/usr/bin/openssl.exe":"openssl";
 state.realExec(openssl,["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(parent,"key.pem"),"-out",path.join(parent,"ca.pem"),"-days","1","-subj","/CN=Synthetic producer contract","-addext","basicConstraints=critical,CA:TRUE"],{stdio:"pipe",timeout:20000});
},30000);
beforeEach(()=>{
 state.directory=mkdtempSync(path.join(parent,"run-"));for(const name of ["pnpm","cargo","rustc","cargo-audit"])writeFileSync(path.join(state.directory,name+".exe"),"HARNESS_TOOL_ONLY");
 inputs=path.join(state.directory,"inputs");mkdirSync(inputs);const now=Date.now(),caPem=readFileSync(path.join(parent,"ca.pem"),"utf8"),trust={contract:"NALANDA_SYNTHETIC_BUILD_V1" as const,source,runId:"123",attempt:"1",buildId:"b".repeat(64),publicKey:pair.publicKey.export({format:"pem",type:"spki"}).toString()};
 const p={contract:"NALANDA_NATIVE_QA_PROFILE_V1" as const,source,runId:"123",attempt:"1",buildId:trust.buildId,nativeBuildId:hashBytes(JSON.stringify({source,runId:"123",attempt:"1",backendBuildId:trust.buildId,profile:"synthetic-qa",architecture:"x64"})),databaseSha256:"d".repeat(64),origin:NATIVE_QA_ORIGIN,environment:"synthetic-staging" as const,phase:"windows-auth" as const,appId:"com.nalandaps.erp" as const,architecture:"x64" as const,issuedAt:now-1000,expiresAt:now+600000,caPem,caSha256:hashBytes(new X509Certificate(caPem).raw),paths:[...NATIVE_QA_PATHS]};
 state.context={source,runId:"123",attempt:"1",containerId:"e".repeat(64),imageConfigDigest:"sha256:"+"f".repeat(64),trust,profile:signNativeQaProfile(p,trust,pair.privateKey)};
 for(const name of ["trust","profile"])writeFileSync(path.join(inputs,name+".json"),JSON.stringify(state.context[name]));
 config={...id,root:state.directory,userSid:"synthetic-adapter-only"};state.fault="";state.calls=[];state.gitHashes=0;state.sealed=null;
 platform=Object.getOwnPropertyDescriptor(process,"platform");Object.defineProperty(process,"platform",{value:"win32",configurable:true});
 for(const [k,v] of Object.entries({GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_SHA:source,EXPECTED_SHA:source,GITHUB_RUN_ID:"123",GITHUB_RUN_ATTEMPT:"1",GITHUB_ACTIONS:"true",RUNNER_ENVIRONMENT:"github-hosted",PORTABLE_CI_EXCEPTION:"OWNER_AUTHORIZED"}))vi.stubEnv(k,v);
});
afterEach(()=>{if(platform)Object.defineProperty(process,"platform",platform);vi.unstubAllEnvs();const work=producerPaths(state.directory,id).work;if(existsSync(path.join(work,"cargo")))removeNativeScratch(work);});
afterAll(()=>{expect(path.basename(parent).startsWith("nalanda-native-producer-contract-")).toBe(true);rmSync(parent,{recursive:true});});
it("UNIT_OR_CONTRACT: actual producer control flow with explicit process/SSH/OIDC doubles inventories private files",async()=>{
 const result=await buildNativeQa(inputs,config);expect(result.state).toBe("QA_NATIVE_EVIDENCE_SEALED_BACKEND_RECHECK_REQUIRED");
 expect(state.calls.indexOf("context")).toBeLessThan(state.calls.indexOf("build"));expect(state.calls.indexOf("build")).toBeLessThan(state.calls.indexOf("origin"));expect(state.calls.indexOf("origin")).toBeLessThan(state.calls.indexOf("seal"));
 const work=producerPaths(state.directory,id).work;expect(verifyNativeOutputs(work,state.sealed)).toBe(path.join(work,"launch/nalanda-cross-platform.exe"));
 expect(JSON.stringify(result)).not.toMatch(/PRIVATE|HARNESS_TOKEN|pem|inputs|password/i);expect(cleanupNativeBuild(config)).toBe("REMOVED");expect(existsSync(work)).toBe(false);
});
it.each(["scan","seal","changed-input"])("producer %s failure has no receipt and cleans owned quiescent output",async fault=>{
 state.fault=fault;await expect(buildNativeQa(inputs,config)).rejects.toThrow("NATIVE_QA_BUILD_OR_EVIDENCE_REFUSED");expect(existsSync(producerPaths(state.directory,id).work)).toBe(false);if(fault!=="seal")expect(state.calls).not.toContain("seal");
});
it("rejects unreviewed compiler/config overrides before building",async()=>{
 vi.stubEnv("TAURI_CONFIG","unreviewed");await expect(buildNativeQa(inputs,config)).rejects.toThrow("NATIVE_UNREVIEWED_BUILD_OVERRIDE");expect(state.calls).not.toContain("build");
});
it("standalone cleanup refuses changed PowerShell source before any OS call",()=>{
 state.fault="cleanup-script";expect(()=>cleanupNativeBuild(config)).toThrow("WINDOWS_HOST_SOURCE_CHANGED");expect(state.calls).not.toContain("private-os");
});
it.each(["build","timeout","overflow"])("producer %s failure preserves ambiguous process residue and refuses cleanup",async fault=>{
 state.fault=fault;await expect(buildNativeQa(inputs,config)).rejects.toThrow("NATIVE_BUILD_PROCESS_STATE_UNRECONCILED");
 const work=producerPaths(state.directory,id).work;expect(existsSync(path.join(work,"process-unreconciled"))).toBe(true);expect(existsSync(path.join(work,"native-receipt.json"))).toBe(false);expect(()=>cleanupNativeBuild(config)).toThrow("NATIVE_BUILD_PROCESS_STATE_UNRECONCILED");expect(state.calls).not.toContain("seal");
});
