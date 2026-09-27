import assert from "node:assert/strict";
import {execFileSync} from "node:child_process";
import {randomBytes} from "node:crypto";
import {readFileSync,lstatSync} from "node:fs";
import path from "node:path";
import {hashBytes} from "./artifact-handoff";
import {assertWindowsFile,privateWindowsOs} from "./windows-webdriver-host";
import {WindowsServerPorts} from "./windows-server-adapter";
import {insideWindowsRoot} from "./windows-auth-lifecycle";
import {parseWindowsProbe,validateWindowsProbeResult,windowsProbeBinding,type WindowsProbeBinding} from "./windows-server-contract";
import type {WindowsControllerTarget} from "./windows-controller";

export type WindowsPrivateTransport={
 contract:"NALANDA_WINDOWS_PRIVATE_SSH_V1";root:string;userSid:string;
 source:string;runId:string;attempt:string;controllerAddress:string;controllerPort:number;controllerUser:string;
 sshExecutable:string;sshSha256:string;knownHosts:string;hostPublicKey:string;identityFile:string;identitySha256:string;
 containerId:string;imageConfigDigest:string;
};
const fields=["contract","root","userSid","source","runId","attempt","controllerAddress","controllerPort","controllerUser","sshExecutable","sshSha256","knownHosts","hostPublicKey","identityFile","identitySha256","containerId","imageConfigDigest"];
/** Manifest fields are constraints, not admission. The authenticated controller
 * must independently qualify the backend before any probe invocation. */
