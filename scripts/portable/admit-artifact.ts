import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { assertEphemeralCi } from "./operator-adapter";
import { loadEvidence, verifyArtifactEvidence, hashBytes, assertRuntimeAdmission, assertLocalImage,resolveBaseImages } from "./artifact-handoff";

export function admitArtifact(root: string) {
  assertEphemeralCi();
  const source=execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim();
  if(source!==process.env.EXPECTED_SHA)throw Error("EXACT_HEAD_REQUIRED");
  const architecture=process.env.TARGET_ARCHITECTURE;
  if(architecture!=="amd64"&&architecture!=="arm64")throw Error("NATIVE_ARCHITECTURE_REQUIRED");
  if((process.arch==="x64"?"amd64":process.arch)!==architecture)throw Error("EMULATION_NOT_ADMITTED");
  const inputs=Object.fromEntries(["Dockerfile","pnpm-lock.yaml","package.json","pnpm-workspace.yaml","deploy/portable/compose.yml"].map(file=>[file,hashBytes(readFileSync(file))]));
  const receipt=verifyArtifactEvidence(loadEvidence(root),{source,architecture,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!,now:Date.now(),inputs,baseImages:resolveBaseImages(readFileSync("Dockerfile","utf8"))});
  assertRuntimeAdmission(receipt); // before Docker probes, target creation, secrets or server launch
  const image=JSON.parse(execFileSync("docker",["--context","default","image","inspect",receipt.imageConfigDigest],{encoding:"utf8",timeout:30_000}))[0];
  assertLocalImage(receipt,image);
  return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try { const receipt=admitArtifact(path.resolve("artifact-evidence"));writeFileSync("admitted-artifact.json",JSON.stringify(receipt),{flag:"wx",mode:0o600});console.log(receipt.imageConfigDigest); }
  catch(error){console.error(error instanceof Error?error.message:"ARTIFACT_ADMISSION_FAILED");process.exitCode=1;}
}
