import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {execFileSync} from "node:child_process";
import {existsSync,lstatSync,mkdirSync,readFileSync,realpathSync,rmSync,writeFileSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {admitArtifact} from "./admit-artifact";
import {validateOperatorFixture} from "../../lib/portable-runtime/operator-fixture";
import {operatorAcceptance} from "./operator-acceptance";

/** One private host service-test fixture. No image rebuild, application server,
 * public fixture upload, guessed newest directory or source database reuse. */
export async function withOperatorFixture(){
 const artifact=admitArtifact(path.resolve("artifact-evidence"));
 const identity={source:artifact.source,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!};
 const id=randomUUID(),root=path.resolve("tmp/recovery-1c-restores",id);
 const locatorRoot=path.resolve("tmp/recovery-1d-operator-fixture",`${identity.runId}-${identity.attempt}`);
 for(const directory of [root,locatorRoot]){
  assert(!existsSync(directory),"OPERATOR_FIXTURE_ROOT_NOT_FRESH");
  mkdirSync(path.dirname(directory),{recursive:true,mode:0o700});assert.equal(realpathSync(path.dirname(directory)),path.dirname(directory));
  mkdirSync(directory,{mode:0o700});assert.equal(realpathSync(directory),directory);
  writeFileSync(path.join(directory,"owner.json"),JSON.stringify({...identity,id}),{flag:"wx",mode:0o600});
 }
 const oldRoot=process.env.PORTABLE_OPERATOR_FIXTURE_ROOT;
 try{
  const locator=path.join(locatorRoot,"locator.json");
  const url="file:"+path.join(root,"preparation.db").replaceAll("\\","/");
  writeFileSync(path.join(root,"preparation.db"),"",{flag:"wx",mode:0o600});
  const env:NodeJS.ProcessEnv={...process.env,NODE_ENV:"test",DATABASE_PROVIDER:"sqlite",DATABASE_URL:url,DIRECT_URL:url,PORTABLE_OPERATOR_MATRIX_ID:id,PORTABLE_OPERATOR_FIXTURE_LOCATOR:locator};
  // Host client generation cannot change the already admitted application image.
  // The hosted job owns process lifetime; stdout/stderr stay private even on failure.
  execFileSync(process.execPath,["node_modules/prisma/build/index.js","generate","--schema","prisma/schema.prisma"],{env,stdio:"pipe",maxBuffer:4*1024*1024});
  execFileSync(process.execPath,["node_modules/vitest/vitest.mjs","run","tests/recovery-backup-compatibility.test.ts","--maxWorkers=1"],{env,stdio:"pipe",maxBuffer:8*1024*1024});
  const located=JSON.parse(readFileSync(locator,"utf8"));assert.equal(located.root,root,"OPERATOR_FIXTURE_LOCATOR_MISMATCH");
  validateOperatorFixture(readFileSync(path.join(root,"source-v48.json")),JSON.parse(readFileSync(path.join(root,"operator-fixture.json"),"utf8")),identity);
  process.env.PORTABLE_OPERATOR_FIXTURE_ROOT=root;
  return await operatorAcceptance();
 }finally{
  if(oldRoot===undefined)delete process.env.PORTABLE_OPERATOR_FIXTURE_ROOT;else process.env.PORTABLE_OPERATOR_FIXTURE_ROOT=oldRoot;
  for(const directory of [root,locatorRoot]){
   assert(!lstatSync(directory).isSymbolicLink()&&realpathSync(directory)===directory,"OPERATOR_FIXTURE_CLEANUP_PATH");
   assert.deepEqual(JSON.parse(readFileSync(path.join(directory,"owner.json"),"utf8")),{...identity,id},"OPERATOR_FIXTURE_CLEANUP_OWNER");
   rmSync(directory,{recursive:true});assert(!existsSync(directory),"OPERATOR_FIXTURE_CLEANUP_RESIDUE");
  }
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void withOperatorFixture().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error("PRIVATE_OPERATOR_FIXTURE_OR_LIFECYCLE_FAILED");process.exitCode=1;});
