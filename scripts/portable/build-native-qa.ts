import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {readFileSync} from "node:fs";
import path from "node:path";
import {createRequire} from "node:module";
import {readNativeQaInput,validateNativeQaProfile} from "./native-qa-profile";
import {hashBytes} from "./artifact-handoff";

/** Consumes public inputs produced by admitted Linux issue-native. Transport of
 * these private run inputs and final native provenance admission belong to W1A.
 * This command never downloads, publishes, or launches the resulting package. */
export function buildNativeQa(directory:string) {
 assert.equal(process.platform,"win32");assert.equal(process.env.GITHUB_ACTIONS,"true");
 assert.equal(process.env.RUNNER_ENVIRONMENT,"github-hosted");assert.equal(process.env.PORTABLE_CI_EXCEPTION,"OWNER_AUTHORIZED");
 assert.equal(process.env.GITHUB_REPOSITORY,"vsairohith67/nalanda-school-erp");
 const root=path.resolve(directory),trust=readNativeQaInput(path.join(root,"trust.json")),envelope=readNativeQaInput(path.join(root,"profile.json"));
 const trustDigest=hashBytes(JSON.stringify(trust)),profileDigest=hashBytes(JSON.stringify(envelope));
 // Producer writes canonical JSON. Refuse reserialization/substitution between
 // validation and build; Cargo hashes the same bytes immediately before copying.
 assert.equal(hashBytes(readFileSync(path.join(root,"trust.json"))),trustDigest);
 assert.equal(hashBytes(readFileSync(path.join(root,"profile.json"))),profileDigest);
 const p=validateNativeQaProfile(trust,envelope),source=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
 assert.equal(p.source,source);assert.equal(source,process.env.EXPECTED_SHA);assert.equal(p.runId,process.env.GITHUB_RUN_ID);assert.equal(p.attempt,process.env.GITHUB_RUN_ATTEMPT);
 assert.equal(p.nativeBuildId,hashBytes(JSON.stringify({source,runId:p.runId,attempt:p.attempt,backendBuildId:p.buildId,profile:"synthetic-qa",architecture:"x64"})));
 // Trust hash MUST come from the retained, admitted backend build evidence, not
 // from the downloaded inputs. Final native bytes are separately admitted later.
 assert.equal(hashBytes(readFileSync(path.join(root,"trust.json"))),process.env.NATIVE_QA_ADMITTED_TRUST_SHA256);
 const changed=execFileSync("git",["status","--porcelain","--untracked-files=no"],{encoding:"utf8"});assert.equal(changed.trim(),"","NATIVE_QA_CLEAN_SOURCE_REQUIRED");
 const app=path.resolve("apps/nalanda-cross-platform"),require=createRequire(path.join(app,"package.json"));
 const cli=path.join(path.dirname(require.resolve("@tauri-apps/cli/package.json")),"tauri.js");
 execFileSync(process.execPath,[cli,"build","--features","synthetic-qa","--target","x86_64-pc-windows-msvc","--bundles","nsis"],{cwd:app,env:{...process.env,NALANDA_NATIVE_PROFILE:"SYNTHETIC_QA",NALANDA_QA_INPUT_DIRECTORY:root,NALANDA_QA_PROFILE_SHA256:profileDigest,NALANDA_QA_TRUST_SHA256:trustDigest},stdio:["ignore","pipe","pipe"],windowsHide:true,timeout:1800000,maxBuffer:4*1024*1024});
 validateNativeQaProfile(trust,envelope);
 return {state:"QA_NATIVE_COMPILED_NOT_ADMITTED",source,nativeBuildId:p.nativeBuildId,profileSha256:hashBytes(JSON.stringify(envelope))};
}
if(/(?:^|[\\/])build-native-qa\.(?:ts|mjs)$/.test(process.argv[1]??"")){
 try{assert(process.argv.length===3);console.log(JSON.stringify(buildNativeQa(process.argv[2])));}catch{console.error("NATIVE_QA_BUILD_REFUSED");process.exitCode=1;}
}
