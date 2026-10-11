import assert from "node:assert/strict";
import {execFileSync,spawn,type ChildProcessWithoutNullStreams} from "node:child_process";
import {createInterface} from "node:readline";
import path from "node:path";
import {assertOwnedProcess,type ProcessIdentity,type WindowsTarget} from "./windows-auth-lifecycle";
import {privateWindowsOs} from "./windows-webdriver-host";
export type NativeProcessStart={kind:"START";pid:number;parentPid:number;userSid:string;image:"nalanda-cross-platform.exe";at:string};
export function validateNativeProcessStart(v:NativeProcessStart){
 assert.deepEqual(Object.keys(v).sort(),["kind","pid","parentPid","userSid","image","at"].sort());
 assert(v.kind==="START"&&Number.isSafeInteger(v.pid)&&v.pid>0&&Number.isSafeInteger(v.parentPid)&&v.parentPid>0&&/^S-1-5-21-(?:\d+-){3}\d+$/.test(v.userSid)&&v.image==="nalanda-cross-platform.exe"&&Number.isFinite(Date.parse(v.at)),"WINDOWS_OS_PROCESS_EVENT_INVALID");return v;
}
export function assertProtocolLaunch(event:NativeProcessStart,target:WindowsTarget,parents:ProcessIdentity[],after:number,liveParents:ProcessIdentity[]){
 validateNativeProcessStart(event);assert.equal(event.userSid,target.userSid,"WINDOWS_CALLBACK_WRONG_USER");
 assert(Date.parse(event.at)>=after&&Date.parse(event.at)<=Date.now()+1000,"WINDOWS_CALLBACK_STALE_PROCESS_EVENT");
 // The disposable browser must be the parent of the protocol process. Shells,
 // manual CLI launch, unknown brokers and other user processes fail closed.
 const parent=parents.find(p=>p.pid===event.parentPid&&p.userSid===target.userSid&&Date.parse(p.created)<=Date.parse(event.at));assert(parent,"WINDOWS_CALLBACK_NOT_OWNED_BROWSER_CHILD");
 const live=liveParents.find(p=>p.pid===parent.pid);assert(live,"WINDOWS_CALLBACK_PARENT_NO_LONGER_OBSERVABLE");assertOwnedProcess(live,parent);
}
/** WMI is an OS boundary, not application-reported provenance. Unsupported
 * broker topology stays a refusal rather than guessing its browser ancestor. */
export class OwnedWindowsProcessObserver {
 private child:ChildProcessWithoutNullStreams|undefined;private process:ProcessIdentity|undefined;
 private failed=false;private ended=false;private rows:NativeProcessStart[]=[];private stopped=false;
 constructor(private readonly target:WindowsTarget){}
 async start(){
  assert(!this.child);assert.equal(process.platform,"win32");
  const file="scripts/portable/windows-process-observer.ps1";
  const git=(...args:string[])=>execFileSync("git",args,{encoding:"utf8",timeout:30000}).trim();
  assert.equal(git("rev-parse","HEAD"),this.target.source);assert.equal(git("hash-object",`--path=${file}`,file),git("rev-parse",`${this.target.source}:${file}`));
  const child=spawn("powershell.exe",["-NoProfile","-NonInteractive","-File",path.resolve(file)],{windowsHide:true,shell:false,stdio:"pipe"});this.child=child;
  child.on("error",()=>{this.failed=true;});child.on("exit",code=>{this.ended=true;if(code!==0)this.failed=true;});child.stderr.on("data",()=>{this.failed=true;});
  const reader=createInterface({input:child.stdout});reader.on("line",line=>{
   try{
    assert(line.length<=4096);const v=JSON.parse(line);
    if(v.kind==="READY"){
     assert(!this.process&&Object.keys(v).length===2&&v.process.pid===child.pid&&v.process.userSid===this.target.userSid);
     const actual=(privateWindowsOs({operation:"processes",executable:v.process.executable}) as ProcessIdentity[]).find(p=>p.pid===child.pid);assert(actual);assertOwnedProcess(actual,v.process);this.process=v.process;
    }else{assert(this.process&&this.rows.length<64);this.rows.push(validateNativeProcessStart(v));}
   }catch{this.failed=true;}
  });
  child.stdin.write(JSON.stringify({sid:this.target.userSid,source:this.target.source,runId:this.target.runId,attempt:this.target.attempt})+"\n");
  for(let n=0;n<40;n++){assert(!this.failed&&!this.ended,"WINDOWS_OS_OBSERVER_UNAVAILABLE");if(this.process)return;await new Promise(r=>setTimeout(r,250));}
  throw Error("WINDOWS_OS_OBSERVER_NOT_READY");
 }
 events(){assert(this.process&&!this.failed&&!this.ended,"WINDOWS_OS_OBSERVATION_LOST");return [...this.rows];}
 async cleanup(){
  if(this.stopped)return;this.stopped=true;if(!this.child)return;
  assert(this.process,"WINDOWS_OBSERVER_UNIDENTIFIED_RESIDUE");
  if(!this.ended)this.child.stdin.end("STOP\n");
  for(let n=0;n<20&&!this.ended;n++)await new Promise(r=>setTimeout(r,250));
  // A failed observer reports unresolved teardown; it is never killed by name.
  assert(this.ended&&!this.failed,"WINDOWS_OBSERVER_CLEANUP_UNCONFIRMED");
  const rows=privateWindowsOs({operation:"processes",executable:this.process.executable}) as ProcessIdentity[];
  assert(!rows.some(p=>p.pid===this.process!.pid&&p.created===this.process!.created),"WINDOWS_OBSERVER_PROCESS_REMAINS");
 }
}
