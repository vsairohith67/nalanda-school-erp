import {rootlessBuildCommand} from "./qa-rootless-build";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { verifyImageSecurityReports, type verifyArtifactEvidence } from "./artifact-handoff";
import { cleanupProducerRoot, createProducerRoot, prepareSigningRoot, producerPaths, readSigningRoot, validateProducerRoot, type ProducerIdentity } from "./synthetic-build-lifecycle";

type Receipt=ReturnType<typeof verifyArtifactEvidence>;
export type ProducerCommand={stage:string;tool:string;args:string[];env?:Partial<NodeJS.ProcessEnv>;timeoutMs?:number};
/** Process ports model external tools only. No CLI switch installs a harness
 * adapter; harness receipts remain ineligible in the real admission function. */
export type ProducerPorts={
 classification:"HOSTED_EXACT_IMAGE_EVIDENCE"|"HARNESS_FIXTURE_ONLY";
 verifySource:()=>Promise<{fingerprint:string;epoch:string}>;
 admitProduction:()=>Promise<Receipt>;
 run:(command:ProducerCommand)=>Promise<string>;
 admitQa:(root:string,trust:Buffer)=>Promise<Receipt>;
 cleanupResources:(work:string,identity:ProducerIdentity)=>Promise<void>;
 signal?:AbortSignal;
};
export async function produceQaArtifact(workspace:string,identity:ProducerIdentity,ports:ProducerPorts) {
 const paths=producerPaths(workspace,identity),states:string[]=[];
 let stage="source",workOwned=false,signerOwned=false,produced=false,callerCompleted=false;
 let imageConfigDigest:string|undefined, failure:string|undefined;
 const cleanupRefusals:string[]=[];
 const baseline=await ports.verifySource();
 if(!/^[a-f0-9]{64}$/.test(baseline.fingerprint)||!/^\d+$/.test(baseline.epoch))throw Error("QA_SOURCE_INPUTS_INVALID");
 const production=await ports.admitProduction(); // before secrets, context, build or probes
 assert.equal(production.source,identity.source);assert.equal(production.architecture,identity.architecture);
 assert.equal(production.runId,identity.runId);assert.equal(production.attempt,identity.attempt);
 assert.equal(production.classification,ports.classification);
 const guard=async()=>{if(ports.signal?.aborted)throw Error("QA_PRODUCER_CANCELLED");assert.deepEqual(await ports.verifySource(),baseline,"QA_SOURCE_CHANGED");};
 const run=async(command:ProducerCommand)=>{stage=command.stage;await guard();const result=await ports.run(command);states.push(stage);return result;};
 const node=(name:string,args:string[]=[],env?:Partial<NodeJS.ProcessEnv>):ProducerCommand=>({stage:name,tool:process.execPath,args:["--import","tsx",path.join(workspace,"scripts/portable",`${name}.ts`),...args],env});
 try{
  await guard();stage="create-work";createProducerRoot(workspace,identity,"work");workOwned=true;
  await run(node("qa-build-tools"));
  stage="create-signer";createProducerRoot(workspace,identity,"signing");signerOwned=true;
  stage="prepare-signing";prepareSigningRoot(workspace,identity);
  const signing=readSigningRoot(workspace,identity),publicTrust=signing.bytes.toString("base64url");
  const context=path.join(paths.work,"context");mkdirSync(context,{mode:0o700});
  await run({stage:"archive",tool:"git",args:["archive","--format=tar",`--output=${path.join(paths.work,"source.tar")}`,identity.source]});
  await run({stage:"extract",tool:"tar",args:["-xf",path.join(paths.work,"source.tar"),"-C",context]});
  assert.equal(JSON.parse(readFileSync(path.join(context,"config/synthetic-build-trust.json"),"utf8")),null,"SOURCE_QA_TRUST_MUST_BE_NULL");
  await run(rootlessBuildCommand(paths.work,identity,baseline.epoch,publicTrust,signing.sha256));
  await run({stage:"load",tool:"docker",args:["--context","default","load","--input",path.join(paths.work,"image.tar")]});
  imageConfigDigest=readFileSync(path.join(paths.work,"image.id"),"utf8").trim();assert(/^sha256:[a-f0-9]{64}$/.test(imageConfigDigest),"QA_IMAGE_ID_INVALID");assert.notEqual(imageConfigDigest,production.imageConfigDigest,"DISTINCT_QA_ARTIFACT_REQUIRED");
  const image=JSON.parse(await run({stage:"inspect",tool:"docker",args:["--context","default","image","inspect",imageConfigDigest]}))[0];
  assert.equal(image.Id,imageConfigDigest);assert.equal(image.Architecture,identity.architecture);assert.equal(image.Os,"linux");assert.equal(image.Config?.User,"65532:65532");
  for(const [key,value] of Object.entries({"org.opencontainers.image.revision":identity.source,"io.nalanda.artifact-purpose":"SYNTHETIC_ACCEPTANCE_ONLY","io.nalanda.synthetic-trust-sha256":signing.sha256,"io.nalanda.qa-project":paths.project,"io.nalanda.qa-run":identity.runId,"io.nalanda.qa-attempt":identity.attempt}))assert.equal(image.Config.Labels[key],value,"QA_IMAGE_LABEL_MISMATCH");
  const trivy=path.join(paths.work,"trivy-results.json"),grype=path.join(paths.work,"grype-results.json");
  await run({stage:"sbom",tool:"syft",args:[`docker:${imageConfigDigest}`,"-o",`spdx-json=${path.join(paths.work,"sbom.spdx.json")}`],env:{SYFT_CACHE_DIR:path.join(paths.work,"syft-cache"),SYFT_CHECK_FOR_APP_UPDATE:"false"}});
  await run({stage:"trivy",tool:"trivy",args:["image","--cache-dir",path.join(paths.work,"trivy-cache"),"--format","json","--output",trivy,"--list-all-pkgs","--severity","HIGH,CRITICAL","--ignore-unfixed=false","--exit-code","1",imageConfigDigest]});
  await run({stage:"grype",tool:"grype",args:[`docker:${imageConfigDigest}`,"--output","json","--file",grype,"--fail-on","high","--only-fixed=false"],env:{GRYPE_DB_CACHE_DIR:path.join(paths.work,"grype-cache")}});
  // Native execution occurs only after both mandatory scanners exited zero;
  // raw evidence is still parsed and checked by capture/admission below.
  await run({stage:"scanner-metadata",tool:process.execPath,args:[path.join(workspace,"scripts/portable/scanner-metadata.mjs"),path.join(paths.work,"scanner-metadata.json"),grype],env:{TRIVY_CACHE_DIR:path.join(paths.work,"trivy-cache"),GRYPE_DB_CACHE_DIR:path.join(paths.work,"grype-cache"),TRIVY_ACTION_OUTCOME:"success",GRYPE_ACTION_OUTCOME:"success"}});
  stage="validate-security-reports";
  const securityFiles=Object.fromEntries([["trivy.json",trivy],["grype.json",grype],["sbom.json",path.join(paths.work,"sbom.spdx.json")],["scanner-metadata.json",path.join(paths.work,"scanner-metadata.json")]].map(([name,file])=>[name,readFileSync(file)]));
  verifyImageSecurityReports(securityFiles,imageConfigDigest,Date.now(),JSON.parse(securityFiles["scanner-metadata.json"].toString()).trivy?.version);
  const probe=`${paths.project}-${identity.architecture}-native`;
  const rawProbe=await run({stage:"native-probe",tool:"docker",args:["--context","default","run","--rm","--name",probe,"--label",`nalanda.ci.run=${identity.runId}`,"--label",`nalanda.ci.attempt=${identity.attempt}`,"--label",`nalanda.ci.project=${paths.project}`,"--memory","512m","--cpus","1","--pids-limit","64","--cap-drop","ALL","--security-opt","no-new-privileges:true","--network","none","--read-only","--entrypoint","/nodejs/bin/node","--mount",`type=bind,source=${path.join(context,"scripts/portable/native-probe.cjs")},target=/probe.cjs,readonly`,imageConfigDigest,"/probe.cjs"]});
  const native=JSON.parse(rawProbe);assert.equal(native.nativeLoad,"PASSED");assert.equal(native.platform,"linux");assert.equal(native.architecture==="x64"?"amd64":native.architecture,identity.architecture);assert.equal(native.emulationUsed,false);
  writeFileSync(path.join(paths.work,"native-dependencies.json"),JSON.stringify({...native,imageConfigDigest}),{flag:"wx",mode:0o600});
  await run({stage:"oci",tool:"skopeo",args:["copy",`docker-daemon:${imageConfigDigest}`,`oci:${path.join(paths.work,"oci-layout")}:qa`]});
  assert.equal(readSigningRoot(workspace,identity).sha256,signing.sha256,"QA_SIGNER_CHANGED");
  await run(node("capture-artifact-evidence",["--synthetic",path.join(paths.signing,"trust.json")]));
  stage="admission";await guard();const qa=await ports.admitQa(path.join(paths.work,"evidence"),signing.bytes);
  assert.equal(qa.classification,ports.classification);assert.equal(qa.source,identity.source);assert.equal(qa.architecture,identity.architecture);assert.equal(qa.runId,identity.runId);assert.equal(qa.attempt,identity.attempt);assert.equal(qa.imageConfigDigest,imageConfigDigest);assert.equal(qa.inputs["synthetic-build-trust.json"],signing.sha256);assert.notEqual(qa.imageConfigDigest,production.imageConfigDigest);
  produced=true;states.push("admission");
  assert.equal(readSigningRoot(workspace,identity).sha256,signing.sha256,"QA_SIGNER_CHANGED");validateProducerRoot(workspace,identity,"work");
  const browserEnv={PLAYWRIGHT_BROWSERS_PATH:path.join(paths.work,"browser")};
  await run({stage:"browser-install",tool:"pnpm",args:["exec","playwright","install","chromium"],env:browserEnv});
  await run(node("qa-synthetic-stack",[],browserEnv));callerCompleted=true;
 }catch{failure=`QA_PRODUCER_FAILED_AT_${stage.toUpperCase().replace(/[^A-Z0-9]/g,"_")}`;if(stage==="create-work"&&existsSync(paths.work))cleanupRefusals.push("WORK_CREATION_REFUSED_OR_RESIDUE");if(stage==="create-signer"&&existsSync(paths.signing))cleanupRefusals.push("SIGNING_CREATION_REFUSED_OR_RESIDUE");}
 finally{
  // Every independent cleanup is attempted. A refusal never becomes success.
  if(workOwned)try{await ports.cleanupResources(paths.work,identity);}catch{cleanupRefusals.push("OWNED_RUNTIME_RESIDUE");}
  if(signerOwned)try{cleanupProducerRoot(workspace,identity,"signing");}catch{cleanupRefusals.push("SIGNING_ROOT_REFUSED_OR_REMAINS");}
  if(workOwned&&!cleanupRefusals.includes("OWNED_RUNTIME_RESIDUE"))try{cleanupProducerRoot(workspace,identity,"work");}catch{cleanupRefusals.push("WORK_ROOT_REFUSED_OR_REMAINS");}
  else if(workOwned)cleanupRefusals.push("WORK_ROOT_RETAINED_FOR_RECONCILIATION");
 }
 // Allowlisted metadata only; never return raw process output, paths or keys.
 return {contract:"NALANDA_QA_PRODUCER_RESULT_V1",classification:ports.classification,...identity,productionAcceptance:false,artifactProducedAndAdmitted:produced,callerCompleted,cleanupComplete:cleanupRefusals.length===0,failure:failure??null,cleanupRefusals,completedStages:states,imageConfigDigest:imageConfigDigest??null,complete:!failure&&callerCompleted&&cleanupRefusals.length===0};
}
