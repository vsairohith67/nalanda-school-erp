import { syntheticEvidenceRoot } from "./synthetic-build-lifecycle";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {readFileSync,writeFileSync} from "node:fs";
import path from "node:path";
import {admitSyntheticArtifact} from "./admit-artifact";
import {inspectTarget} from "./integrated-acceptance";
import {integratedBrowser} from "./integrated-browser";

export async function integratedOn(containerId:string){
 const trust=readFileSync(path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`,"trust.json"));
 const artifact=admitSyntheticArtifact(syntheticEvidenceRoot(),trust);
 const target=inspectTarget(artifact,containerId),password=randomBytes(48).toString("base64url");
 const command=(script:string,args:string[]=[],input?:string)=>execFileSync("docker",["--context","default","exec","-i","-e","PORTABLE_ACCEPTANCE_FIXTURE=synthetic-ON",containerId,"/nodejs/bin/node",`dist/portable/${script}.mjs`,...args],{encoding:"utf8",input,stdio:["pipe","pipe","pipe"],timeout:30*60_000,maxBuffer:128*1024});
 const report=JSON.parse(command("integrated-bulk",[],JSON.stringify({password})).trim().split(/\r?\n/).at(-1)!);
 assert.equal(report.classification,"AUTHENTICATED_SYNTHETIC_TEST_IMAGE_HTTP");assert.equal(report.head,artifact.source);target.bind();
 writeFileSync("integrated-on-http-result.json",JSON.stringify({...report,imageConfigDigest:artifact.imageConfigDigest,mandatoryCoverage:"PARTIAL"}),{flag:"wx"});
 const ca=process.env.NODE_EXTRA_CA_CERTS;assert(ca&&path.resolve(ca).startsWith(path.resolve("tmp/portable-staging")+path.sep));assert.notEqual(process.env.NODE_TLS_REJECT_UNAUTHORIZED,"0");
 // Tool dependency is deliberately separate from immutable application bytes.
 // A hosted runner must provide its audited Playwright/Chromium installation
 // and trust the private runner CA. No ignoreHTTPSErrors or source substitution.
 const moduleName="playwright",engine=await import(moduleName);const browser=await engine.chromium.launch({headless:true});
 const probe=(operation:string,input:unknown)=>JSON.parse(command("browser-probe",[operation,Buffer.from(JSON.stringify(input)).toString("base64url")]));
 try{
  const rendered=await integratedBrowser(browser,{origin:"https://portable-staging.localhost:8443",password,totp:async()=>probe("totp",{username:"director"}).token,snapshot:async admission=>probe("student",{admission}),bind:target.bind});
  writeFileSync("integrated-on-browser-result.json",JSON.stringify({source:artifact.source,imageConfigDigest:artifact.imageConfigDigest,rendered,mandatoryCoverage:"PARTIAL",productionImageAcceptance:false}),{flag:"wx"});
 }catch{throw Error("INTEGRATED_BROWSER_FAILED_PRIVATE_DETAILS_WITHHELD");}
 finally{try{await browser.close();}catch{throw Error("INTEGRATED_BROWSER_CLEANUP_FAILED");}}
 // Remaining required scenarios are deliberately ineligible, even if this
 // executable subset succeeds. The closure ledger names each code gap.
 throw Error("INTEGRATED_REQUIRED_SCENARIOS_INCOMPLETE");
}
