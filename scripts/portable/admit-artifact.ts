import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertEphemeralCi } from "./operator-adapter";
import { loadEvidence, verifyArtifactEvidence, hashBytes, assertRuntimeAdmission, assertLocalImage,resolveBaseImages } from "./artifact-handoff";

function qualify(root: string, historicalSource?: string, syntheticTrustBytes?:Buffer) {
  assertEphemeralCi();
  const head=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(head!==process.env.EXPECTED_SHA)throw Error("EXACT_HEAD_REQUIRED");
  const source=historicalSource??head;
  if(historicalSource){
    if(!/^[a-f0-9]{40}$/.test(source)||source===head)throw Error("DISTINCT_HISTORICAL_SOURCE_REQUIRED");
    execFileSync("git",["merge-base","--is-ancestor",source,head],{stdio:"pipe"});
  }
  const architecture=process.env.TARGET_ARCHITECTURE;
  if(architecture!=="amd64"&&architecture!=="arm64")throw Error("NATIVE_ARCHITECTURE_REQUIRED");
  if((process.arch==="x64"?"amd64":process.arch)!==architecture)throw Error("EMULATION_NOT_ADMITTED");
  const input=(file:string)=>historicalSource?execFileSync("git",["show",`${source}:${file}`],{maxBuffer:8*1024*1024}):readFileSync(file);
  const inputs=Object.fromEntries(["Dockerfile","pnpm-lock.yaml","package.json","pnpm-workspace.yaml","deploy/portable/compose.yml"].map(file=>[file,hashBytes(input(file))]));
  if(syntheticTrustBytes) {
    const trust=JSON.parse(syntheticTrustBytes.toString());
    if(historicalSource||trust.contract!=="NALANDA_SYNTHETIC_BUILD_V1"||trust.source!==source||trust.runId!==process.env.GITHUB_RUN_ID||trust.attempt!==process.env.GITHUB_RUN_ATTEMPT)throw Error("SYNTHETIC_TRUST_CONTEXT_MISMATCH");
    inputs["synthetic-build-trust.json"]=hashBytes(syntheticTrustBytes);
  }
  const receipt=verifyArtifactEvidence(loadEvidence(root),{source,architecture,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!,now:Date.now(),inputs,baseImages:resolveBaseImages(input("Dockerfile").toString()),...(syntheticTrustBytes?{purpose:"SYNTHETIC_ACCEPTANCE_ONLY" as const}:{})});
  assertRuntimeAdmission(receipt); // before Docker probes, target creation, secrets or server launch
  const image=JSON.parse(execFileSync("docker",["--context","default","image","inspect",receipt.imageConfigDigest],{encoding:"utf8",timeout:30_000}))[0];
  assertLocalImage(receipt,image);
  return receipt;
}
export const admitArtifact=(root:string)=>qualify(root);
export const admitHistoricalArtifact=(root:string,source:string)=>qualify(root,source);
export const admitSyntheticArtifact=(root:string,trustBytes:Buffer)=>qualify(root,undefined,trustBytes);
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try { const receipt=admitArtifact(path.resolve("artifact-evidence"));writeFileSync("admitted-artifact.json",JSON.stringify(receipt),{flag:"wx",mode:0o600});console.log(receipt.imageConfigDigest); }
  catch(error){console.error(error instanceof Error?error.message:"ARTIFACT_ADMISSION_FAILED");process.exitCode=1;}
}