export function validateWindowsPrivateTransport(v:WindowsPrivateTransport,b:Pick<WindowsProbeBinding,"source"|"runId"|"attempt">){
 assert(v&&typeof v==="object");assert.deepEqual(Object.keys(v).sort(),[...fields].sort());
 assert.equal(v.contract,"NALANDA_WINDOWS_PRIVATE_SSH_V1");
 for(const k of ["source","runId","attempt"] as const)assert.equal(v[k],b[k],"WINDOWS_TRANSPORT_RUN_BINDING");
 assert(/^[a-f0-9]{40}$/.test(v.source)&&/^\d{1,20}$/.test(v.runId)&&/^\d{1,6}$/.test(v.attempt));
 const parts=v.controllerAddress.split(".");assert(parts.length===4&&parts.every(p=>/^(0|[1-9]\d{0,2})$/.test(p)&&Number(p)<256));
 const n=parts.map(Number);assert(n[0]===10||(n[0]===172&&n[1]>=16&&n[1]<=31)||(n[0]===192&&n[1]===168),"WINDOWS_PRIVATE_CONTROLLER_REQUIRED");
 assert(Number.isInteger(v.controllerPort)&&v.controllerPort>=1&&v.controllerPort<=65535);
 assert(/^[a-z][a-z0-9_-]{0,30}$/.test(v.controllerUser));assert(/^S-1-5-21-(?:\d+-){3}\d+$/.test(v.userSid));
 assert.equal(path.win32.basename(v.root),`run-${v.runId}-${v.attempt}`);
 assert(/^ssh-ed25519 [A-Za-z0-9+/]{68}={0,2}$/.test(v.hostPublicKey),"WINDOWS_PINNED_HOST_KEY_REQUIRED");
 const key=Buffer.from(v.hostPublicKey.split(" ")[1],"base64");assert(key.length===51&&key.readUInt32BE(0)===11&&key.subarray(4,15).toString()==="ssh-ed25519"&&key.readUInt32BE(15)===32,"WINDOWS_HOST_KEY_INVALID");
 for(const value of [v.sshSha256,v.identitySha256,v.containerId])assert(/^[a-f0-9]{64}$/.test(value));assert(/^sha256:[a-f0-9]{64}$/.test(v.imageConfigDigest));
 assert(new Set([v.sshExecutable,v.knownHosts,v.identityFile].map(f=>path.win32.normalize(f).toLowerCase())).size===3,"WINDOWS_TRANSPORT_PATH_COLLISION");
 for(const file of [v.sshExecutable,v.knownHosts,v.identityFile]){insideWindowsRoot(v.root,file);assert(!/[\x00-\x1f\x7f"%$`{}~*?]/.test(file),"WINDOWS_SSH_PATH_EXPANSION_REFUSED");}
 return v;
}
export function windowsPrivateSshArguments(v:WindowsPrivateTransport){
 // No remote command or caller-controlled extra options. The existing server
 // account/key MUST be restricted to the fixed controller forced-command.
 return ["-T","-F","NUL","-p",String(v.controllerPort),"-i",v.identityFile,
  "-o","BatchMode=yes","-o","StrictHostKeyChecking=yes","-o",`UserKnownHostsFile="${v.knownHosts.replaceAll("\\","/")}"`,
  "-o","GlobalKnownHostsFile=NUL","-o","HostKeyAlgorithms=ssh-ed25519","-o","UpdateHostKeys=no",
  "-o","IdentitiesOnly=yes","-o","IdentityAgent=none","-o","ForwardAgent=no","-o","ForwardX11=no",
  "-o","ClearAllForwardings=yes","-o","PermitLocalCommand=no","-o","ProxyCommand=none","-o","ProxyJump=none",
  "-o","PasswordAuthentication=no","-o","KbdInteractiveAuthentication=no","-o","ConnectTimeout=10",
  "-o","ServerAliveInterval=10","-o","ServerAliveCountMax=2",`${v.controllerUser}@${v.controllerAddress}`];
}
export function validateWindowsControllerEnvelope(text:string,input:string,expected:WindowsControllerTarget){
 assert(Buffer.byteLength(text)<=20_480,"WINDOWS_TRANSPORT_OUTPUT_BOUND");const e=JSON.parse(text);
 assert.deepEqual(Object.keys(e).sort(),["contract","source","runId","attempt","containerId","imageConfigDigest","result"].sort());
 assert.equal(e.contract,"NALANDA_WINDOWS_CONTROLLER_V1");
 for(const k of ["source","runId","attempt","containerId","imageConfigDigest"] as const)assert.equal(e[k],expected[k],"WINDOWS_CONTROLLER_SUBSTITUTED");
 const operation=parseWindowsProbe(input).operation;return validateWindowsProbeResult(operation,e.result);
}
/** Real Windows OpenSSH stdin transport. It needs an already authorised private
 * route and pinned controller account; it does not create either. No files are
 * uploaded and neither SSH diagnostics nor private probe output is logged. */
export function createPrivateWindowsServerPorts(config:WindowsPrivateTransport,binding:WindowsProbeBinding){
 windowsProbeBinding.parse(binding);const v=Object.freeze({...validateWindowsPrivateTransport(config,binding)});
 const bind=()=>{
  assert.equal(process.platform,"win32");assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.RUNNER_ENVIRONMENT,"github-hosted");assert.equal(process.env.RUNNER_OS,"Windows");assert.equal(process.env.PORTABLE_CI_EXCEPTION,"OWNER_AUTHORIZED");
  assert.equal(process.env.GITHUB_REPOSITORY,"vsairohith67/nalanda-school-erp");assert.equal(process.env.EXPECTED_SHA,v.source);assert.equal(process.env.GITHUB_RUN_ID,v.runId);assert.equal(process.env.GITHUB_RUN_ATTEMPT,v.attempt);
  assert.equal(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),v.source);
  assert.equal(hashBytes(readFileSync("scripts/portable/windows-host.ps1")),hashBytes(execFileSync("git",["show",`${v.source}:scripts/portable/windows-host.ps1`])),"WINDOWS_HOST_SOURCE_CHANGED");
  for(const file of [v.sshExecutable,v.knownHosts,v.identityFile]){assertWindowsFile(file,v.root);const s=lstatSync(file);assert(s.isFile()&&s.nlink===1&&s.size>0&&s.size<20*1024*1024);}
  assert.equal(hashBytes(readFileSync(v.sshExecutable)),v.sshSha256);assert.equal(hashBytes(readFileSync(v.identityFile)),v.identitySha256);
  const host=v.controllerPort===22?v.controllerAddress:`[${v.controllerAddress}]:${v.controllerPort}`;
  assert.equal(readFileSync(v.knownHosts,"utf8"),`${host} ${v.hostPublicKey}\n`,"WINDOWS_HOST_KEY_FILE_CHANGED");
  for(const file of [v.root,v.sshExecutable,v.identityFile,v.knownHosts])assertPrivateWindowsAcl(privateWindowsOs({operation:"file-security",file}),v.userSid);
 };
 bind();
 const invoke=async(raw:string)=>{
  // Both the parent and fixed remote dispatcher parse before execution.
  parseWindowsProbe(raw);bind();
  try{
   const text=execFileSync(v.sshExecutable,windowsPrivateSshArguments(v),{input:JSON.stringify({containerId:v.containerId,imageConfigDigest:v.imageConfigDigest,input:raw}),encoding:"utf8",stdio:["pipe","pipe","pipe"],windowsHide:true,timeout:120_000,maxBuffer:20_480,
    env:{NODE_ENV:process.env.NODE_ENV,SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP}});
   bind();return JSON.stringify(validateWindowsControllerEnvelope(text,raw,v));
  }catch{throw Error("WINDOWS_PRIVATE_TRANSPORT_UNCERTAIN_OUTCOME_RECONCILE");}
 };
 return new WindowsServerPorts(binding,invoke,bind,randomBytes(48).toString("base64url"),randomBytes(48).toString("base64url"));
}
export function assertPrivateWindowsAcl(value:{userSid:string;owner:string;protected:boolean;rules:Array<{sid:string;type:string;inherited:boolean}>},sid:string){
 assert(value.userSid===sid&&value.owner===sid&&value.protected===true,"WINDOWS_PRIVATE_FILE_OWNER");
 assert(value.rules.length>0&&value.rules.length<=8&&value.rules.some(r=>r.sid===sid&&r.type==="Allow"));
 assert(value.rules.every(r=>!r.inherited&&r.type==="Allow"&&[sid,"S-1-5-18","S-1-5-32-544"].includes(r.sid)),"WINDOWS_PRIVATE_FILE_ACL");
}
