import {it,expect,vi} from "vitest";
import {EventEmitter} from "node:events";
import {windowsProbeProcess} from "../scripts/portable/windows-probe-process";
import {WindowsServerPorts} from "../scripts/portable/windows-server-adapter";
import {randomUUID,generateKeyPairSync} from "node:crypto";
import {dispatchWindowsController,readWindowsControllerInput,controllerDeadlineProcess} from "../scripts/portable/windows-controller";
import {validateWindowsPrivateTransport,windowsPrivateSshArguments,validateWindowsControllerEnvelope,assertPrivateWindowsAcl,createPrivateWindowsServerPorts,type WindowsPrivateTransport} from "../scripts/portable/windows-private-transport";
const binding={source:"a".repeat(40),runId:"456",attempt:"1",iteration:randomUUID(),phase:"synthetic-ON" as const,databaseIdentitySha256:"b".repeat(64),publicDeviceId:randomUUID(),publicKeyHash:"c".repeat(64)};
const target={source:binding.source,runId:binding.runId,attempt:binding.attempt,containerId:"d".repeat(64),imageConfigDigest:`sha256:${"e".repeat(64)}`};
const raw=JSON.stringify({...binding,operation:"totp"});
const wire=(input=raw,change={})=>JSON.stringify({containerId:target.containerId,imageConfigDigest:target.imageConfigDigest,input,...change});
const sshKey=()=>{const {publicKey}=generateKeyPairSync("ed25519"),jwk=publicKey.export({format:"jwk"});const key=Buffer.concat([Buffer.from([0,0,0,11]),Buffer.from("ssh-ed25519"),Buffer.from([0,0,0,32]),Buffer.from(jwk.x!,"base64url")]);return `ssh-ed25519 ${key.toString("base64")}`;};
const config=():WindowsPrivateTransport=>({contract:"NALANDA_WINDOWS_PRIVATE_SSH_V1",...target,root:"C:\\qa\\run-456-1",userSid:"S-1-5-21-1-2-3-1001",controllerAddress:"10.12.0.4",controllerPort:22,controllerUser:"nalanda-probe",sshExecutable:"C:\\qa\\run-456-1\\ssh.exe",sshSha256:"1".repeat(64),knownHosts:"C:\\qa\\run-456-1\\known_hosts",hostPublicKey:sshKey(),identityFile:"C:\\qa\\run-456-1\\identity",identitySha256:"2".repeat(64)});

