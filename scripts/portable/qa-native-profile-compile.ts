/** HARNESS_FIXTURE_ONLY. Compiler/production-exclusion checks; no app launch,
 * artifact admission, certificate-store mutation, or publication. */
import {execFileSync,spawnSync} from "node:child_process";
import {generateKeyPairSync,createHash,X509Certificate} from "node:crypto";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {NATIVE_QA_ORIGIN,NATIVE_QA_PATHS,signNativeQaProfile,type NativeQaProfile} from "./native-qa-profile";
import type {SyntheticBuildTrust} from "../../lib/portable-runtime/synthetic-capability";
assert.equal(process.platform,"win32","WINDOWS_COMPILER_CONTRACT_REQUIRED");
const mode=process.argv[2];
assert(process.argv.length<=3 && (mode===undefined || mode==="--minimum-test" || mode==="--integration-test"),"UNKNOWN_COMPILER_MODE");
const toolchain=mode==="--minimum-test"?"+1.90.0":mode==="--integration-test"?"+1.97.1":undefined;
const directory=mkdtempSync(path.join(tmpdir(),"nalanda-native-qa-compile-"));
const hash=(v:string|Buffer)=>createHash("sha256").update(v).digest("hex");
try {
 const caFile=path.join(directory,"ca.pem");
 execFileSync("C:/Program Files/Git/usr/bin/openssl.exe",["req","-x509","-newkey","rsa:2048","-nodes","-keyout",path.join(directory,"tls-fixture.key"),"-out",caFile,"-days","1","-subj","/CN=Nalanda compile fixture","-addext","basicConstraints=critical,CA:TRUE"],{stdio:"pipe",timeout:20000});
 const caPem=readFileSync(caFile,"utf8"),pair=generateKeyPairSync("ed25519");
 const trust:SyntheticBuildTrust={contract:"NALANDA_SYNTHETIC_BUILD_V1",source:"a".repeat(40),runId:"123",attempt:"1",buildId:"b".repeat(64),publicKey:pair.publicKey.export({type:"spki",format:"pem"}).toString()};
 const p:NativeQaProfile={contract:"NALANDA_NATIVE_QA_PROFILE_V1",source:trust.source,runId:trust.runId,attempt:trust.attempt,buildId:trust.buildId,nativeBuildId:"c".repeat(64),databaseSha256:"d".repeat(64),origin:NATIVE_QA_ORIGIN,environment:"synthetic-staging",phase:"windows-auth",appId:"com.nalandaps.erp",architecture:"x64",issuedAt:Date.now(),expiresAt:Date.now()+3600000,caPem,caSha256:hash(new X509Certificate(caPem).raw),paths:[...NATIVE_QA_PATHS]};
 const profile=JSON.stringify(signNativeQaProfile(p,trust,pair.privateKey)),trustBytes=JSON.stringify(trust);
 const publicInputs=path.join(directory,"public-inputs");mkdirSync(publicInputs);
 writeFileSync(path.join(publicInputs,"profile.json"),profile,{flag:"wx"});writeFileSync(path.join(publicInputs,"trust.json"),trustBytes,{flag:"wx"});
 const env={...process.env,NALANDA_NATIVE_PROFILE:"SYNTHETIC_QA",NALANDA_QA_INPUT_DIRECTORY:publicInputs,NALANDA_QA_PROFILE_SHA256:hash(profile),NALANDA_QA_TRUST_SHA256:hash(trustBytes)};
 const command=[...(toolchain?[toolchain]:[]),"check","--locked","--manifest-path","apps/nalanda-cross-platform/src-tauri/Cargo.toml",...(mode?["--target","x86_64-pc-windows-msvc"]:[])];
 const run=(args:string[],inputEnv:NodeJS.ProcessEnv)=>{
  if(!mode)return execFileSync("cargo",args,{env:inputEnv,stdio:["ignore","pipe","pipe"],timeout:180000,maxBuffer:4*1024*1024});
  const output=spawnSync("cargo",args,{env:inputEnv,stdio:["ignore","pipe","pipe"],timeout:900000,maxBuffer:4*1024*1024,windowsHide:true});
  if(output.stdout)process.stdout.write(output.stdout);if(output.stderr)process.stderr.write(output.stderr);
  if(output.error||output.status!==0)throw Object.assign(output.error??new Error("COMPILER_FAILED"),{status:output.status,stderr:output.stderr});
  return Buffer.alloc(0);
 };
 // Separate cold compiler/test lane; the ordinary compiler-check deadline is unchanged.
 const positive=mode?[toolchain!,"test","--locked","--manifest-path","apps/nalanda-cross-platform/src-tauri/Cargo.toml","--target","x86_64-pc-windows-msvc","--lib"]:command;
 const result=run([...positive,"--features","synthetic-qa"],env);
 if(mode)process.stdout.write(result);
 function refuses(args:string[],inputEnv:NodeJS.ProcessEnv,reason:string){try{run(args,inputEnv);throw Error("UNEXPECTED_COMPILER_ACCEPTANCE");}catch(error){assert((error as {stderr?:Buffer}).stderr?.toString().includes(reason),"EXPECTED_COMPILER_REFUSAL_MISSING");}}
 refuses([...command,"--features","synthetic-qa"],{...env,NALANDA_QA_PROFILE_SHA256:"f".repeat(64)},"QA input substituted after validation");
 refuses(command,env,"Production rejects QA inputs");
 console.log(JSON.stringify({evidence:"UNIT_OR_CONTRACT",fixture:"HARNESS_FIXTURE_ONLY",qaCompile:true,compilerMode:mode??"check",rustToolchain:toolchain??"caller",qaUnitTestsExecuted:Boolean(mode),changedInputRejected:true,productionExclusion:true,artifactAdmission:false,applicationExecuted:false}));
} finally {
 assert(path.dirname(directory)===path.resolve(tmpdir())&&path.basename(directory).startsWith("nalanda-native-qa-compile-"));
 rmSync(directory,{recursive:true});
}
