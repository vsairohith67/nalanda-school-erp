/** HARNESS_FIXTURE_ONLY. Compiler/production-exclusion checks; no app launch,
 * artifact admission, certificate-store mutation, or publication. */
import {execFileSync} from "node:child_process";
import {generateKeyPairSync,createHash,X509Certificate} from "node:crypto";
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import {NATIVE_QA_ORIGIN,NATIVE_QA_PATHS,signNativeQaProfile,type NativeQaProfile} from "./native-qa-profile";
import type {SyntheticBuildTrust} from "../../lib/portable-runtime/synthetic-capability";
assert.equal(process.platform,"win32","WINDOWS_COMPILER_CONTRACT_REQUIRED");
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
 const command=["check","--locked","--manifest-path","apps/nalanda-cross-platform/src-tauri/Cargo.toml"];
 const run=(args:string[],inputEnv:NodeJS.ProcessEnv)=>execFileSync("cargo",args,{env:inputEnv,stdio:"pipe",timeout:180000,maxBuffer:4*1024*1024});
 run([...command,"--features","synthetic-qa"],env);
 function refuses(args:string[],inputEnv:NodeJS.ProcessEnv,reason:string){try{run(args,inputEnv);throw Error("UNEXPECTED_COMPILER_ACCEPTANCE");}catch(error){assert((error as {stderr?:Buffer}).stderr?.toString().includes(reason),"EXPECTED_COMPILER_REFUSAL_MISSING");}}
 refuses([...command,"--features","synthetic-qa"],{...env,NALANDA_QA_PROFILE_SHA256:"f".repeat(64)},"QA input substituted after validation");
 refuses(command,env,"Production rejects QA inputs");
 console.log(JSON.stringify({evidence:"UNIT_OR_CONTRACT",fixture:"HARNESS_FIXTURE_ONLY",qaCompile:true,changedInputRejected:true,productionExclusion:true,artifactAdmission:false,applicationExecuted:false}));
} finally {
 assert(path.dirname(directory)===path.resolve(tmpdir())&&path.basename(directory).startsWith("nalanda-native-qa-compile-"));
 rmSync(directory,{recursive:true});
}
