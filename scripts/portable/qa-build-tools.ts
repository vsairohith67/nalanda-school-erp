import {readFileSync,writeFileSync,mkdirSync,lstatSync,readdirSync,realpathSync} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {hashBytes} from "./artifact-handoff";
import {assertEphemeralCi} from "./operator-adapter";
import {admitArtifact} from "./admit-artifact";
import {producerIdentity,validateProducerRoot,type ProducerIdentity} from "./synthetic-build-lifecycle";
import {producerProcess} from "./producer-process";

export function buildToolPins(workspace:string,identity:ProducerIdentity){
 const pins=JSON.parse(readFileSync(path.join(workspace,"config/qa-build-tools.json"),"utf8"));
 if(pins.contract!=="NALANDA_QA_BUILD_TOOLS_V1")throw Error("QA_BUILD_TOOL_PINS_INVALID");
 const selected=pins[identity.architecture];
 for(const name of ["buildkit","rootlesskit"]){const p=selected?.[name];if(!p||!/^https:\/\/github\.com\/(moby\/buildkit|rootless-containers\/rootlesskit)\/releases\/download\/v[0-9.]+\/[\w.-]+\.tar\.gz$/.test(p.url)||!/^[a-f0-9]{64}$/.test(p.sha256))throw Error("QA_BUILD_TOOL_PINS_INVALID");}
 return {pins,selected};
}
export function verifyToolArchive(bytes:Buffer,expected:string){if(bytes.length<1000||bytes.length>200*1024*1024||hashBytes(bytes)!==expected)throw Error("QA_BUILD_TOOL_CHECKSUM_MISMATCH");}
export function validateToolEntries(names:string,listing:string){
 if(!names.trim()||names.split(/\r?\n/).filter(Boolean).some(n=>! /^(?:bin\/)?[a-zA-Z0-9._+-]+\/?$/.test(n)||n===".."||n.includes("/.."))||listing.split(/\r?\n/).filter(Boolean).some(n=>!/^[-d]/.test(n)))throw Error("QA_BUILD_TOOL_ARCHIVE_UNSAFE");
}
export async function prepareBuildTools(workspace:string,identity:ProducerIdentity,signal?:AbortSignal){
 if(signal?.aborted)throw Error("QA_BUILD_TOOL_PREPARATION_CANCELLED");
 const work=validateProducerRoot(workspace,identity,"work"),{pins,selected}=buildToolPins(workspace,identity),tools=path.join(work,"tools");mkdirSync(tools,{mode:0o700});
 const run=(tool:string,args:string[])=>producerProcess({stage:"prepare-build-tools",tool,args},workspace,signal);
 for(const name of ["buildkit","rootlesskit"]){
  const timeout=AbortSignal.timeout(120_000);
  const response=await fetch(selected[name].url,{signal:signal?AbortSignal.any([timeout,signal]):timeout});if(!response.ok||Number(response.headers.get("content-length"))>200*1024*1024)throw Error("QA_BUILD_TOOL_DOWNLOAD_FAILED");
  const parts:Buffer[]=[];let size=0;if(!response.body)throw Error("QA_BUILD_TOOL_BODY_MISSING");const reader=response.body.getReader();try{while(true){const next=await reader.read();if(next.done)break;const b=Buffer.from(next.value);size+=b.length;if(size>200*1024*1024)throw Error("QA_BUILD_TOOL_DOWNLOAD_BOUND");parts.push(b);}}finally{await reader.cancel();reader.releaseLock();}
  const bytes=Buffer.concat(parts);verifyToolArchive(bytes,selected[name].sha256);
  const archive=path.join(tools,`${name}.tar.gz`),destination=path.join(tools,name);writeFileSync(archive,bytes,{flag:"wx",mode:0o600});mkdirSync(destination,{mode:0o700});
  validateToolEntries(await run("tar",["-tzf",archive]),await run("tar",["-tvzf",archive]));await run("tar",["-xzf",archive,"-C",destination,"--no-same-owner"]);
 }
 const files:Record<string,string>={};
 const visit=(dir:string)=>{for(const name of readdirSync(dir)){const file=path.join(dir,name),stat=lstatSync(file);if(stat.isSymbolicLink()||realpathSync(file)!==file||(stat.mode&0o6022))throw Error("QA_BUILD_TOOL_FILE_UNSAFE");if(stat.isDirectory())visit(file);else{if(!stat.isFile()||stat.nlink!==1)throw Error("QA_BUILD_TOOL_FILE_UNSAFE");files[path.relative(tools,file)]=hashBytes(readFileSync(file));}}};visit(tools);
 writeFileSync(path.join(tools,"identity.json"),JSON.stringify({...identity,files}),{flag:"wx",mode:0o400});
 const bin=path.join(tools,"buildkit/bin"),rootless=path.join(tools,"rootlesskit/rootlesskit");
 if(!(await run(path.join(bin,"buildkitd"),["--version"])).includes(pins.buildkitVersion)||!(await run(rootless,["--version"])).includes(pins.rootlesskitVersion.replace(/^v/,"")))throw Error("QA_BUILD_TOOL_VERSION_MISMATCH");
 // No sysctl, AppArmor, capability, device or privileged-container workaround.
 if(process.getuid?.()===0)throw Error("QA_ROOTLESS_USER_REQUIRED");
 await run(rootless,["--state-dir",path.join(work,"rootless-preflight"),"--pidns","/bin/true"]);
}
export function verifiedBuildTools(workspace:string,identity:ProducerIdentity){
 const work=validateProducerRoot(workspace,identity,"work"),tools=path.join(work,"tools"),file=path.join(tools,"identity.json");
 if(lstatSync(file).isSymbolicLink()||realpathSync(file)!==file)throw Error("QA_BUILD_TOOL_IDENTITY_UNSAFE");
 const recorded=JSON.parse(readFileSync(file,"utf8"));for(const key of ["source","runId","attempt","architecture"] as const)if(recorded[key]!==identity[key])throw Error("QA_BUILD_TOOL_IDENTITY_MISMATCH");
 for(const [relative,expected] of Object.entries(recorded.files??{})){const target=path.resolve(tools,relative);if(!target.startsWith(tools+path.sep)||lstatSync(target).isSymbolicLink()||realpathSync(target)!==target||hashBytes(readFileSync(target))!==expected)throw Error("QA_BUILD_TOOL_SUBSTITUTED");}
 const {selected}=buildToolPins(workspace,identity);for(const name of ["buildkit","rootlesskit"])verifyToolArchive(readFileSync(path.join(tools,`${name}.tar.gz`)),selected[name].sha256);
 return {work,bin:path.join(tools,"buildkit/bin"),rootless:path.join(tools,"rootlesskit/rootlesskit")};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)void (async()=>{assertEphemeralCi();const identity=producerIdentity();admitArtifact(path.resolve("artifact-evidence"));await prepareBuildTools(process.cwd(),identity);console.log("QA_PINNED_ROOTLESS_TOOLS_PREPARED");})().catch(()=>{console.error("QA_BUILD_TOOL_OR_ROOTLESS_PREFLIGHT_FAILED");process.exitCode=1;});
