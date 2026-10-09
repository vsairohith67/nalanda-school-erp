import {spawn,type ChildProcess} from "node:child_process";
import {openSync,closeSync,writeSync,writeFileSync,readFileSync,readdirSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import type {ProducerCommand} from "./qa-artifact-producer";
/** Output stays private/bounded. Errors never include child args, env or output. */
export type ProducerProcessObservation={stage:string;exit:number|null;signal:string|null;timedOut:boolean;cancelled:boolean;startupFailed:boolean;outputLimit:boolean;terminationFailed:boolean;closed:boolean;durationMs:number;stdout:Buffer;stderr:Buffer};
export type ProducerProcessObserver=(outcome:ProducerProcessObservation)=>void|Promise<void>;
export function producerProcess(command:ProducerCommand,workspace:string,signal?:AbortSignal,observer?:ProducerProcessObserver):Promise<string>{
 return new Promise((resolve,reject)=>{
  const started=performance.now(),stdout:Buffer[]=[],stderr:Buffer[]=[];
  let timedOut=false,cancelled=false,startupFailed=false,outputLimit=false;
  const observe=async(exit:number|null,signal:string|null,closed:boolean,terminationFailed=false)=>{
   if(observer)await observer({stage:command.stage,exit,signal,timedOut,cancelled,startupFailed,outputLimit,terminationFailed,closed,durationMs:Math.round(performance.now()-started),stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr)});
  };
  if(signal?.aborted){cancelled=true;void observe(null,null,false).then(()=>reject(Error("QA_PROCESS_CANCELLED")),()=>reject(Error("QA_PROCESS_RETENTION_FAILED")));return;}
  const child=spawn(command.tool,command.args,{cwd:workspace,env:{...process.env,...command.env},shell:false,windowsHide:true,detached:process.platform!=="win32",stdio:["ignore","pipe","pipe"]});
  let output="",size=0,failed=false,termination:Promise<void>|undefined;
  let finalized=false,hardStop:ReturnType<typeof setTimeout>|undefined;
  const terminate=()=>{
   if(termination)return;failed=true;
   hardStop=setTimeout(()=>{
    // Match the existing product runner's finite cleanup barrier. A missing
    // close is UNKNOWN, never fabricated successful descendant settlement.
    child.stdout.destroy();child.stderr.destroy();child.unref();
    void complete(null,null,false,true);
   },2500);
   termination=new Promise<void>((resolve,reject)=>{
    const send=(signal:NodeJS.Signals)=>{try{if(process.platform!=="win32"&&child.pid)process.kill(-child.pid,signal);else child.kill(signal);}catch(error){if((error as NodeJS.ErrnoException).code!=="ESRCH")throw error;}};
    try{send("SIGTERM");}catch{reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));return;}
    // A leader may exit before its descendants. Keep escalation alive even
    // after close, and do not release the caller to cleanup until it completes.
    setTimeout(()=>{try{send("SIGKILL");resolve();}catch{reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));}},500);
   });
   void termination.catch(()=>{});
  };
  const abort=()=>{cancelled=true;terminate();};
  const timeout=setTimeout(()=>{timedOut=true;terminate();},command.timeoutMs??40*60_000);signal?.addEventListener("abort",abort,{once:true});
  const finish=()=>{clearTimeout(timeout);clearTimeout(hardStop);signal?.removeEventListener("abort",abort);};
  for(const stream of [child.stdout,child.stderr])stream.on("data",(bytes:Buffer)=>{if(finalized)return;size+=bytes.length;if(size>64*1024*1024){outputLimit=true;terminate();return;}if(observer)(stream===child.stdout?stdout:stderr).push(Buffer.from(bytes));if(stream===child.stdout)output+=bytes.toString();});
  const complete=async(code:number|null,sig:string|null,closed:boolean,groupFailed=false)=>{
   if(finalized)return;finalized=true;finish();try{await termination;}catch{groupFailed=true;}
   try{await observe(startupFailed?null:code,sig,closed,groupFailed);}catch{reject(Error("QA_PROCESS_RETENTION_FAILED"));return;}
   if(groupFailed)reject(Error("QA_PROCESS_GROUP_UNRECONCILED"));else if(startupFailed)reject(Error("QA_PROCESS_UNAVAILABLE"));else if(code!==0||failed)reject(Error("QA_PROCESS_FAILED_OR_CANCELLED"));else resolve(output);
  };
  child.once("error",()=>{startupFailed=true;terminate();});
  child.once("close",(code,sig)=>{void complete(code,sig,true);});
 });
}

