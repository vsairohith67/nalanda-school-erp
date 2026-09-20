import { syntheticEvidenceRoot } from "./synthetic-build-lifecycle";
import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync} from "node:fs";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import {admitArtifact,admitSyntheticArtifact} from "./admit-artifact";
import {assertRunningImage} from "./artifact-handoff";

/** Consumes separately qualified same-run production and QA artifacts; it never
 * builds, retags, patches running code, reuses a target or grants admission. */
async function main(){
 const trustPath=path.resolve("tmp/portable-staging",`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-capability`,"trust.json");
 const trust=readFileSync(trustPath);
 const production=admitArtifact(path.resolve("artifact-evidence"));
 const qa=admitSyntheticArtifact(syntheticEvidenceRoot(),trust);
 assert.notEqual(production.imageConfigDigest,qa.imageConfigDigest,"DISTINCT_QA_ARTIFACT_REQUIRED");
 const project=`nalanda-ci-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-qaon`,root=path.resolve("tmp/portable-staging",project);
 const env:NodeJS.ProcessEnv={...process.env,PORTABLE_ACCEPTANCE_PHASE:"synthetic-ON",COMPOSE_PROJECT_NAME:project,PORTABLE_CI_ROOT:root,PORTABLE_SYNTHETIC_SECRET_ROOT:path.join(root,"secrets"),PORTABLE_SOURCE_SHA:qa.source,NALANDA_SYNTHETIC_STAGING:"true",PORTABLE_IMAGE_ID:qa.imageConfigDigest};
 const run=(exe:string,args:string[],overrides:NodeJS.ProcessEnv={NODE_ENV:process.env.NODE_ENV})=>execFileSync(exe,args,{env:{...env,...overrides},encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:4*1024*1024,timeout:20*60_000});
 const node=(script:string,args:string[]=[],overrides?:NodeJS.ProcessEnv)=>run(process.execPath,["--import","tsx",`scripts/portable/${script}.ts`,...args],overrides);
 let admitted=false;
 try{
  node("ci-safety",["prepare"]);admitted=true;
  run(process.execPath,["scripts/portable/generate-synthetic-secrets.mjs"]);
  node("prepare-infrastructure",["--synthetic"]); // exact references, fresh scans in phase-specific evidence
  const fontPath=path.resolve(process.env.CERTIFICATE_GEORGIA_BOLD_PATH??"");
  assert(lstatSync(fontPath).isFile()&&!lstatSync(fontPath).isSymbolicLink()&&realpathSync(fontPath)===fontPath,"LICENSED_GEORGIA_INPUT_REQUIRED");
  const fontBytes=readFileSync(fontPath);assert(fontBytes.length>10000&&fontBytes.length<4*1024*1024);
  const font=(fontkit as any).create(fontBytes);assert.equal(font.familyName,"Georgia");assert(/bold/i.test(font.subfamilyName));
  mkdirSync(path.join(root,"qa-font"),{mode:0o700});writeFileSync(path.join(root,"qa-font","georgiab.ttf"),fontBytes,{flag:"wx",mode:0o444});
  node("synthetic-compose");const compose=path.join(root,"synthetic-compose.json");
  run("docker",["--context","default","compose","--project-name",project,"-f",compose,"up","--no-build","--pull","never","-d","--wait","reverse-proxy"]);
  const ids=["web-1","web-2"].map(service=>run("docker",["--context","default","compose","--project-name",project,"-f",compose,"ps","-q",service]).trim());
  for(const id of ids){assert(/^[a-f0-9]{64}$/.test(id));assertRunningImage(qa,JSON.parse(run("docker",["--context","default","inspect",id]))[0]);}
  node("synthetic-capability",["issue",ids[0]]);
  // Trust only this private CA in a newly owned browser profile; never alter
  // the host certificate store or use a TLS-validation bypass.
  const browserHome=path.join(root,"browser-home"),nss=path.join(browserHome,".pki","nssdb"),ca=path.join(root,"qa-ca","root.crt");
  mkdirSync(nss,{recursive:true,mode:0o700});
  run("certutil",["-N","--empty-password","-d",`sql:${nss}`]);
  run("certutil",["-A","-d",`sql:${nss}`,"-n","nalanda-private-run-ca","-t","C,,","-i",ca]);
  const browserPath=process.env.PLAYWRIGHT_BROWSERS_PATH;assert(browserPath&&path.isAbsolute(browserPath)&&realpathSync(browserPath)===browserPath,"AUDITED_BROWSER_INSTALLATION_REQUIRED");
  node("integrated-acceptance",["--run-on",ids[0]],{NODE_ENV:"production",NODE_EXTRA_CA_CERTS:ca,HOME:browserHome,PLAYWRIGHT_BROWSERS_PATH:browserPath});
 }finally{
  // ci-safety owns only this fresh project; it verifies all containers, networks,
  // volumes and private font/key/CA/fixture files are removed. Input images and
  // retained evidence are not deleted by this driver.
  if(admitted)node("ci-safety",["cleanup"]);
 }
}
void main().catch(()=>{console.error("SYNTHETIC_STACK_FAILED_OR_REQUIRED_COVERAGE_INCOMPLETE");process.exitCode=1;});
