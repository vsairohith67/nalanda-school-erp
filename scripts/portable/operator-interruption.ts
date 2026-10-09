import { spawn, type ChildProcess } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { OperatorManifest, OperatorReceipt } from "../../lib/portable-runtime/operator";

/** Kill only our subprocess, and admit resume only after its durable receipt
 * still proves a convergent dependency step. A sampling race into migration is
 * deliberately a reconciliation failure, never permission to replay. */
export async function interruptAtDependencies(child: ChildProcess, receiptFile: string, timeoutMs = 120_000) {
  if(process.platform!=="linux"||!child.pid)throw Error("OWNED_LINUX_PROCESS_GROUP_REQUIRED");
  const groupId=child.pid;
  const stat=await readFile(`/proc/${groupId}/stat`,"utf8"),fields=stat.slice(stat.lastIndexOf(")")+2).split(" ");
  if(Number(fields[2])!==groupId||Number(fields[3])!==groupId)throw Error("INTERRUPTION_GROUP_NOT_OWNED");
  const stopGroup=()=>{try{process.kill(-groupId,"SIGKILL");return true;}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;return false;}};
  const groupGone=async()=>{
    for(let n=0;n<200;n++){try{process.kill(-groupId,0);}catch(error){if((error as NodeJS.ErrnoException).code==="ESRCH")return;throw error;}await new Promise(r=>setTimeout(r,10));}
    throw Error("OWNED_PROCESS_GROUP_NOT_REAPED_RECONCILE");
  };
  let exited = false;
  const closed = new Promise<void>((resolve, reject) => {
    child.once("error", () => { exited = true; reject(Error("INTERRUPTION_PROCESS_FAILED")); });
    child.once("exit", () => { exited = true; resolve(); });
  });
  // Handle an early process failure while polling without an unhandled rejection.
  void closed.catch(() => undefined);
  const deadline = Date.now() + timeoutMs;
  let interrupted = false;
  while (!exited && Date.now() < deadline) {
    const receipt = await readFile(receiptFile,"utf8").then(v=>JSON.parse(v) as OperatorReceipt).catch(()=>null);
    if(receipt?.state==="IN_PROGRESS"&&receipt.uncertain==="dependencies"&&receipt.completed.join() === "validate") {
      interrupted = stopGroup();break;
    }
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  if(!interrupted){stopGroup();await closed;await groupGone();throw Error("INTERRUPTION_STAGE_NOT_OBSERVED_RECONCILE");}
  await closed;
  await groupGone();
  const receipt=JSON.parse(await readFile(receiptFile,"utf8")) as OperatorReceipt;
  if(receipt.state!=="IN_PROGRESS"||receipt.uncertain!=="dependencies"||receipt.completed.join()!=="validate")throw Error("INTERRUPTION_EFFECT_AMBIGUOUS_RECONCILE");
  return {state:"CONVERGENT_DEPENDENCIES_INTERRUPTED" as const,receipt};
}
export async function interruptPublicInitialise(manifest:OperatorManifest,file:string) {
  if(process.platform!=="linux")throw Error("OWNED_LINUX_PROCESS_GROUP_REQUIRED");
  const child=spawn(process.execPath,["--import","tsx",path.resolve("scripts/portable/operator.ts"),"initialise","--manifest",file,"--target",manifest.target,"--apply"],{shell:false,detached:true,windowsHide:true,stdio:"ignore"});
  return interruptAtDependencies(child,path.join(manifest.target,`${manifest.operationId}.initialise.receipt.json`));
}