export type ProductProcessReceipt={stage:string;commandSha256:string;toolSha256:string|null;exit:number|null;signal:string|null;timedOut:boolean;interrupted:boolean;startupFailed:boolean;ioFailed:boolean;settled:boolean;durationMs:number;stdoutBytes:number;stderrBytes:number;stdoutSha256:string;stderrSha256:string;intentionalShutdown?:boolean};
export function productEnvironment(root:string):NodeJS.ProcessEnv {
 return {NODE_ENV:"production",PATH:process.platform==="win32"?path.dirname(process.execPath):"/usr/bin:/bin",LANG:"C.UTF-8",HOME:path.join(root,"home"),TMPDIR:path.join(root,"temp"),TEMP:path.join(root,"temp"),TMP:path.join(root,"temp"),XDG_CACHE_HOME:path.join(root,"cache"),...(process.platform==="win32"?{SystemRoot:process.env.SystemRoot}: {})};
}
/** Same argument-array/process-group ownership as the QA runner, with complete
 * private outcomes for the product caller. Receipt storage failure leaves the
 * resource unsettled. No child output or environment enters public metadata. */
export async function captureProductProcess(command:ProducerCommand,root:string,sequence:number,unsettled:Set<number>,signal?:AbortSignal,options?:{onChild?:(child:ChildProcess)=>void;buildkit?:boolean;maxOutputBytes?:number;stdin?:Uint8Array;beforeSpawn?:()=>number|void}):Promise<ProductProcessReceipt> {
 if(!Number.isSafeInteger(sequence)||sequence<1||command.args.length>200||command.args.some(a=>typeof a!=="string"||a.length>8192||a.includes("\0"))||!path.isAbsolute(command.tool))throw Error("PRODUCT_COMMAND_INVALID");
 const timeoutMs=command.timeoutMs??900000;if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>2400000)throw Error("PRODUCT_PROCESS_DEADLINE_INVALID");
 const maxOutputBytes=options?.maxOutputBytes??64*1024*1024;if(!Number.isSafeInteger(maxOutputBytes)||maxOutputBytes<1||maxOutputBytes>64*1024*1024)throw Error("PRODUCT_PROCESS_OUTPUT_LIMIT_INVALID");
 const input=options?.stdin;if(input!==undefined&&(!(input instanceof Uint8Array)||input.byteLength<1||input.byteLength>2048))throw Error("PRODUCT_PROCESS_INPUT_LIMIT_INVALID");
 const allowed=new Set(["SYFT_CHECK_FOR_APP_UPDATE","SYFT_CACHE_DIR","GRYPE_CHECK_FOR_APP_UPDATE","GRYPE_DB_CACHE_DIR","GRYPE_DB_AUTO_UPDATE","TRIVY_CACHE_DIR"]);
 if(Object.keys(command.env??{}).some(k=>!allowed.has(k)))throw Error("PRODUCT_PROCESS_ENVIRONMENT_REJECTED");
 const start=performance.now(),stdoutFile=path.join(root,`process-${sequence}.stdout`),stderrFile=path.join(root,`process-${sequence}.stderr`);
 const out=openSync(stdoutFile,"wx",0o600);let err:number;try{err=openSync(stderrFile,"wx",0o600);}catch(e){closeSync(out);throw e;}
 const r:ProductProcessReceipt={stage:command.stage,commandSha256:hashBytes(JSON.stringify(command)),toolSha256:null,exit:null,signal:null,timedOut:false,interrupted:!!signal?.aborted,startupFailed:false,ioFailed:false,settled:false,durationMs:0,stdoutBytes:0,stderrBytes:0,stdoutSha256:"",stderrSha256:""};
 try{r.toolSha256=hashBytes(readFileSync(command.tool));}catch{/* startup failure is captured below */}
 unsettled.add(sequence);
 try{
  if(!r.interrupted)await new Promise<void>(resolve=>{
   let child:ReturnType<typeof spawn>;
   let effectiveTimeout=timeoutMs;
   try{
    const environment={...productEnvironment(root),...(options?.buildkit?{PATH:path.join(root,"tools/buildkit/bin")+path.delimiter+productEnvironment(root).PATH}:{}),...command.env};
    // Local grants recheck after synchronous tool hashing, at the effect boundary.
    const remaining=options?.beforeSpawn?.();
    if(remaining!==undefined){effectiveTimeout=Math.floor(Math.min(timeoutMs,remaining));if(!Number.isFinite(effectiveTimeout)||effectiveTimeout<1)throw Error("PRODUCT_PROCESS_DEADLINE_INVALID");}
    if(signal?.aborted){r.interrupted=true;r.settled=true;resolve();return;}
    child=spawn(command.tool,command.args,{cwd:root,env:environment,shell:false,windowsHide:true,detached:process.platform!=="win32",stdio:[input===undefined?"ignore":"pipe","pipe","pipe"]});
   }
   catch{r.startupFailed=true;r.settled=true;resolve();return;}
   options?.onChild?.(child);
   let pid:number|undefined,closed=false,termination:ReturnType<typeof setTimeout>|undefined,hardStop:ReturnType<typeof setTimeout>|undefined,killFailed=false;
   const send=(s:NodeJS.Signals)=>{try{if(process.platform!=="win32"&&pid)process.kill(-pid,s);else child.kill(s);}catch(e){if((e as NodeJS.ErrnoException).code!=="ESRCH")killFailed=true;}};
   const stop=()=>{send("SIGTERM");termination??=setTimeout(()=>send("SIGKILL"),500);hardStop??=setTimeout(()=>{if(closed)return;closed=true;clearTimeout(timer);signal?.removeEventListener("abort",abort);child.stdout?.destroy();child.stderr?.destroy();child.unref();r.settled=false;resolve();},2500);};
   const abort=()=>{r.interrupted=true;stop();};
   const timer=setTimeout(()=>{r.timedOut=true;stop();},effectiveTimeout);
   // Private operands go over bounded stdin, never argv, environment or receipt.
   if(input!==undefined){child.stdin?.on("error",()=>{r.ioFailed=true;stop();});child.stdin?.end(input);}
   signal?.addEventListener("abort",abort,{once:true});
   child.once("spawn",()=>{pid=child.pid;if(signal?.aborted)abort();});
   for(const [stream,fd,key] of [[child.stdout,out,"stdoutBytes"],[child.stderr,err,"stderrBytes"]] as const)stream?.on("data",(b:Buffer)=>{if(closed||r.ioFailed)return;if(r.stdoutBytes+r.stderrBytes+b.length>maxOutputBytes){r.ioFailed=true;stop();return;}try{let pos=0;while(pos<b.length)pos+=writeSync(fd,b,pos);r[key]+=b.length;}catch{r.ioFailed=true;stop();}});
   child.once("error",()=>{r.startupFailed=true;});
   child.once("close",async(code,sig)=>{
    if(closed)return;closed=true;clearTimeout(timer);signal?.removeEventListener("abort",abort);r.exit=code;r.signal=sig;
    // Reconcile the owned group even if its leader reported success. On Windows
    // timeout/interruption cannot prove descendant teardown, so retain the root.
    if(process.platform!=="win32"&&pid){send("SIGTERM");await new Promise(r=>setTimeout(r,500));send("SIGKILL");await new Promise(r=>setTimeout(r,30));try{for(const name of readdirSync("/proc")){if(!/^\d+$/.test(name))continue;try{const fields=readFileSync(`/proc/${name}/stat`,"utf8").split(") ")[1].split(" ");if(Number(fields[2])===pid&&fields[0]!=="Z")killFailed=true;}catch(e){if((e as NodeJS.ErrnoException).code!=="ENOENT")killFailed=true;}}}catch{killFailed=true;}}
    if(termination)clearTimeout(termination);if(hardStop)clearTimeout(hardStop);
    r.settled=!killFailed&&!(process.platform==="win32"&&(r.timedOut||r.interrupted||r.ioFailed));resolve();
   });
  });else r.settled=true;
 }finally{closeSync(out);closeSync(err);r.durationMs=Math.round(performance.now()-start);r.stdoutSha256=hashBytes(readFileSync(stdoutFile));r.stderrSha256=hashBytes(readFileSync(stderrFile));writeFileSync(path.join(root,`process-${sequence}.json`),JSON.stringify(r),{flag:"wx",mode:0o600});if(r.settled)unsettled.delete(sequence);}
 return r;
}

