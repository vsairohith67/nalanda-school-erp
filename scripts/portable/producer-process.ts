import {spawn} from "node:child_process";
import type {ProducerCommand} from "./qa-artifact-producer";
/** Output stays private/bounded. Errors never include child args, env or output. */
export function producerProcess(command:ProducerCommand,workspace:string,signal?:AbortSignal):Promise<string>{
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error("QA_PROCESS_CANCELLED"));return;}
  const child=spawn(command.tool,command.args,{cwd:workspace,env:{...process.env,...command.env},shell:false,windowsHide:true,detached:process.platform!=="win32",stdio:["ignore","pipe","pipe"]});
  let output="",size=0,failed=false,termination:Promise<void>|undefined;
  const terminate=()=>{
   if(termination)return;failed=true;
   termination=new Promise<void>((resolve,reject)=>{
    const send=(signal:NodeJS.Signals)=>{try{if(process.platform!=="win32"&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;}};
    try{send("SIGTERM");}catch{reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));return;}
    // A leader may exit before its descendants. Keep escalation alive even
    // after close, and do not release the caller to cleanup until it completes.
    setTimeout(()=>{try{send("SIGKILL");resolve();}catch{reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));}},500);
   });
   void termination.catch(()=>{});
  };
  const timeout=setTimeout(terminate,command.timeoutMs??40*60_000);signal?.addEventListener("abort",terminate,{once:true});
  const finish=()=>{clearTimeout(timeout);signal?.removeEventListener("abort",terminate);};
  for(const stream of [child.stdout,child.stderr])stream.on("data",(bytes:Buffer)=>{size+=bytes.length;if(size>64*1024*1024){terminate();return;}if(stream===child.stdout)output+=bytes.toString();});
  child.once("error",()=>{finish();reject(Error("QA_PROCESS_UNAVAILABLE"));});
  child.once("close",async code=>{finish();try{await termination;}catch{reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));return;}if(code!==0||failed)reject(Error("QA_PROCESS_FAILED_OR_CANCELLED"));else resolve(output);});
 });
}
