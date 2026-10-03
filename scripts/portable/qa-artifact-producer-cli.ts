import {runRootlessBuild,cleanupRootlessBuild} from "./qa-rootless-build";
import {prepareBuildTools} from "./qa-build-tools";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { admitArtifact, admitSyntheticArtifact } from "./admit-artifact";
import { hashBytes } from "./artifact-handoff";
import { assertEphemeralCi } from "./operator-adapter";
import { produceQaArtifact, type ProducerCommand } from "./qa-artifact-producer";
import { cleanupProducerRoot, producerIdentity, producerPaths, validateProducerRoot, type ProducerIdentity } from "./synthetic-build-lifecycle";

export {producerProcess} from "./producer-process";
import {producerProcess} from "./producer-process";

function verifySource(workspace:string,identity:ProducerIdentity){
 const git=(args:string[])=>execFileSync("git",args,{cwd:workspace,encoding:"utf8",stdio:["ignore","pipe","pipe"],maxBuffer:16*1024*1024});
 if(git(["rev-parse","HEAD"]).trim()!==identity.source)throw Error("QA_SOURCE_MISMATCH");
 git(["diff","--exit-code",identity.source,"--"]);
 const tree=git(["ls-tree","-r",identity.source]);
 if(tree.split("\n").some(line=>/^(120000|160000) /.test(line)))throw Error("QA_SOURCE_LINKS_OR_SUBMODULES_REFUSED");
 if(JSON.parse(git(["show",`${identity.source}:config/synthetic-build-trust.json`]))!==null)throw Error("QA_SOURCE_TRUST_NOT_NULL");
 return {fingerprint:hashBytes(tree),epoch:git(["show","-s","--format=%ct",identity.source]).trim()};
}
export async function cleanupProducerResources(workspace:string,identity:ProducerIdentity,execute:typeof producerProcess=producerProcess){
 const paths=producerPaths(workspace,identity);validateProducerRoot(workspace,identity,"work");
 const run=(stage:string,args:string[])=>execute({stage,tool:"docker",args:["--context","default",...args]},workspace);
 const errors:string[]=[];
 try{await cleanupRootlessBuild(workspace,identity);}catch{errors.push("QA_ROOTLESS_BUILDER_RESIDUE");}
 // The caller's finally handles normal teardown; this is the independent,
 // same-run recovery path for cancellation, partial startup and caller failure.
 const receipt=path.join(workspace,".qa-artifacts/portable-ci",`${paths.project}.admission.json`);
 if(existsSync(receipt))try{await execute({stage:"qa-stack-cleanup",tool:process.execPath,args:["--import","tsx",path.join(workspace,"scripts/portable/ci-safety.ts"),"cleanup"],env:{PORTABLE_ACCEPTANCE_PHASE:"synthetic-ON",COMPOSE_PROJECT_NAME:paths.project,PORTABLE_CI_ROOT:path.join(paths.parent,paths.project),PORTABLE_SYNTHETIC_SECRET_ROOT:path.join(paths.parent,paths.project,"secrets")}},workspace);}catch{errors.push("QA_STACK_CLEANUP_REFUSED");}
 const probe=`${paths.project}-${identity.architecture}-native`;
 try{
  const ids=(await run("probe-list",["container","ls","--all","-q","--filter",`name=^/${probe}$`])).trim();
  if(ids){if(!/^[a-f0-9]{12,64}$/.test(ids))throw Error("PROBE_AMBIGUOUS");const item=JSON.parse(await run("probe-inspect",["inspect",ids]))[0];
   if(item.Name!==`/${probe}`||item.Config?.Labels?.["nalanda.ci.run"]!==identity.runId||item.Config?.Labels?.["nalanda.ci.attempt"]!==identity.attempt||item.Config?.Labels?.["nalanda.ci.project"]!==paths.project)throw Error("PROBE_FOREIGN");
   await run("probe-remove",["container","rm","-f",ids]);
  }
  if((await run("probe-readback",["container","ls","--all","-q","--filter",`name=^/${probe}$`])).trim())throw Error("PROBE_REMAINS");
 }catch{errors.push("QA_PROBE_CLEANUP_REFUSED");}
 try{
  const filters=["--filter",`label=io.nalanda.qa-project=${paths.project}`,"--filter",`label=io.nalanda.qa-run=${identity.runId}`,"--filter",`label=io.nalanda.qa-attempt=${identity.attempt}`];
  const ids=[...new Set((await run("image-list",["image","ls","--no-trunc","-q",...filters])).trim().split(/\s+/).filter(Boolean))];
  for(const id of ids){if(!/^sha256:[a-f0-9]{64}$/.test(id))throw Error("IMAGE_ID_INVALID");const item=JSON.parse(await run("image-inspect",["image","inspect",id]))[0];
   if(item.Id!==id||item.Architecture!==identity.architecture||item.Config?.Labels?.["org.opencontainers.image.revision"]!==identity.source||item.Config?.Labels?.["io.nalanda.artifact-purpose"]!=="SYNTHETIC_ACCEPTANCE_ONLY"||item.Config?.Labels?.["io.nalanda.qa-project"]!==paths.project||item.Config?.Labels?.["io.nalanda.qa-run"]!==identity.runId||item.Config?.Labels?.["io.nalanda.qa-attempt"]!==identity.attempt)throw Error("IMAGE_FOREIGN");
   await run("image-remove",["image","rm",id]); // no force, shared prune or mutable tag
  }
  if((await run("image-readback",["image","ls","--no-trunc","-q",...filters])).trim())throw Error("IMAGE_REMAINS");
 }catch{errors.push("QA_IMAGE_CLEANUP_REFUSED");}
 if(errors.length)throw Error(errors.join(";"));
}
async function main(){
 assertEphemeralCi();const identity=producerIdentity(),workspace=process.cwd();
 if((process.arch==="x64"?"amd64":process.arch)!==identity.architecture)throw Error("NATIVE_ARCHITECTURE_REQUIRED");
 if(process.argv[2]==="cleanup"){
  const failures:string[]=[];const paths=producerPaths(workspace,identity);
  if(existsSync(paths.work))try{await cleanupProducerResources(workspace,identity);}catch{failures.push("RUNTIME_RESIDUE");}
  for(const kind of ["signing","work"] as const){if(kind==="work"&&failures.includes("RUNTIME_RESIDUE"))continue;try{cleanupProducerRoot(workspace,identity,kind);}catch{failures.push(`${kind.toUpperCase()}_CLEANUP_REFUSED`);}}
  if(failures.length)throw Error("QA_PRODUCER_CLEANUP_REFUSED_OR_INCOMPLETE");console.log("QA_PRODUCER_OWNED_CLEANUP_VERIFIED");return;
 }
 if(process.argv[2]!=="run"||process.argv.length!==3)throw Error("QA_PRODUCER_ARGUMENT_INVALID");
 verifySource(workspace,identity);
 const cancellation=new AbortController(),stop=()=>cancellation.abort();
 process.once("SIGINT",stop);process.once("SIGTERM",stop);
 try{
  const result=await produceQaArtifact(workspace,identity,{classification:"HOSTED_EXACT_IMAGE_EVIDENCE",signal:cancellation.signal,verifySource:async()=>verifySource(workspace,identity),admitProduction:async()=>admitArtifact(path.join(workspace,"artifact-evidence")),run:async command=>command.stage==="qa-build-tools"?(await prepareBuildTools(workspace,identity,cancellation.signal),""):command.stage==="build"?runRootlessBuild(command,workspace,identity,cancellation.signal):producerProcess(command,workspace,cancellation.signal),admitQa:async(root,trust)=>admitSyntheticArtifact(root,trust),cleanupResources:()=>cleanupProducerResources(workspace,identity)});
  // This single allowlisted result is the only producer output eligible for upload.
  writeFileSync("qa-producer-result.json",JSON.stringify(result),{flag:"wx",mode:0o600});console.log(JSON.stringify(result));if(!result.complete)process.exitCode=1;
 }finally{process.removeListener("SIGINT",stop);process.removeListener("SIGTERM",stop);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void main().catch(()=>{console.error("QA_PRODUCER_REFUSED_OR_FAILED_NO_ADMISSION_INFERRED");process.exitCode=1;});
