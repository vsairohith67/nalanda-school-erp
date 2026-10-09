import assert from "node:assert/strict";
import {execFileSync,spawn,type ChildProcess} from "node:child_process";
import {createHash} from "node:crypto";
import {lstatSync,readFileSync,realpathSync,existsSync,readdirSync} from "node:fs";
import path from "node:path";
import {NativeWebDriver} from "./native-webdriver";
import {admitWindowsNativeLaunch} from "./native-launch-admission";
import type {WindowsPrivateTransport} from "./windows-private-transport";
import {assertOwnedProcess,insideWindowsRoot,validateOriginalAuthorization,type ProcessIdentity,type WindowsTarget} from "./windows-auth-lifecycle";

type Tool={path:string;sha256:string;version:string};
export type WindowsTools={tauri:Tool;webviewDriver:Tool;browserDriver:Tool;browser:Tool;webview:Tool;tauriPort:number;nativePort:number;browserPort:number;debugPort:number};
type Transport=typeof fetch;
export type WindowsOs=(input:unknown)=>any;
const hash=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
/** Reject reparse points at every existing path segment, not just the leaf. */
export function assertWindowsFile(file:string,root:string,expectedHash?:string){
 insideWindowsRoot(root,file);let cursor=file;
 while(cursor!==path.parse(cursor).root){if(existsSync(cursor)){assert(!lstatSync(cursor).isSymbolicLink()&&realpathSync(cursor).toLowerCase()===path.resolve(cursor).toLowerCase(),"WINDOWS_REPARSE_PATH_REFUSED");}cursor=path.dirname(cursor);}
 if(expectedHash){assert(/^[a-f0-9]{64}$/.test(expectedHash));assert(lstatSync(file).isFile());assert.equal(hash(readFileSync(file)),expectedHash,"WINDOWS_ARTIFACT_SUBSTITUTED");}
}
export function privateWindowsOs(input:unknown){
 assert.equal(process.platform,"win32");
 return JSON.parse(execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-File",path.resolve("scripts/portable/windows-host.ps1")],{input:JSON.stringify(input),encoding:"utf8",windowsHide:true,stdio:["pipe","pipe","pipe"],timeout:30_000,maxBuffer:1024*1024}));
}
export function assertWindowsEnvironment(actual:any,t:WindowsTarget,browser?:string){
 for(const k of ["userSid","userProfile","roaming","local"] as const)assert.equal(actual[k].toLowerCase(),t[k].toLowerCase(),"WINDOWS_DISPOSABLE_PROFILE_MISMATCH");
 assert.equal(actual.browserProgId,"MSEdgeHTM","WINDOWS_PRECONFIGURED_SYSTEM_BROWSER_REQUIRED");
 assert.equal(actual.protocolCommand,`"${t.executable}" "%1"`,"WINDOWS_OWNED_PROTOCOL_HANDLER_REQUIRED");
 if(browser)assert([`"${browser}" --single-argument %1`,`"${browser}" --single-argument "%1"`].includes(actual.browserCommand),"WINDOWS_OWNED_SYSTEM_BROWSER_REQUIRED");
}
/** Supported unattended topology requires a pre-authorised, exact-origin Edge
 * protocol policy. Read only: no prompts/default-browser/policy mutation. */
export function assertBrowserProtocolPolicy(actual:any,t:WindowsTarget){
 assert.deepEqual(Object.keys(actual).sort(),["machineOverride","value"]);
 assert(actual.machineOverride===false&&typeof actual.value==="string"&&actual.value.length<=1024,"WINDOWS_PROTOCOL_POLICY_REQUIRED");
 const origin=new URL(t.origin);
 assert.deepEqual(JSON.parse(actual.value),[{protocol:"nalandaps-erp",allowed_origins:[`${origin.protocol}//.${origin.hostname}:${origin.port}`]}],"WINDOWS_PROTOCOL_POLICY_OVERBROAD_OR_MISSING");
}
export function assertOwnedWindowsListener(rows:{address:string;port:number;pid:number}[],port:number,processIds:number[]){
 assert(rows.length===1&&rows[0].address==="127.0.0.1"&&rows[0].port===port&&processIds.includes(rows[0].pid),"WINDOWS_FOREIGN_AUTOMATION_LISTENER");
}
/** Read-only prerequisite for an OS-launched WebView. These three app-specific
 * HKCU overrides must belong to the pre-authorised disposable identity. The host
 * never writes browser policy, protocol handlers or the owner's profile. */
export function assertColdWebViewPolicy(actual:any,t:WindowsTarget,tools:WindowsTools){
 assert.deepEqual(Object.keys(actual).sort(),["arguments","folder","userData","machineOverride","wildcardOverride","environmentOverride"].sort());
 assert(!actual.machineOverride&&!actual.wildcardOverride&&!actual.environmentOverride,"WINDOWS_WEBVIEW_AMBIGUOUS_POLICY");
 assert.equal(actual.arguments,`--remote-debugging-port=${tools.debugPort} --remote-debugging-address=127.0.0.1`,"WINDOWS_COLD_DEBUG_POLICY_REQUIRED");
 assert.equal(actual.folder.toLowerCase(),path.win32.dirname(tools.webview.path).toLowerCase(),"WINDOWS_COLD_RUNTIME_CHANGED");
 assert.equal(actual.userData.toLowerCase(),t.webviewData.toLowerCase(),"WINDOWS_COLD_PROFILE_CHANGED");
}
async function protocol(endpoint:string,method:string,route:string,body:unknown,transport:Transport){
 const u=new URL(endpoint);assert.equal(u.protocol,"http:");assert.equal(u.hostname,"127.0.0.1");assert.equal(u.pathname,"/");assert(!u.username&&!u.password&&!u.search&&!u.hash);
 const r=await transport(endpoint.replace(/\/$/,"")+route,{method,headers:{"content-type":"application/json"},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:"error",signal:AbortSignal.timeout(30_000)});
 const value=await r.json();assert(r.ok&&!value.value?.error,"WINDOWS_WEBDRIVER_FAILED");return value.value;
}
export async function createWindowsSession(endpoint:string,capabilities:unknown,transport:Transport=fetch){
 const result=await protocol(endpoint,"POST","/session",{capabilities:{alwaysMatch:capabilities}},transport);
 assert(typeof result.sessionId==="string"&&/^[a-zA-Z0-9-]{8,80}$/.test(result.sessionId)&&result.capabilities&&typeof result.capabilities==="object","WINDOWS_SESSION_NOT_CREATED");
 return {driver:new NativeWebDriver(endpoint,result.sessionId,transport),capabilities:result.capabilities};
}
export async function observeOriginalWindowsAuthorization(browser:NativeWebDriver,origin:string,seen:Set<string>){
 for(let attempt=0;attempt<40;attempt++){
  const handles=await browser.command("GET","/window/handles") as string[];assert(handles.length<=8,"WINDOWS_BROWSER_WINDOW_BOUND");const candidates:{url:string;handle:string}[]=[];
  for(const handle of handles){await browser.command("POST","/window",{handle});const url=await browser.command("GET","/url");if(typeof url==="string"&&url.includes("/native/authorize")&&!seen.has(url)){validateOriginalAuthorization(url,origin);candidates.push({url,handle});}}
  assert(candidates.length<=1,"WINDOWS_AMBIGUOUS_ORIGINAL_REQUEST");if(candidates.length===1){await browser.command("POST","/window",{handle:candidates[0].handle});seen.add(candidates[0].url);return candidates[0].url;}
  await new Promise(r=>setTimeout(r,250));
 }
 throw Error("WINDOWS_ORIGINAL_APP_REQUEST_NOT_OBSERVED");
}
/** Native bytes and the independently admitted backend are both required.
 * No OS profile creation, protocol registration, CA installation or downloads. */
export class OwnedWindowsWebDriver {
 private processes:ProcessIdentity[]=[];
 private children:ChildProcess[]=[];
 private sessions:NativeWebDriver[]=[];
 private appSession:NativeWebDriver|undefined;
 private saltHash:string|undefined;
 private seenRequests=new Set<string>();
 constructor(readonly target:WindowsTarget,readonly tools:WindowsTools,private readonly os:WindowsOs=privateWindowsOs,private readonly transport:Transport=fetch,private readonly admission?:WindowsPrivateTransport){}
 private async admit(){assert(this.admission,"WINDOWS_NATIVE_AND_BACKEND_ADMISSION_INPUT_REQUIRED");return admitWindowsNativeLaunch(this.target,this.admission);}
 private endpoint(port:number){return `http://127.0.0.1:${port}`;}
 private artifacts(){return [{path:this.target.executable,sha256:this.target.artifactSha256,version:"0.1.0"},...Object.values(this.tools).filter((v):v is Tool=>typeof v!=="number")];}
 private captureDescendants(){
  const candidates=this.artifacts().flatMap(tool=>(this.os({operation:"processes",executable:tool.path}) as Array<ProcessIdentity&{parentPid:number}>).map(p=>({p,tool})));
  for(let round=0;round<candidates.length;round++)for(const {p,tool} of candidates){
   const existing=this.processes.find(owned=>owned.pid===p.pid&&owned.created===p.created);if(existing){assertOwnedProcess(p,existing);continue;}
   const parent=this.processes.find(owned=>owned.pid===p.parentPid);if(!parent)continue;
   const liveParent=candidates.find(row=>row.p.pid===parent.pid)?.p;assert(liveParent,"WINDOWS_PARENT_LINEAGE_UNPROVED");assertOwnedProcess(liveParent,parent);
   assert.equal(p.sha256,tool.sha256);assert.equal(p.userSid,this.target.userSid);this.processes.push(p);
  }
  // An instance using our binaries without a proven parent is not ours to stop.
  assert(candidates.every(({p})=>this.processes.some(owned=>owned.pid===p.pid&&owned.created===p.created)),"WINDOWS_UNOWNED_DESCENDANT_RESIDUE");
 }
 private async listener(port:number,tool:Tool){
  for(let n=0;n<40;n++){this.captureDescendants();const rows=this.os({operation:"listeners",port});if(rows.length){const identities=this.processes.filter(p=>p.executable.toLowerCase()===tool.path.toLowerCase());for(const p of identities){const current=this.os({operation:"processes",executable:p.executable}).find((r:ProcessIdentity)=>r.pid===p.pid);assert(current);assertOwnedProcess(current,p);}assertOwnedWindowsListener(rows,port,identities.map(p=>p.pid));return;}await new Promise(r=>setTimeout(r,250));}
  throw Error("WINDOWS_OWNED_LISTENER_NOT_READY");
 }
 async preflight(){
  assert.equal(process.platform,"win32");assert.equal(process.env.GITHUB_ACTIONS,"true");assert.equal(process.env.RUNNER_ENVIRONMENT,"github-hosted");assert.equal(process.env.PORTABLE_CI_EXCEPTION,"OWNER_AUTHORIZED");
  assert.equal(process.env.GITHUB_RUN_ID,this.target.runId);assert.equal(process.env.GITHUB_RUN_ATTEMPT,this.target.attempt);assert.equal(process.env.EXPECTED_SHA,this.target.source);
  assert.equal(execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8"}).trim(),this.target.source);
  assert.equal(execFileSync("git",["hash-object","--path=scripts/portable/windows-host.ps1","scripts/portable/windows-host.ps1"],{encoding:"utf8"}).trim(),execFileSync("git",["rev-parse",`${this.target.source}:scripts/portable/windows-host.ps1`],{encoding:"utf8"}).trim(),"WINDOWS_HOST_SOURCE_CHANGED");
  assertWindowsEnvironment(this.os({operation:"environment"}),this.target,this.tools.browser.path);
  assertWindowsFile(this.target.executable,this.target.root,this.target.artifactSha256);
  const ports=[this.tools.tauriPort,this.tools.nativePort,this.tools.browserPort,this.tools.debugPort];assert(new Set(ports).size===4&&ports.every(p=>Number.isSafeInteger(p)&&p>=1024&&p<=65535));
  assertColdWebViewPolicy(this.os({operation:"webview-policy"}),this.target,this.tools);
  assertBrowserProtocolPolicy(this.os({operation:"browser-protocol-policy"}),this.target);
  for(const port of ports)assert.equal(this.os({operation:"listeners",port}).length,0,"WINDOWS_PORT_ALREADY_OWNED");
  assert.equal(this.tools.tauri.version,this.target.tauriDriverVersion);assert.equal(this.tools.webviewDriver.version,this.target.webviewDriverVersion);assert.equal(this.tools.browserDriver.version,this.target.browserDriverVersion);assert.equal(this.tools.browser.version,this.target.browserVersion);assert.equal(this.tools.webview.version,this.target.webviewVersion);
  for(const [key,tool] of Object.entries(this.tools)){if(typeof tool==="number")continue;assertWindowsFile(tool.path,this.target.root,tool.sha256);assert(tool.version.length>0);if(["tauri","webviewDriver","browserDriver"].includes(key)){const version=execFileSync(tool.path,["--version"],{encoding:"utf8",timeout:10_000,windowsHide:true,stdio:["ignore","pipe","pipe"]}).trim();assert(version.includes(tool.version),"WINDOWS_TOOL_VERSION_CHANGED");}}
  for(const dir of [this.target.appData,this.target.webviewData,this.target.browserData]){assertWindowsFile(dir,this.target.root);assert(!existsSync(dir)||readdirSync(dir).length===0,"WINDOWS_EXISTING_PROFILE_REFUSED");}
  for(const tool of this.artifacts())assert.equal(this.os({operation:"processes",executable:tool.path}).length,0,"WINDOWS_OWNED_BINARY_ALREADY_RUNNING");
 }
 async verifyCallbackEnvironment(){
  assertWindowsEnvironment(this.os({operation:"environment"}),this.target,this.tools.browser.path);
  assertColdWebViewPolicy(this.os({operation:"webview-policy"}),this.target,this.tools);
  assertBrowserProtocolPolicy(this.os({operation:"browser-protocol-policy"}),this.target);
  for(const tool of Object.values(this.tools)){if(typeof tool!=="number")assertWindowsFile(tool.path,this.target.root,tool.sha256);}
  await this.profilePreserved();
 }
 private async startDriver(tool:Tool,args:string[]){
  assert.equal(this.os({operation:"processes",executable:tool.path}).length,0,"WINDOWS_DRIVER_ALREADY_RUNNING");
  const child=spawn(tool.path,args,{shell:false,windowsHide:true,stdio:"ignore"});this.children.push(child);let failed=false;child.on("error",()=>{failed=true;});
  for(let n=0;n<40;n++){assert(!failed&&child.exitCode===null,"WINDOWS_DRIVER_START_FAILED");const matches=this.os({operation:"processes",executable:tool.path}) as ProcessIdentity[];const row=matches.find(p=>p.pid===child.pid);if(row){assert.equal(row.sha256,tool.sha256);assert.equal(row.userSid,this.target.userSid);this.processes.push(row);return;}await new Promise(r=>setTimeout(r,250));}
  throw Error("WINDOWS_DRIVER_START_NOT_OBSERVED");
 }
 async start(){
  // Native evidence is checked on Windows; backend admission remains on the
  // pinned private Linux controller. Neither can stand in for the other.
  await this.admit();
  await this.preflight();
  await this.startDriver(this.tools.tauri,["--host","127.0.0.1","--port",String(this.tools.tauriPort),"--native-port",String(this.tools.nativePort),"--native-driver",this.tools.webviewDriver.path]);
  await this.startDriver(this.tools.browserDriver,["--port="+this.tools.browserPort,"--allowed-ips=127.0.0.1","--allowed-origins=http://127.0.0.1"]);
  await this.listener(this.tools.browserPort,this.tools.browserDriver);
  const browserSession=await createWindowsSession(this.endpoint(this.tools.browserPort),{browserName:"MicrosoftEdge","ms:edgeOptions":{binary:this.tools.browser.path,args:["--user-data-dir="+this.target.browserData,"--no-first-run"]}},this.transport);this.sessions.push(browserSession.driver);
  assert.equal(browserSession.capabilities.browserVersion,this.target.browserVersion,"WINDOWS_ACTUAL_BROWSER_VERSION");
  this.captureDescendants();
  const app=await this.launchApp();return {...app,browser:browserSession.driver};
 }
 private async launchApp(){
  await this.admit(); // restart repeats both admissions too
  assertWindowsFile(this.target.executable,this.target.root,this.target.artifactSha256);
  await this.listener(this.tools.tauriPort,this.tools.tauri);await this.listener(this.tools.nativePort,this.tools.webviewDriver);
  const current=await this.admit(); // profile expiry/backend changes during readiness
  current.verifyFiles(); // rehash exact launch/support bytes immediately before request
  const session=await createWindowsSession(this.endpoint(this.tools.tauriPort),{"tauri:options":{application:this.target.executable,webviewOptions:{browserExecutableFolder:path.dirname(this.tools.webview.path),userDataFolder:this.target.webviewData}}},this.transport);this.sessions.push(session.driver);this.appSession=session.driver;
  assert.equal(session.capabilities.browserVersion,this.target.webviewVersion,"WINDOWS_ACTUAL_WEBVIEW_VERSION");
  const rows=this.os({operation:"processes",executable:this.target.executable}) as ProcessIdentity[];assert.equal(rows.length,1,"WINDOWS_APP_INSTANCE_AMBIGUOUS");const instance=rows[0];assert.equal(instance.sha256,this.target.artifactSha256);assert.equal(instance.userSid,this.target.userSid);this.processes.push(instance);return {app:session.driver,instance};
 }
 async bind(instance:ProcessIdentity){assertWindowsEnvironment(this.os({operation:"environment"}),this.target,this.tools.browser.path);const current=this.os({operation:"processes",executable:instance.executable});assert.equal(current.length,1);assertOwnedProcess(current[0],instance);this.captureDescendants();await this.listener(this.tools.tauriPort,this.tools.tauri);await this.listener(this.tools.browserPort,this.tools.browserDriver);}
 async profilePreserved(){
  for(const file of ["native-cache-v1.sqlite3","nalanda-native-v1.hold","nalanda-native-v1.salt"]){const full=path.join(this.target.appData,file);assertWindowsFile(full,this.target.root);assert(lstatSync(full).isFile()&&lstatSync(full).size>0,"WINDOWS_PROFILE_NOT_PRESERVED");}
  const salt=hash(readFileSync(path.join(this.target.appData,"nalanda-native-v1.salt")));if(this.saltHash)assert.equal(salt,this.saltHash,"WINDOWS_PROFILE_REPLACED");else this.saltHash=salt;
 }
 async closeForCallback(instance:ProcessIdentity){
  await this.bind(instance);await this.profilePreserved();assert(this.appSession);
  await protocol(this.appSession.endpoint,"DELETE",`/session/${this.appSession.session}`,undefined,this.transport);
  this.sessions=this.sessions.filter(s=>s!==this.appSession);this.appSession=undefined;
  const remaining=this.os({operation:"processes",executable:instance.executable}) as ProcessIdentity[];
  if(remaining.length){assert.equal(remaining.length,1);assertOwnedProcess(remaining[0],instance);this.os({operation:"stop",process:instance});}
  this.processes=this.processes.filter(p=>p!==instance);assert.equal(this.os({operation:"processes",executable:instance.executable}).length,0);
  for(let n=0;n<40;n++){if(this.os({operation:"listeners",port:this.tools.debugPort}).length===0)return;await new Promise(r=>setTimeout(r,250));}
  throw Error("WINDOWS_COLD_PREVIOUS_WEBVIEW_REMAINS");
 }
 async attachCold(instance:ProcessIdentity){
  const admitted=await this.admit();admitted.verifyFiles();
  assertColdWebViewPolicy(this.os({operation:"webview-policy"}),this.target,this.tools);
  assertBrowserProtocolPolicy(this.os({operation:"browser-protocol-policy"}),this.target);
  const rows=this.os({operation:"processes",executable:this.target.executable}) as ProcessIdentity[];
  assert.equal(rows.length,1);assertOwnedProcess(rows[0],instance);assert.equal(instance.userSid,this.target.userSid);assert.equal(instance.sha256,this.target.artifactSha256);
  this.processes.push(instance); // Caller proved OS/browser ancestry before adoption.
  await this.listener(this.tools.debugPort,this.tools.webview);
  await this.listener(this.tools.nativePort,this.tools.webviewDriver);
  const session=await createWindowsSession(this.endpoint(this.tools.nativePort),{browserName:"webview2","ms:edgeOptions":{debuggerAddress:`127.0.0.1:${this.tools.debugPort}`}},this.transport);
  this.sessions.push(session.driver);this.appSession=session.driver;
  assert.equal(session.capabilities.browserVersion,this.target.webviewVersion,"WINDOWS_COLD_WEBVIEW_VERSION");
  await this.bind(instance);await this.profilePreserved();return {app:session.driver,instance};
 }
 async restart(instance:ProcessIdentity){
  await this.closeForCallback(instance);const next=await this.launchApp();await this.profilePreserved();return next;
 }
 async background(instance:ProcessIdentity){await this.bind(instance);this.os({operation:"background",process:instance});}
 async foreground(instance:ProcessIdentity){await this.bind(instance);this.os({operation:"foreground",process:instance});}
 original(browser:NativeWebDriver){return observeOriginalWindowsAuthorization(browser,this.target.origin,this.seenRequests);}
 browserProcesses(){this.captureDescendants();return this.processes.filter(p=>p.executable.toLowerCase()===this.tools.browser.path.toLowerCase());}
 currentBrowserProcesses(){return this.os({operation:"processes",executable:this.tools.browser.path}) as ProcessIdentity[];}
 async cleanup(){
  let refused=false;
  try{this.captureDescendants();}catch{refused=true;}
  if(!refused)for(const session of [...this.sessions].reverse()){
   try{const port=Number(new URL(session.endpoint).port),tool=port===this.tools.tauriPort?this.tools.tauri:port===this.tools.nativePort?this.tools.webviewDriver:this.tools.browserDriver;await this.listener(port,tool);await protocol(session.endpoint,"DELETE",`/session/${session.session}`,undefined,this.transport);}catch{refused=true;}
  }
  // Never DELETE an unverified stale WebDriver session: it could close a foreign
  // re-used process. Verify the owned processes first, then stop by identity.
  for(const p of [...this.processes].reverse()){try{const rows=this.os({operation:"processes",executable:p.executable}) as ProcessIdentity[];const actual=rows.find(r=>r.pid===p.pid);if(actual){assertOwnedProcess(actual,p);this.os({operation:"stop",process:p});assert(!(this.os({operation:"processes",executable:p.executable}) as ProcessIdentity[]).some(r=>r.pid===p.pid));}}catch{refused=true;}}
  // A child that started but was never positively identified is deliberately
  // not killed. The disposable runner's teardown owns that unresolved residue.
  for(const child of this.children)if(child.exitCode===null&&!this.processes.some(p=>p.pid===child.pid))refused=true;
  for(const tool of this.artifacts()){try{if(this.os({operation:"processes",executable:tool.path}).length)refused=true;}catch{refused=true;}}
  if(refused)throw Error("WINDOWS_OWNED_CLEANUP_INCOMPLETE");
 }
}