/** Long-lived owned daemon uses the same bounded capture runner. Its caller
 * retains PID/start ownership and stops it before awaiting this completion. */
export async function startProductDaemon(command:ProducerCommand,root:string,sequence:number,signal?:AbortSignal){
 const controller=new AbortController(),abort=()=>controller.abort();signal?.addEventListener("abort",abort,{once:true});if(signal?.aborted)controller.abort();
 const pending=new Set<number>();let deliver!:(child:ChildProcess)=>void;
 const started=new Promise<ChildProcess>(resolve=>{deliver=resolve;});
 let readyResolve!:()=>void,readyReject!:(error:Error)=>void;
 const ready=new Promise<void>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});void ready.catch(()=>{});
 const result=captureProductProcess(command,root,sequence,pending,controller.signal,{onChild:child=>{child.once("spawn",readyResolve);child.once("error",()=>readyReject(Error("PRODUCT_DAEMON_STARTUP_FAILED")));deliver(child);},buildkit:true}).finally(()=>signal?.removeEventListener("abort",abort));
 const child=await Promise.race([started,result.then(()=>{throw Error("PRODUCT_DAEMON_NOT_STARTED");})]);
 return {child,ready,stop:abort,finish:async(intentional:boolean)=>{const receipt=await result;receipt.intentionalShutdown=intentional&&!receipt.startupFailed&&!receipt.timedOut&&!receipt.interrupted&&!receipt.ioFailed;writeFileSync(path.join(root,`process-${sequence}.json`),JSON.stringify(receipt),{mode:0o600});return receipt;}};
}
