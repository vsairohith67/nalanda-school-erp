import assert from "node:assert/strict";
import {spawn,type ChildProcess} from "node:child_process";
import {lookup} from "node:dns/promises";
import {request} from "node:https";
import {assertOwnedProcess,type ProcessIdentity} from "./windows-auth-lifecycle";
import {privateWindowsOs,type WindowsOs} from "./windows-webdriver-host";
import {createPrivateWindowsChannel,windowsPrivateSshArguments,type WindowsPrivateTransport} from "./windows-private-transport";
import {validateNativeQaProfile} from "./native-qa-profile";

/** The endpoint is fixed by assertHttpTarget, not by an editable destination.
 * The pre-provisioned controller key must allow ONLY local forwarding to
 * 127.0.0.1:8443 (PermitOpen) and prohibit remote forwarding (PermitListen none).
 * This client neither provisions that policy nor substitutes for its admission. */
export function windowsApplicationForwardArguments(config:WindowsPrivateTransport){
 const args=windowsPrivateSshArguments(config),clear=args.indexOf("ClearAllForwardings=yes");
 assert(clear>0);args.splice(clear-1,2);
 args.splice(args.length-1,0,"-N","-o","ExitOnForwardFailure=yes","-o","GatewayPorts=no",
  "-L","127.0.0.1:8443:127.0.0.1:8443","-L","[::1]:8443:127.0.0.1:8443");
 return args;
}
export function assertApplicationListeners(rows:Array<{address:string;port:number;pid:number}>,owned:ProcessIdentity){
 assert.equal(rows.length,2,"WINDOWS_APPLICATION_LISTENER_COUNT");
 assert.deepEqual(rows.map(r=>r.address).sort(),["127.0.0.1","::1"].sort(),"WINDOWS_APPLICATION_PUBLIC_LISTENER_REFUSED");
 assert(rows.every(r=>r.port===8443&&r.pid===owned.pid),"WINDOWS_APPLICATION_FOREIGN_LISTENER");
}
/** Real TLS navigation without credentials. The browser, WebView and Rust retain
 * their own verifiers; this handshake is only the forwarding preflight. */
export function verifyForwardedHttps(origin:string,ca:string):Promise<void>{
 assert.equal(origin,"https://portable-staging.localhost:8443");
 return new Promise((resolve,reject)=>{
  const req=request(new URL("/login",origin),{ca,rejectUnauthorized:true,timeout:10000,method:"GET",agent:false},res=>{
   let bytes=0;res.on("data",chunk=>{bytes+=chunk.length;if(bytes>2*1024*1024)req.destroy(Error("WINDOWS_HTTPS_RESPONSE_BOUND"));});
   res.on("end",()=>{if(res.statusCode===200&&res.headers["content-type"]?.startsWith("text/html")&&bytes>0)resolve();else reject(Error("WINDOWS_APPLICATION_HTTPS_REFUSED"));});
   res.on("error",()=>reject(Error("WINDOWS_APPLICATION_HTTPS_REFUSED")));
  });
  req.on("timeout",()=>req.destroy());req.on("error",()=>reject(Error("WINDOWS_APPLICATION_HTTPS_REFUSED")));req.end();
 });
}
/** One owned OpenSSH child; no configurable bind address, remote command,
 * database forward, destination override, shared listener or HTTP downgrade. */
export class OwnedWindowsApplicationForward {
 private child:ChildProcess|undefined;private identity:ProcessIdentity|undefined;private failed=false;
 constructor(private readonly config:WindowsPrivateTransport,private readonly os:WindowsOs=privateWindowsOs){}
 async start(){
  assert(!this.child,"WINDOWS_FORWARD_ALREADY_STARTED");
  const channel=createPrivateWindowsChannel(this.config,this.config),{context}=channel.native();
  const profile=validateNativeQaProfile(context.trust,context.profile);
  const addresses=await lookup(new URL(profile.origin).hostname,{all:true});
  assert(addresses.length>0&&addresses.every(a=>["127.0.0.1","::1"].includes(a.address)),"WINDOWS_APPLICATION_ORIGIN_NOT_LOOPBACK");
  assert.equal(this.os({operation:"listeners",port:8443}).length,0,"WINDOWS_FORWARD_PORT_FOREIGN");
  const child=spawn(this.config.sshExecutable,windowsApplicationForwardArguments(this.config),{shell:false,windowsHide:true,stdio:"ignore",
   env:{NODE_ENV:process.env.NODE_ENV,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP}});this.child=child;
  child.on("error",()=>{this.failed=true;});
  for(let n=0;n<40;n++){
   assert(!this.failed&&child.exitCode===null,"WINDOWS_FORWARD_START_FAILED");
   const rows=this.os({operation:"processes",executable:this.config.sshExecutable}) as ProcessIdentity[];
   const current=rows.find(p=>p.pid===this.child!.pid);
   if(current){
    assert(current.userSid===this.config.userSid&&current.sha256===this.config.sshSha256,"WINDOWS_FORWARD_PROCESS_FOREIGN");
    if(this.identity)assertOwnedProcess(current,this.identity);else this.identity=current;
    const listeners=this.os({operation:"listeners",port:8443});
    if(listeners.length){assertApplicationListeners(listeners,current);await verifyForwardedHttps(profile.origin,profile.caPem);await this.bind();return;}
   }
   await new Promise(r=>setTimeout(r,250));
  }
  throw Error("WINDOWS_FORWARD_START_NOT_OBSERVED");
 }
 async bind(){
  assert(this.child&&this.identity&&!this.failed&&this.child.exitCode===null,"WINDOWS_FORWARD_CONNECTION_LOST");
  createPrivateWindowsChannel(this.config,this.config).native(); // current source/backend/replicas/profile
  const actual=(this.os({operation:"processes",executable:this.config.sshExecutable}) as ProcessIdentity[]).find(p=>p.pid===this.identity!.pid);
  assert(actual,"WINDOWS_FORWARD_CONNECTION_LOST");assertOwnedProcess(actual,this.identity);
  assertApplicationListeners(this.os({operation:"listeners",port:8443}),this.identity);
 }
 async cleanup(){
  if(!this.child)return;
  if(!this.identity)throw Error("WINDOWS_FORWARD_UNIDENTIFIED_RESIDUE");
  const actual=(this.os({operation:"processes",executable:this.config.sshExecutable}) as ProcessIdentity[]).find(p=>p.pid===this.identity!.pid);
  if(actual){assertOwnedProcess(actual,this.identity);this.os({operation:"stop",process:this.identity});}
  assert(!(this.os({operation:"processes",executable:this.config.sshExecutable}) as ProcessIdentity[]).some(p=>p.pid===this.identity!.pid),"WINDOWS_FORWARD_CLEANUP_INCOMPLETE");
  assert(!this.os({operation:"listeners",port:8443}).some((r:{pid:number})=>r.pid===this.identity!.pid),"WINDOWS_FORWARD_LISTENER_REMAINS");
  this.child=undefined;this.identity=undefined;
 }
}
