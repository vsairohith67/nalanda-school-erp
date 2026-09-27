import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {pathToFileURL} from "node:url";
import path from "node:path";
import {admitSyntheticArtifact} from "./admit-artifact";
import {producerIdentity,readSigningRoot,syntheticEvidenceRoot} from "./synthetic-build-lifecycle";
import {inspectTarget} from "./integrated-acceptance";
import {parseWindowsProbe,validateWindowsProbeResult} from "./windows-server-contract";

export type WindowsControllerTarget={source:string;runId:string;attempt:string;containerId:string;imageConfigDigest:string};
type ControllerPort={admit():WindowsControllerTarget;bind():void;invoke(containerId:string,input:string):string};
/** The injectable boundary proves ordering only. Real admission is exclusively
 * constructed by servingControllerPort below, on the Linux controller. */
export function dispatchWindowsController(raw:string,port:ControllerPort){
 assert(Buffer.byteLength(raw)<=5120,"WINDOWS_CONTROLLER_INPUT_BOUND");
 const envelope=JSON.parse(raw);
 assert.deepEqual(Object.keys(envelope).sort(),["containerId","imageConfigDigest","input"].sort());
 assert(typeof envelope.input==="string");
 const input=parseWindowsProbe(envelope.input); // no command, URL or SQL input
 const target=port.admit();
 assert.equal(input.source,target.source,"WINDOWS_CONTROLLER_SOURCE");
 assert.equal(input.runId,target.runId,"WINDOWS_CONTROLLER_RUN");
 assert.equal(input.attempt,target.attempt,"WINDOWS_CONTROLLER_ATTEMPT");
 assert(/^[a-f0-9]{64}$/.test(target.containerId)&&/^sha256:[a-f0-9]{64}$/.test(target.imageConfigDigest),"WINDOWS_CONTROLLER_TARGET");
 // Constraints only: the caller cannot select the container. Check BEFORE any
 // fixture/governance operation, rather than rejecting the wrong result later.
 assert.equal(envelope.containerId,target.containerId,"WINDOWS_CONTROLLER_CONTAINER_CHANGED");
 assert.equal(envelope.imageConfigDigest,target.imageConfigDigest,"WINDOWS_CONTROLLER_IMAGE_CHANGED");
 port.bind();
 const text=port.invoke(target.containerId,JSON.stringify(input));
 assert(Buffer.byteLength(text)<=16_384,"WINDOWS_CONTROLLER_OUTPUT_BOUND");
 const result=validateWindowsProbeResult(input.operation,JSON.parse(text));
 port.bind();
 // Envelope binds every private result to the actual admitted image and serving
 // container. This is an SSH-authenticated observation, not portable provenance.
 return {contract:"NALANDA_WINDOWS_CONTROLLER_V1" as const,...target,result};
}
function servingControllerPort():ControllerPort {
 let target:ReturnType<typeof inspectTarget>|undefined;
 return {
  admit(){
   assert.equal(process.platform,"linux");
   assert(!process.env.SSH_ORIGINAL_COMMAND,"WINDOWS_CONTROLLER_REMOTE_COMMAND_REFUSED");
   const id=producerIdentity(),trust=readSigningRoot(process.cwd(),id);
   const artifact=admitSyntheticArtifact(syntheticEvidenceRoot(),trust.bytes);
   const containerId=process.env.WINDOWS_CONTROLLER_CONTAINER_ID;
   assert(containerId&&/^[a-f0-9]{64}$/.test(containerId),"WINDOWS_CONTROLLER_CONTAINER_REQUIRED");
   target=inspectTarget(artifact,containerId);
   return {source:artifact.source,runId:id.runId,attempt:id.attempt,containerId,imageConfigDigest:artifact.imageConfigDigest};
  },
  bind(){assert(target,"WINDOWS_CONTROLLER_NOT_ADMITTED");target.bind();},
  invoke(containerId,raw){return execFileSync("docker",["--context","default","exec","-i","-e","PORTABLE_ACCEPTANCE_FIXTURE=synthetic-ON",containerId,"/nodejs/bin/node","dist/portable/browser-probe.mjs","windows-native"],{input:raw,encoding:"utf8",stdio:["pipe","pipe","pipe"],timeout:90_000,maxBuffer:16_384});},
 };
}
/** Fixed forced-command entrypoint. The existing signed in-container dispatcher
 * revalidates source/run/attempt, all serving replicas and fixture DB ownership
 * before constructing Prisma. This command never accepts a remote command. */
export async function readWindowsControllerInput(stdin:AsyncIterable<Buffer|string>){
 let raw="";
 for await(const part of stdin){raw+=part.toString();assert(Buffer.byteLength(raw)<=5120,"WINDOWS_CONTROLLER_INPUT_BOUND");}
 return raw;
}
/** GNU timeout owns its new process group and bounds synchronous Docker/git
 * children too. A JS timer alone cannot interrupt execFileSync. The fixed
 * forced-command invokes this supervisor, never the internal worker directly. */
export async function superviseWindowsController(raw:string){
 assert.equal(process.platform,"linux");assert(!process.env.SSH_ORIGINAL_COMMAND);
 return controllerDeadlineProcess(raw);
}
/** Process-adapter seam only; invoking it cannot skip the worker's own actual
 * Linux/exact-head/runtime/target admission. */
export function controllerDeadlineProcess(raw:string,start:typeof spawn=spawn){
 assert(Buffer.byteLength(raw)<=5120);
 return new Promise<string>((resolve,reject)=>{
  const child=start("/usr/bin/timeout",["--signal=TERM","--kill-after=5s","100s",process.execPath,path.resolve(process.argv[1]),"--controller-worker"],{shell:false,stdio:["pipe","pipe","ignore"]});
  let output="",size=0,failed=false;
  const stop=()=>{failed=true;if(child.exitCode===null&&!child.killed)child.kill("SIGTERM");};
  const signals=["SIGTERM","SIGINT","SIGHUP"] as const;for(const signal of signals)process.once(signal,stop);
  const close=()=>{for(const signal of signals)process.removeListener(signal,stop);};
  child.stdout!.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>20_480)stop();else output+=chunk.toString();});
  child.stdin!.on("error",stop);
  child.once("error",()=>{close();reject(Error("WINDOWS_CONTROLLER_SUPERVISOR_UNAVAILABLE"));});
  child.once("close",code=>{close();if(failed||code!==0)reject(Error("WINDOWS_CONTROLLER_UNCERTAIN_OUTCOME_RECONCILE"));else resolve(output);});
  child.stdin!.end(raw);
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 // Input timeout only; the worker's synchronous actions are bounded separately
 // by the supervisor. Never retry an ambiguous governance/fixture mutation.
 const timer=setTimeout(()=>{process.stderr.write("WINDOWS_CONTROLLER_INPUT_TIMEOUT\n");process.exit(1);},10_000);
 try{
  assert(process.argv.length===2||(process.argv.length===3&&process.argv[2]==="--controller-worker"));
  const raw=await readWindowsControllerInput(process.stdin);clearTimeout(timer);
  const result=process.argv[2]==="--controller-worker"?JSON.stringify(dispatchWindowsController(raw,servingControllerPort())):await superviseWindowsController(raw);
  process.stdout.write(result);
 }
 catch{process.stderr.write("WINDOWS_CONTROLLER_REFUSED_PRIVATE_DETAILS_WITHHELD\n");process.exitCode=1;}
 finally{clearTimeout(timer);}
}
