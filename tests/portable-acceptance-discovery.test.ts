import {execFileSync,spawnSync} from "node:child_process";
import {mkdtempSync,writeFileSync,readdirSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import path from "node:path";
import {it,expect} from "vitest";
import {INTEGRATED_SCENARIOS,BROWSER_MATRIX,validateHttpFixture} from "../scripts/portable/integrated-acceptance";
import {OPERATOR_SCENARIOS} from "../scripts/portable/operator-acceptance";
it("discovers runnable and pending scenarios without an application launch",()=>{
 for(const script of ["operator-acceptance","integrated-acceptance"]){const result=execFileSync(process.execPath,["--import","tsx",`scripts/portable/${script}.ts`,"--discover"],{encoding:"utf8",timeout:20_000});expect(()=>JSON.parse(result)).not.toThrow();}
 expect(OPERATOR_SCENARIOS.map(s=>s.command)).toContain("backup");expect(BROWSER_MATRIX).toHaveLength(6);expect(INTEGRATED_SCENARIOS.syntheticOn).toContain("stale-preview-concurrent-edit");
},45_000);
it("rejects off-fixture source, production endpoint and unreviewed mode",()=>{
 const f={contract:"NALANDA_INTEGRATED_HTTP_FIXTURE_V1",source:"a".repeat(40),phase:"production-OFF",origin:"https://portable-staging.localhost:8443",containerId:"b".repeat(64),username:"synthetic-admin",studentId:"s",templateId:"t",requestId:"r",assessmentId:"a"};expect(validateHttpFixture(f,f.source)).toEqual(f);
 for(const delta of [{source:"b".repeat(40)},{phase:"synthetic-ON"},{origin:"https://school.example:8443"},{username:"director"},{contract:"UNKNOWN"}])expect(()=>validateHttpFixture({...f,...delta},f.source)).toThrow();
});
it("the actual CLI process refuses unavailable qualification before creating targets",()=>{
 const root=mkdtempSync(path.join(tmpdir(),"nalanda-1c-process-")),target=path.join(root,"target"),file=path.join(root,"manifest.json");
 try{
  writeFileSync(file,JSON.stringify({schemaVersion:1,classification:"INTEGRATION_TEST_ENVIRONMENT",profile:"local-single-node",project:"nalanda-ci-123-process",target,image:"sha256:"+"a".repeat(64),releaseCommit:"a".repeat(40),composeSha256:"b".repeat(64),architecture:"amd64",operationId:"a".repeat(16),postgresMajor:17,backupVersion:48,migration:"20260908220000_student_items_prior_year_concessions_1a"}));
  const before=readdirSync(root);const result=spawnSync(process.execPath,["--import","tsx","scripts/portable/operator.ts","install","--manifest",file,"--target",target,"--apply"],{encoding:"utf8",timeout:20_000,env:{...process.env,GITHUB_ACTIONS:"false"}});
  expect(result.status).toBe(1);expect(result.stderr).toContain("OPERATOR_COMMAND_FAILED");expect(readdirSync(root)).toEqual(before);
 }finally{if(!root.startsWith(path.join(tmpdir(),"nalanda-1c-process-")))throw Error("CLEANUP_BOUNDARY");rmSync(root,{recursive:true});}
},25_000);