it("UNIT_OR_CONTRACT: controller admits and binds before real fixed-operation invocation, then rebinds",()=>{
 const calls:string[]=[],port={admit:()=>{calls.push("admit");return target;},bind:()=>{calls.push("bind");},invoke:(container:string,input:string)=>{calls.push("invoke");expect(container).toBe(target.containerId);expect(JSON.parse(input)).toEqual(JSON.parse(raw));return JSON.stringify({token:"123456"});}};
 expect(dispatchWindowsController(wire(),port)).toEqual({contract:"NALANDA_WINDOWS_CONTROLLER_V1",...target,result:{token:"123456"}});
 expect(calls).toEqual(["admit","bind","invoke","bind"]);
});
it("controller rejects malformed/oversized/arbitrary command input before admission or subprocess",()=>{
 const port={admit:vi.fn(()=>target),bind:vi.fn(),invoke:vi.fn()};
 for(const input of ["{","x".repeat(4097),JSON.stringify({...binding,operation:"sql"}),JSON.stringify({...binding,operation:"totp",containerId:target.containerId})])expect(()=>dispatchWindowsController(wire(input),port)).toThrow();
 expect(port.admit).not.toHaveBeenCalled();expect(port.invoke).not.toHaveBeenCalled();
});
it("controller refuses stale source/run/attempt and admission/binding failures before mutation",()=>{
 for(const change of [{containerId:"f".repeat(64)},{imageConfigDigest:`sha256:${"f".repeat(64)}`}]){const invoke=vi.fn();expect(()=>dispatchWindowsController(wire(raw,change),{admit:()=>target,bind:()=>{},invoke})).toThrow();expect(invoke).not.toHaveBeenCalled();}
 for(const change of [{source:"f".repeat(40)},{runId:"457"},{attempt:"2"}]){const invoke=vi.fn();expect(()=>dispatchWindowsController(wire(),{admit:()=>({...target,...change}),bind:()=>{},invoke})).toThrow();expect(invoke).not.toHaveBeenCalled();}
 for(const phase of ["admit","bind"]){const invoke=vi.fn();expect(()=>dispatchWindowsController(wire(),{admit:()=>{if(phase==="admit")throw Error("EXTERNAL_RUNTIME_BLOCKED");return target;},bind:()=>{throw Error("TARGET_CHANGED");},invoke})).toThrow();expect(invoke).not.toHaveBeenCalled();}
});
it("controller never reports success for malformed/private output or post-operation target drift",()=>{
 for(const output of ["{","x".repeat(16_385),JSON.stringify({token:"123456",seed:"private"})])expect(()=>dispatchWindowsController(wire(),{admit:()=>target,bind:()=>{},invoke:()=>output})).toThrow();
 let calls=0;expect(()=>dispatchWindowsController(wire(),{admit:()=>target,bind:()=>{if(++calls===2)throw Error("TARGET_CHANGED");},invoke:()=>JSON.stringify({token:"123456"})})).toThrow("TARGET_CHANGED");
});
it("transport refuses public routes, malformed pinned keys, substituted run and ambiguous paths",()=>{
 expect(validateWindowsPrivateTransport(config(),binding).controllerAddress).toBe("10.12.0.4");
 for(const change of [{controllerAddress:"127.0.0.1"},{controllerAddress:"8.8.8.8"},{controllerAddress:"10.999.1.1"},{controllerAddress:"private.invalid"},{controllerAddress:"010.1.2.3"},{controllerUser:"-oProxyCommand=bad"},{hostPublicKey:"ssh-ed25519 "+"a".repeat(68)},{attempt:"2"},{root:"C:\\foreign"},{identityFile:config().knownHosts},{extra:true}])expect(()=>validateWindowsPrivateTransport({...config(),...change} as any,binding)).toThrow();
});
it("SSH invocation has no remote command, forwarding, ambient configuration or secret payload arguments",()=>{
 const c=config(),args=windowsPrivateSshArguments(c);
 expect(args.slice(0,3)).toEqual(["-T","-F","NUL"]);expect(args.at(-1)).toBe("nalanda-probe@10.12.0.4");
 for(const option of ["StrictHostKeyChecking=yes","IdentitiesOnly=yes","IdentityAgent=none","ClearAllForwardings=yes","ForwardAgent=no","ProxyCommand=none","ProxyJump=none","PermitLocalCommand=no"])expect(args).toContain(option);
 expect(args.join(" ")).not.toContain("123456");expect(args).not.toContain("-L");expect(args).not.toContain("-R");
 const spaced={...c,knownHosts:"C:\\qa\\run-456-1\\private inputs\\known_hosts"};expect(validateWindowsPrivateTransport(spaced,binding)).toEqual(spaced);expect(windowsPrivateSshArguments(spaced)).toContain('UserKnownHostsFile="C:/qa/run-456-1/private inputs/known_hosts"');
 for(const token of ["%h","${HOME}","\n","\"","*","~"]){expect(()=>validateWindowsPrivateTransport({...c,knownHosts:`C:\\qa\\run-456-1\\${token}\\known_hosts`},binding)).toThrow();}
});
it("response envelope binds exact source/controller/container/image and excludes private extra fields",()=>{
 const envelope={contract:"NALANDA_WINDOWS_CONTROLLER_V1",...target,result:{token:"123456"}};
 expect(validateWindowsControllerEnvelope(JSON.stringify(envelope),raw,target)).toEqual({token:"123456"});
 for(const change of [{containerId:"f".repeat(64)},{imageConfigDigest:`sha256:${"f".repeat(64)}`},{runId:"1"},{source:"f".repeat(40)},{extra:"private"},{result:{token:"123456",password:"private"}}])expect(()=>validateWindowsControllerEnvelope(JSON.stringify({...envelope,...change}),raw,target)).toThrow();
});
it("Windows ACL check rejects foreign owner, inherited/wide access and missing private user access",()=>{
 const sid=config().userSid,acl={userSid:sid,owner:sid,protected:true,rules:[{sid,type:"Allow",inherited:false}]};
 expect(()=>assertPrivateWindowsAcl(acl,sid)).not.toThrow();
 for(const change of [{owner:"S-1-5-18"},{userSid:"foreign"},{protected:false},{rules:[]},{rules:[{sid:"S-1-1-0",type:"Allow",inherited:false}]},{rules:[{sid,type:"Allow",inherited:true}]}])expect(()=>assertPrivateWindowsAcl({...acl,...change},sid)).toThrow();
});
it("constructing the real transport on an unadmitted host cannot grant server access",()=>{
 expect(()=>createPrivateWindowsServerPorts(config(),binding)).toThrow();
});
it("bounded stdin refuses oversized streaming requests without parsing or admission",async()=>{
 async function* chunks(){yield Buffer.alloc(3000,120);yield Buffer.alloc(3000,120);}
 await expect(readWindowsControllerInput(chunks())).rejects.toThrow("INPUT_BOUND");
});
it.each(["success","timeout","overflow","interrupted","pipe-error","spawn-error"])("labelled supervisor process double: %s preserves uncertain failure and removes signal handlers",async fault=>{
 const before=process.listenerCount("SIGTERM"),child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),exitCode:null,killed:false,kill:vi.fn(()=>true)});
 const start=vi.fn(()=>child),pending=controllerDeadlineProcess(wire(),start as any);
 expect(start).toHaveBeenCalledWith("/usr/bin/timeout",["--signal=TERM","--kill-after=5s","100s",process.execPath,expect.any(String),"--controller-worker"],{shell:false,stdio:["pipe","pipe","ignore"]});
 expect(child.stdin.end).toHaveBeenCalledWith(wire());expect(process.listenerCount("SIGTERM")).toBe(before+1);
 if(fault==="success"){child.stdout.emit("data",Buffer.from("PRIVATE_PIPE_RESULT"));child.emit("close",0);expect(await pending).toBe("PRIVATE_PIPE_RESULT");}
 else {
  if(fault==="overflow")child.stdout.emit("data",Buffer.alloc(20_481));
  if(fault==="interrupted")process.emit("SIGTERM");
  if(fault==="pipe-error")child.stdin.emit("error",Error("PRIVATE"));
  if(fault==="spawn-error")child.emit("error",Error("PRIVATE"));else child.emit("close",fault==="timeout"?124:0);
  await expect(pending).rejects.toThrow(/SUPERVISOR_UNAVAILABLE|UNCERTAIN_OUTCOME_RECONCILE/);
  if(["overflow","interrupted","pipe-error"].includes(fault))expect(child.kill).toHaveBeenCalledWith("SIGTERM");
 }
 expect(process.listenerCount("SIGTERM")).toBe(before);
});
it.each(["success","timeout","overflow","invalid-output","interrupted"])("labelled in-container process double: %s cannot claim Docker CLI teardown as probe completion",async fault=>{
 vi.useFakeTimers();const entry=process.argv[1];process.argv[1]="/app/dist/portable/browser-probe.mjs";
 const child=Object.assign(new EventEmitter(),{stdout:new EventEmitter(),stderr:new EventEmitter(),stdin:Object.assign(new EventEmitter(),{end:vi.fn()}),exitCode:null,killed:false,kill:vi.fn(()=>true)}),before=process.listenerCount("SIGTERM"),start=vi.fn(()=>child);
 try{
  const pending=windowsProbeProcess(raw,start as any);expect(start).toHaveBeenCalledWith(["/app/dist/portable/browser-probe.mjs","windows-native","--windows-native-worker"]);expect(child.stdin.end).toHaveBeenCalledWith(raw);
  if(fault==="success"){child.stdout.emit("data",Buffer.from(JSON.stringify({token:"123456"})));child.emit("close",0);expect(await pending).toEqual({token:"123456"});}
  else {
   if(fault==="timeout"){await vi.advanceTimersByTimeAsync(75_000);expect(child.kill).toHaveBeenCalledWith("SIGTERM");await vi.advanceTimersByTimeAsync(3000);expect(child.kill).toHaveBeenCalledWith("SIGKILL");}
   if(fault==="overflow")child.stdout.emit("data",Buffer.alloc(16_385));
   if(fault==="invalid-output")child.stdout.emit("data",Buffer.from(JSON.stringify({token:"123456",privateKey:"forbidden"})));
   if(fault==="interrupted")process.emit("SIGTERM");
   child.emit("close",0);await expect(pending).rejects.toThrow("UNCERTAIN_OUTCOME_RECONCILE");
  }
  expect(process.listenerCount("SIGTERM")).toBe(before);expect(vi.getTimerCount()).toBe(0);
 }finally{process.argv[1]=entry;vi.useRealTimers();}
});
it("uncertain transport outcome stays explicit through the real server-port consumer without retry",async()=>{
 const invoke=vi.fn(async()=>{throw Error("WINDOWS_PRIVATE_TRANSPORT_UNCERTAIN_OUTCOME_RECONCILE");});
 const ports=new WindowsServerPorts(binding,invoke,()=>{},"x".repeat(48),"y".repeat(48));
 await expect(ports.totp()).rejects.toThrow("WINDOWS_SERVER_UNCERTAIN_OUTCOME_RECONCILE");expect(invoke).toHaveBeenCalledOnce();ports.clear();
});
