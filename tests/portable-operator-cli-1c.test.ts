import { mkdtemp, realpath, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect,it } from "vitest";
import { runOperatorCli } from "../scripts/portable/operator";
import { OPERATOR_COMMANDS, type OperatorAdapter,type OperatorReceipt,type OperatorStep,type OperatorManifest,operatorPlan } from "../lib/portable-runtime/operator";
it("dispatches the actual public argv entrypoint across lifecycle/failure/resume scenarios using a bounded adapter",async()=>{
 const root=await realpath(await mkdtemp(path.join(tmpdir(),"nalanda-cli-1c-"))),file=path.join(root,"manifest.json");
 const manifest:OperatorManifest={schemaVersion:1,classification:"INTEGRATION_TEST_ENVIRONMENT",profile:"local-single-node",project:"nalanda-ci-123-adapter",target:path.join(root,"target"),image:"sha256:"+"a".repeat(64),releaseCommit:"a".repeat(40),composeSha256:"b".repeat(64),architecture:"amd64",operationId:"a".repeat(16),postgresMajor:17,backupVersion:48,migration:"20260908220000_student_items_prior_year_concessions_1a",restoreArtifact:{id:"synthetic-artifact",ciphertextSha256:"d".repeat(64)},previous:{image:"sha256:"+"c".repeat(64),releaseCommit:"b".repeat(40),migration:"20260908220000_student_items_prior_year_concessions_1a",backupVersion:48}};
 let receipt:OperatorReceipt|null=null,fail:OperatorStep|null=null;let effects:OperatorStep[]=[],locked=false,qualified=0;
 const preserved={data:"SYNTHETIC",backups:"ENCRYPTED_FIXTURE",keys:"SYNTHETIC_NOT_SECRET"};await writeFile(path.join(root,"preserved.json"),JSON.stringify(preserved));
 const adapter:OperatorAdapter={async preflight(){},async inspectTarget(m){expect(m.target).toBe(manifest.target);},async acquire(){expect(locked).toBe(false);locked=true;},async release(){locked=false;},async readReceipt(){return receipt?structuredClone(receipt):null;},async writeReceipt(r){receipt=structuredClone(r);await writeFile(path.join(root,"receipt.json"),JSON.stringify(r));},async execute(step){if(step===fail)throw Error("ADAPTER_PARTIAL_FAILURE");effects.push(step);},async reconcile(step){return effects.includes(step)?"COMPLETE":"NOT_STARTED";}};
 const dependencies={qualify(m:OperatorManifest){expect(m.releaseCommit).toBe(manifest.releaseCommit);qualified++;},adapter:()=>adapter};
 const invoke=(command:string,apply=false,resume=false)=>runOperatorCli([command,"--manifest",file,"--target",manifest.target,...(apply?["--apply"]:[]),...(resume?["--resume"]:[])],dependencies);
 try{
  await writeFile(file,JSON.stringify(manifest));
  for(const command of OPERATOR_COMMANDS){
   effects=[];receipt=null;
   expect((await invoke(command)).state).toBe("DRY_RUN");expect(receipt).toBeNull();expect(effects).toEqual(command==="doctor"?["validate","migration-status","readiness"]:[]);
   if(command==="preflight"||command==="doctor")continue;
   for(const step of operatorPlan(command,manifest).steps){
    effects=[];receipt=null;fail=step;
    await expect(invoke(command,true)).rejects.toThrow("OPERATOR_STEP_FAILED");expect(JSON.parse(await readFile(path.join(root,"receipt.json"),"utf8")).uncertain).toBe(step);
    fail=null;expect((await invoke(command,true,true)).state).toBe("COMPLETE");const before=[...effects];await invoke(command,true,true);expect(effects).toEqual(before);expect(effects).toEqual(operatorPlan(command,manifest).steps);
    expect(JSON.parse(await readFile(path.join(root,"preserved.json"),"utf8"))).toEqual(preserved);expect(locked).toBe(false);
   }
  }
  expect(qualified).toBeGreaterThan(30);
  const before=JSON.stringify(effects);await writeFile(file,JSON.stringify({...manifest,previous:{...manifest.previous,migration:"20200101000000_incompatible"}}));await expect(invoke("rollback",true)).rejects.toThrow("ROLLBACK_SCHEMA_INCOMPATIBLE");expect(JSON.stringify(effects)).toBe(before);
  await writeFile(file,JSON.stringify(manifest));await expect(runOperatorCli(["install","--manifest",file,"--target",path.join(root,"foreign"),"--apply"],dependencies)).rejects.toThrow("TARGET_MANIFEST_MISMATCH");
  await expect(runOperatorCli(["install","--manifest",file,"--target",manifest.target,"--apply","--apply"],dependencies)).rejects.toThrow("OPERATOR_ARGUMENT_INVALID");
 }finally{if(!root.startsWith(path.join(await realpath(tmpdir()),"nalanda-cli-1c-")))throw Error("CLEANUP_BOUNDARY");await rm(root,{recursive:true});}
},20_000);
it("rejects relative manifest and target paths before qualification",async()=>{
 await expect(runOperatorCli(["install","--manifest","relative.json","--target","relative","--apply"])).rejects.toThrow("EXPLICIT_ABSOLUTE_TARGET_REQUIRED");
});
