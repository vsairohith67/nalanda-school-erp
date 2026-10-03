import {spawn} from "node:child_process";
import {existsSync,mkdirSync,readFileSync,writeFileSync,lstatSync,realpathSync} from "node:fs";
import path from "node:path";
import {producerProcess,startProductDaemon,type ProductProcessReceipt} from "./producer-process";
import {verifiedBuildTools} from "./qa-build-tool-core";
import {validateProducerRoot,type ProducerIdentity,type ProducerProfile} from "./synthetic-build-lifecycle";
import type {ProducerCommand} from "./qa-artifact-producer";

const pause=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
export type RootlessOptions={profile:ProducerProfile;run:typeof producerProcess;tools:()=>{work:string;bin:string;rootless:string};environment:NodeJS.ProcessEnv;daemonSequence?:number;daemonOutcome?:(receipt:ProductProcessReceipt|null)=>void};
export function assertEmptyBuildCache(raw:string){const records=JSON.parse(raw);if(records!==null&&(!Array.isArray(records)||records.length!==0))throw Error("QA_BUILD_CACHE_REMAINS");}
function processIdentity(pid:number){
 try{const raw=readFileSync(`/proc/${pid}/stat`,"utf8"),fields=raw.slice(raw.lastIndexOf(")")+2).split(" ");return {state:fields[0],group:Number(fields[2]),start:fields[19]};}
 catch(error){if((error as NodeJS.ErrnoException).code==="ENOENT")return null;throw error;}
}
async function stopDaemon(pid:number,start:string){
 for(const signal of ["SIGTERM","SIGKILL"] as const){
  const current=processIdentity(pid);if(!current||current.state==="Z")return;
  if(current.start!==start||current.group!==pid)throw Error("QA_BUILDER_PID_REUSED_OR_FOREIGN");
  try{process.kill(-pid,signal);}catch(error){if((error as NodeJS.ErrnoException).code==="ESRCH")return;throw error;}for(let i=0;i<50;i++){const state=processIdentity(pid);if(!state||state.state==="Z")return;await pause(20);}
 }
 const after=processIdentity(pid);if(after&&after.state!=="Z")throw Error("QA_BUILDER_PROCESS_REMAINS");
}
export {rootlessBuildCommand} from "./rootless-build-command";
/** Recovery uses PID+kernel start time, never PID alone, and only this root's socket. */
export async function cleanupRootlessBuild(workspace:string,identity:ProducerIdentity,options?:RootlessOptions){
 const work=validateProducerRoot(workspace,identity,"work",options?.profile),recordFile=path.join(work,"buildkit-process.json");
 if(!existsSync(recordFile)){
  if(["buildkit-starting.json","buildkit-cache","rootless-state","buildkit.sock"].some(name=>existsSync(path.join(work,name))))throw Error("QA_BUILDER_STARTUP_UNRECONCILED");
  return;
 }
 if(lstatSync(recordFile).isSymbolicLink()||realpathSync(recordFile)!==recordFile)throw Error("QA_BUILDER_OWNER_UNSAFE");
 const record=JSON.parse(readFileSync(recordFile,"utf8"));
 if(record.source!==identity.source||record.runId!==identity.runId||record.attempt!==identity.attempt||record.architecture!==identity.architecture||!Number.isSafeInteger(record.pid)||record.pid<2||!/^\d+$/.test(record.start))throw Error("QA_BUILDER_OWNER_MISMATCH");
 const current=processIdentity(record.pid);
 if(current&&current.state!=="Z"&&(current.start!==record.start||current.group!==record.pid))throw Error("QA_BUILDER_PID_REUSED_OR_FOREIGN");
 let pruned=record.cachePruned===true;
 if(current&&current.state!=="Z"){
  const {bin}=options?options.tools():verifiedBuildTools(workspace,identity),addr=`unix://${path.join(work,"buildkit.sock")}`,run=options?.run??producerProcess;
  try{
   // This daemon owns a fresh storage root, so --all cannot touch shared cache.
   await run({stage:"owned-buildkit-prune",tool:path.join(bin,"buildctl"),args:["--addr",addr,"prune","--all"],timeoutMs:30_000},workspace);
   const remaining=await run({stage:"owned-buildkit-du",tool:path.join(bin,"buildctl"),args:["--addr",addr,"du","--format","{{json .}}"],timeoutMs:30_000},workspace);
   assertEmptyBuildCache(remaining);pruned=true;
  }catch{pruned=false;}
  // No more writers may outlive cleanup, even when pruning fails.
  await stopDaemon(record.pid,record.start);
 }
 const after=processIdentity(record.pid);if(after&&after.state!=="Z")throw Error("QA_BUILDER_PROCESS_REMAINS");
 // Refuse host mount residue; normal PID/user namespace teardown removes the
 // daemon's private mounts. Never unmount arbitrary host paths as a workaround.
 if(readFileSync("/proc/self/mountinfo","utf8").split("\n").some(line=>line.includes(work.replaceAll(" ","\\040"))))throw Error("QA_BUILDER_MOUNT_REMAINS");
 writeFileSync(recordFile,JSON.stringify({...record,cachePruned:pruned,stopped:true}),{mode:0o600});
 // Prune failure is not hidden: it is recorded above. Once the namespace is
 // stopped, the owner-validated filesystem cleanup must remove the entire
 // cache and verify root absence; permissions/residue make that step fail.
}
export async function runRootlessBuild(command:ProducerCommand,workspace:string,identity:ProducerIdentity,signal?:AbortSignal,options?:RootlessOptions){
 if(process.platform!=="linux"||process.getuid?.()===0)throw Error("QA_ROOTLESS_LINUX_USER_REQUIRED");
 const {work,bin,rootless}=options?options.tools():verifiedBuildTools(workspace,identity),cache=path.join(work,"buildkit-cache"),state=path.join(work,"rootless-state"),run=options?.run??producerProcess;
 writeFileSync(path.join(work,"buildkit-starting.json"),JSON.stringify(identity),{flag:"wx",mode:0o600});
 mkdirSync(cache,{mode:0o700});
 const daemonArgs=["--state-dir",state,"--pidns",path.join(bin,"buildkitd"),"--root",cache,"--addr",`unix://${path.join(work,"buildkit.sock")}`,"--oci-worker-snapshotter","native","--oci-worker-rootless","--containerd-worker=false"];
 const captured=options?.profile==="production"?await startProductDaemon({stage:"rootless-daemon",tool:rootless,args:daemonArgs,timeoutMs:2400000},work,options.daemonSequence!,signal):undefined;
 const daemon=captured?.child??spawn(rootless,daemonArgs,{cwd:workspace,env:options?.environment??{...process.env,PATH:bin+path.delimiter+process.env.PATH},detached:true,stdio:"ignore"});
 const finish=async(intentional:boolean)=>{if(captured){try{const r=await captured.finish(intentional);options?.daemonOutcome?.(r);if(!r.settled||!r.intentionalShutdown)throw Error("PRODUCT_DAEMON_FAILED_OR_UNSETTLED");}catch(e){options?.daemonOutcome?.(null);throw e;}}};
 try{if(captured)await captured.ready;else await new Promise<void>((resolve,reject)=>{daemon.once("spawn",resolve);daemon.once("error",()=>reject(Error("QA_ROOTLESS_DAEMON_UNAVAILABLE")));});}
 catch(error){try{await finish(false);}catch{}throw error;}

 const pid=daemon.pid!;let kernel:ReturnType<typeof processIdentity>;
 try{kernel=processIdentity(pid);}catch(error){captured?.stop();try{await finish(false);}catch{}throw error;}
 if(!kernel||kernel.group!==pid){captured?.stop();try{process.kill(-pid,"SIGKILL");}catch{}try{await finish(false);}catch{}throw Error("QA_ROOTLESS_DAEMON_IDENTITY_UNAVAILABLE");}
 let recorded=false;
 try{
  writeFileSync(path.join(work,"buildkit-process.json"),JSON.stringify({...identity,pid,start:kernel.start,cachePruned:false,stopped:false}),{flag:"wx",mode:0o600});recorded=true;
  let ready=false;
  for(let attempt=0;attempt<50;attempt++){
   if(signal?.aborted)throw Error("QA_BUILD_CANCELLED");if(daemon.exitCode!==null)throw Error("QA_ROOTLESS_DAEMON_FAILED");
   try{await run({stage:"rootless-ready",tool:path.join(bin,"buildctl"),args:["--addr",`unix://${path.join(work,"buildkit.sock")}`,"debug","workers"],timeoutMs:2000},workspace,signal);ready=true;break;}catch{await pause(100);}
  }
  if(!ready)throw Error("QA_ROOTLESS_DAEMON_NOT_READY");
  const output=await run(command,workspace,signal);
  const metadata=JSON.parse(readFileSync(path.join(work,"build-metadata.json"),"utf8")),digest=metadata["containerimage.config.digest"];
  if(!/^sha256:[a-f0-9]{64}$/.test(digest??""))throw Error("QA_BUILD_CONFIG_DIGEST_REQUIRED");
  writeFileSync(path.join(work,"image.id"),digest,{flag:"wx",mode:0o600});return output;
 }finally{const intentional=daemon.exitCode===null&&daemon.signalCode===null;try{if(recorded)await cleanupRootlessBuild(workspace,identity,options);else await stopDaemon(pid,kernel.start);}finally{try{if(captured)await stopDaemon(pid,kernel.start);}catch(error){captured?.stop();throw error;}finally{await finish(intentional);}}}
}
