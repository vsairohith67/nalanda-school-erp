import assert from "node:assert/strict";
import {spawn,type ChildProcessWithoutNullStreams} from "node:child_process";
import {parseWindowsProbe,validateWindowsProbeResult} from "./windows-server-contract";

/** Fixed in-container process boundary. Docker CLI termination does not stop a
 * daemon-owned exec, so the serving image itself bounds this one private probe.
 * The child rechecks signed target/fixture ownership before opening Prisma.
 * A forced stop is an uncertain operation, never a successful cleanup receipt. */
export function windowsProbeProcess(raw:string,start:(args:string[])=>ChildProcessWithoutNullStreams=(args)=>spawn(process.execPath,args,{shell:false,stdio:["pipe","pipe","pipe"]} as const)){
 const input=parseWindowsProbe(raw);
 assert(/(?:^|\/)dist\/portable\/browser-probe\.mjs$/.test(process.argv[1]),"WINDOWS_PROBE_IMMUTABLE_ENTRYPOINT_REQUIRED");
 return new Promise<unknown>((resolve,reject)=>{
  const child=start([process.argv[1],"windows-native","--windows-native-worker"]);
  let bytes=0,text="",failed=false,force:ReturnType<typeof setTimeout>|undefined;
  const stop=()=>{failed=true;if(child.exitCode===null&&!child.killed){child.kill("SIGTERM");force=setTimeout(()=>{if(child.exitCode===null)child.kill("SIGKILL");},3000);}};
  const deadline=setTimeout(stop,75_000);
  const signals=["SIGTERM","SIGINT","SIGHUP"] as const;for(const signal of signals)process.once(signal,stop);
  const cleanup=()=>{clearTimeout(deadline);if(force)clearTimeout(force);for(const signal of signals)process.removeListener(signal,stop);};
  for(const stream of [child.stdout,child.stderr])stream.on("data",(chunk:Buffer)=>{bytes+=chunk.length;if(bytes>16_384)stop();else if(stream===child.stdout)text+=chunk.toString();});
  child.stdin.on("error",stop);
  child.once("error",()=>{cleanup();reject(Error("WINDOWS_PROBE_CHILD_UNAVAILABLE"));});
  child.once("close",code=>{cleanup();try{assert(!failed&&code===0);resolve(validateWindowsProbeResult(input.operation,JSON.parse(text)));}catch{reject(Error("WINDOWS_PROBE_UNCERTAIN_OUTCOME_RECONCILE"));}});
  child.stdin.end(raw);
 });
}
