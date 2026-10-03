import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFileSync,lstatSync,writeFileSync} from "node:fs";
import path from "node:path";
import {nativeJson,nativeOwnedPath,verifyNativeReceipt,verifyNativeOutputs} from "./native-artifact";
import {validateProducerRoot} from "./synthetic-build-lifecycle";
import {validateWindowsTarget,runWindowsAuthentication,unlockWindows,type WindowsTarget,type WindowsLifecycleHost,type ProcessIdentity} from "./windows-auth-lifecycle";
import {OwnedWindowsWebDriver,privateWindowsOs,assertWindowsFile,type WindowsTools} from "./windows-webdriver-host";
import {createPrivateWindowsChannel,createPrivateWindowsServerPorts,validateWindowsPrivateTransport,type WindowsPrivateTransport} from "./windows-private-transport";
import {createWindowsQaTrust} from "./windows-qa-trust";
import {OwnedWindowsApplicationForward} from "./windows-forwarding";
import {admitWindowsNativeLaunch} from "./native-launch-admission";
import {validateNativeQaProfile} from "./native-qa-profile";
import {assertOriginalObservation,assertCallbackObservation,readNativeObservation,pendingNativeObservation,checkEarlyWindowsPrivacy} from "./windows-observation";
import type {WindowsServerPorts} from "./windows-server-adapter";
import type {NativeWebDriver} from "./native-webdriver";
import {OwnedWindowsProcessObserver,assertProtocolLaunch} from "./windows-process-observer";

export type WindowsConnectedInput={target:WindowsTarget;tools:WindowsTools;transport:WindowsPrivateTransport};
const targetFields="source runId attempt architecture appId profile origin artifactSha256 executable root userSid userProfile roaming local browserData appData webviewData tauriDriverVersion webviewVersion webviewDriverVersion browserVersion browserDriverVersion".split(" ");
export function validateWindowsTools(tools:WindowsTools){
 assert.deepEqual(Object.keys(tools).sort(),["tauri","webviewDriver","browserDriver","browser","webview","tauriPort","nativePort","browserPort","debugPort"].sort());
 for(const name of ["tauri","webviewDriver","browserDriver","browser","webview"] as const){const t=tools[name];assert(t&&typeof t==="object");assert.deepEqual(Object.keys(t).sort(),["path","sha256","version"]);assert(typeof t.path==="string"&&t.path.length<=400&&/^[a-f0-9]{64}$/.test(t.sha256)&&typeof t.version==="string"&&t.version.length<=80);}
 const ports=[tools.tauriPort,tools.nativePort,tools.browserPort,tools.debugPort];assert(new Set(ports).size===4&&ports.every(p=>Number.isInteger(p)&&p>=1024&&p<=65535&&p!==8443));
}
/** Same-job producer handoff. The recipe cannot assert a final digest: the
 * existing trusted receipt and raw output verifier supply both launch inputs. */
export function resolveWindowsConnectedRecipe(value:any):WindowsConnectedInput{
 assert(value&&typeof value==="object");assert.deepEqual(Object.keys(value).sort(),["contract","target","tools","transport"]);assert.equal(value.contract,"NALANDA_WINDOWS_CONNECTED_RECIPE_V1");
 assert.deepEqual(Object.keys(value.target).sort(),targetFields.filter(k=>!["artifactSha256","executable"].includes(k)).sort());validateWindowsTools(value.tools);
 const t=value.target;validateWindowsPrivateTransport(value.transport,{source:process.env.EXPECTED_SHA!,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!});
 for(const k of ["source","runId","attempt","root","userSid"])assert.equal(t[k],value.transport[k]);
 const channel=createPrivateWindowsChannel(value.transport,t),{context}=channel.native();
 const work=validateProducerRoot(t.root,{source:t.source,runId:t.runId,attempt:t.attempt,architecture:"amd64"},"work"),file=nativeOwnedPath(work,"native-receipt.json");assert(lstatSync(file).size<=65536);
 const inventory=verifyNativeReceipt(nativeJson(readFileSync(file)),context),executable=verifyNativeOutputs(work,inventory);
 return {target:{...t,executable,artifactSha256:inventory.outputs[0].sha256},tools:value.tools,transport:value.transport};
}
/** Actual runtime construction. No caller-supplied implementation/admission,
 * callback, database URL, credential result or success Boolean is accepted. */
export function createConnectedWindowsHost(input:WindowsConnectedInput){
 assert(input&&typeof input==="object");assert.deepEqual(Object.keys(input).sort(),["target","tools","transport"]);
 assert.deepEqual(Object.keys(input.target).sort(),targetFields.slice().sort());validateWindowsTools(input.tools);
 const target=validateWindowsTarget(input.target,{source:process.env.EXPECTED_SHA!,runId:process.env.GITHUB_RUN_ID!,attempt:process.env.GITHUB_RUN_ATTEMPT!});
 validateWindowsPrivateTransport(input.transport,target);
 const driver=new OwnedWindowsWebDriver(target,input.tools,undefined,undefined,input.transport),forward=new OwnedWindowsApplicationForward(input.transport);
 const processObserver=new OwnedWindowsProcessObserver(target);
 let trust:ReturnType<typeof createWindowsQaTrust>|undefined,trustAttempted=false,profileClaimed=false,cleanupAttempted=false,cleanupFailed=false,driverAttempted=false,admitted=false;
 let started:Awaited<ReturnType<OwnedWindowsWebDriver["start"]>>|undefined,server:WindowsServerPorts|undefined;
 const originals=new Map<string,string>(),instances=new Map<number,string>();
 const launches=new Map<string,{after:number;parents:ProcessIdentity[]}>();
 const channel=()=>createPrivateWindowsChannel(input.transport,target);
 const admit=async()=>{await admitWindowsNativeLaunch(target,input.transport);admitted=true;return target;};
 const bind=async(p:ProcessIdentity)=>{await forward.bind();trust!.verify();await driver.bind(p);const o=readNativeObservation(target,p);const previous=instances.get(p.pid);if(previous)assert.equal(o.instance,previous,"WINDOWS_PROCESS_OBSERVATION_REPLACED");else instances.set(p.pid,o.instance);};
 const useServer=()=>{assert(server,"WINDOWS_FRESH_DEVICE_FIXTURE_NOT_PREPARED");return server;};
 const original=async(browser:NativeWebDriver)=>{
  assert(started);await bind(started.instance);const raw=await driver.original(browser),o=readNativeObservation(target,started.instance);
  const device=assertOriginalObservation(o,raw,target.origin);originals.set(device.requestId,raw);launches.set(device.requestId,{after:Date.now(),parents:driver.browserProcesses()});if(server)server.observe(raw);return raw;
 };
 const cleanup=async()=>{
  if(cleanupAttempted){if(cleanupFailed)throw Error("WINDOWS_CONNECTED_CLEANUP_INCOMPLETE_RECONCILE");return;}cleanupAttempted=true;let failed=false;
  try{evidence("PRE_TEARDOWN",false);}catch{failed=true;}
  if(driverAttempted)try{await driver.cleanup();}catch{failed=true;}
  if(server)try{await server.cleanupGoverned();}catch{failed=true;}
  try{await processObserver.cleanup();}catch{failed=true;}
  try{await forward.cleanup();}catch{failed=true;}
  if(trustAttempted)try{trust!.cleanup();}catch{failed=true;}
  // Never remove profile files while any owned process cleanup is uncertain.
  if(profileClaimed&&!failed)try{const r=privateWindowsOs({operation:"profile-cleanup",target});assert(r.state==="OWNED_PROFILES_REMOVED");}catch{failed=true;}
  server?.clear();cleanupFailed=failed;if(failed)throw Error("WINDOWS_CONNECTED_CLEANUP_INCOMPLETE_RECONCILE");
 };
 const host:WindowsLifecycleHost={
  admit,
  async launch(){assert(started,"WINDOWS_BOOTSTRAP_REQUIRED");return started;},bind,
  observeOriginalAuthorization:original,totp:()=>useServer().totp(),read:(id,response)=>useServer().read(id,response),
  approvePendingDevice:id=>useServer().approvePendingDevice(id),async revokeSession(id){await useServer().assertControl();await useServer().revokeSession(id);await useServer().assertControl();},
  async observeCallback(instance,id){
   const raw=originals.get(id);assert(raw,"WINDOWS_CALLBACK_ORIGINAL_MISSING");await bind(instance);
   for(let n=0;n<40;n++){
    await bind(instance);const o=readNativeObservation(target,instance);
    if(o.callbacks.some(c=>c.requestId===id)){
     const callback=assertCallbackObservation(o,raw,target.origin,instances.get(instance.pid)!),launch=launches.get(id);assert(launch);
     const candidates=processObserver.events().filter(e=>Date.parse(e.at)>=launch.after&&e.userSid===target.userSid);
     for(const event of candidates){
      assertProtocolLaunch(event,target,launch.parents,launch.after,driver.currentBrowserProcesses());
      const child=pendingNativeObservation(target,{pid:event.pid,created:event.at,executable:target.executable,sha256:target.artifactSha256,userSid:target.userSid});
      if(child?.callbacks.some(c=>c.requestId===id&&c.callbackHash===callback.callbackHash&&c.delivery==="COLD_ARGUMENT"))return;
     }
    }
    await new Promise(r=>setTimeout(r,250));
   }
   throw Error("WINDOWS_CALLBACK_DELIVERY_NOT_OBSERVED");
  },
  async assertCallbackProcessed(instance,id){
   await bind(instance);
   for(let n=0;n<40;n++){
    const o=readNativeObservation(target,instance),rows=o.exchanges.filter(e=>e.requestId===id);assert(rows.length<=1,"WINDOWS_CALLBACK_DUPLICATE_EXCHANGE");
    if(rows.length===1){const r=await useServer().read(id);assert(r.requestStatus==="CONSUMED"&&r.sessionId===rows[0].sessionId&&r.sessionRevoked===false&&r.mfaEvidence.status==="VERIFIED","WINDOWS_CALLBACK_NOT_ACCEPTED_BY_SERVER");return;}
    await new Promise(r=>setTimeout(r,250));
   }
   throw Error("WINDOWS_CALLBACK_PROCESSING_NOT_OBSERVED");
  },
  async beforeCallbackLaunch(){
   // Confirm can cause the OS to execute the registered binary immediately.
   // Re-admit after browser/MFA waiting and before that rendered action.
   await forward.bind();trust!.verify();await driver.verifyCallbackEnvironment();
   const admission=await admitWindowsNativeLaunch(target,input.transport);admission.verifyFiles();
  },
  async closeForCallback(p){assert(started);await checkEarlyWindowsPrivacy(started.app);await driver.closeForCallback(p);},
  async observeColdCallback(id){
   assert(started);const raw=originals.get(id),launch=launches.get(id);assert(raw&&launch,"WINDOWS_COLD_ORIGINAL_REQUIRED");
   for(let n=0;n<40;n++){
    await forward.bind();trust!.verify();
    for(const event of processObserver.events().filter(e=>Date.parse(e.at)>=launch.after)){
     assertProtocolLaunch(event,target,launch.parents,launch.after,driver.currentBrowserProcesses());
     const rows=privateWindowsOs({operation:"processes",executable:target.executable}) as ProcessIdentity[];
     const p=rows.find(p=>p.pid===event.pid);if(!p)continue;
     assert(rows.length===1&&p.userSid===target.userSid&&p.sha256===target.artifactSha256&&Math.abs(Date.parse(p.created)-Date.parse(event.at))<1000,"WINDOWS_COLD_INSTANCE_SUBSTITUTED");
     const o=pendingNativeObservation(target,p);if(!o?.callbacks.some(c=>c.requestId===id))continue;
     const c=assertCallbackObservation(o,raw,target.origin,o.instance);
     assert(c.delivery==="COLD_ARGUMENT"&&p.pid!==started.instance.pid,"WINDOWS_COLD_DELIVERY_REQUIRED");
     const next=await driver.attachCold(p);next.app.requireEarlyPrivacy=true;started={...started,...next};await bind(p);await checkEarlyWindowsPrivacy(next.app);return next;
    }
    await new Promise(r=>setTimeout(r,250));
   }
   throw Error("WINDOWS_COLD_OS_CALLBACK_NOT_OBSERVED");
  },
  async restart(p){assert(started);await checkEarlyWindowsPrivacy(started.app);await forward.bind();const next=await driver.restart(p);next.app.requireEarlyPrivacy=true;started={...started,...next};await bind(next.instance);await checkEarlyWindowsPrivacy(next.app);return next;},
  async background(p){await driver.background(p);},async foreground(p){await forward.bind();await driver.foreground(p);},
  assertProfilePreserved:()=>driver.profilePreserved(),cleanup,
 };
 async function prepare(){
  await admit();const {context}=channel().native(),p=validateNativeQaProfile(context.trust,context.profile);
  assert.equal(p.origin,target.origin);
  await driver.preflight();
  const claim=privateWindowsOs({operation:"profile-claim",target});assert.equal(claim.state,"FRESH_PROFILES_CLAIMED");profileClaimed=true;
  trust=createWindowsQaTrust({root:target.root,userSid:target.userSid,source:target.source,runId:target.runId,attempt:target.attempt,origin:p.origin,databaseSha256:p.databaseSha256,nativeBuildId:p.nativeBuildId},context.trust,context.profile);
  trustAttempted=true;trust.prepare();trust.verify();await forward.start();await processObserver.start();driverAttempted=true;started=await driver.start();started.app.requireEarlyPrivacy=true;await bind(started.instance);await checkEarlyWindowsPrivacy(started.app);
  const pin=String(10000000+randomBytes(4).readUInt32BE()%90000000),wrongPin=pin==="31415926"?"27182818":"31415926";
  await unlockWindows(started.app,pin);assert(!(await started.app.body()).includes("compatibility READY"),"WINDOWS_FRESH_PIN_IS_NOT_AUTH");
  await started.app.clickText("Security");await started.app.clickText("Connect through system browser");await driver.background(started.instance);
  const raw=await original(started.browser),o=readNativeObservation(target,started.instance);assert(o.device);
  server=createPrivateWindowsServerPorts(input.transport,{source:target.source,runId:target.runId,attempt:target.attempt,iteration:randomUUID(),phase:"synthetic-ON",databaseIdentitySha256:p.databaseSha256,publicDeviceId:o.device.publicDeviceId,publicKeyHash:o.device.publicKeyHash});
  const fixture=await server.prepare(raw);await server.prepareControl(fixture.userId);await started.browser.command("POST","/url",{url:target.origin+"/login"});
  await started.app.waitText("Welcome back");
  const canaries=[...fixture.expectedStudents];
  return {...fixture,pin,wrongPin,canaries};
 }
 const evidence=(state:"PRE_TEARDOWN"|"COMPLETE"|"FAILED"|"CLEANUP_REFUSED",success:boolean)=>{
  if(!admitted)return;
  const file=path.join(target.root,state==="PRE_TEARDOWN"?"windows-connected-pre-teardown.json":"windows-connected-result.json");assertWindowsFile(file,target.root);
  writeFileSync(file,JSON.stringify({contract:"NALANDA_WINDOWS_CONNECTED_EVIDENCE_V1",source:target.source,runId:target.runId,attempt:target.attempt,state,success,profileClaimed,driverAttempted,originalRequests:originals.size,observedInstances:instances.size,privacyBoundary:"DOCUMENT_CREATION_DOM_AND_RAF_NOT_COMPOSITOR_FRAMES",ownerDeviceCertification:false}),{flag:"wx",mode:0o600});
 };
 return {host,async run(){let success=false;try{const f=await prepare();const result=await runWindowsAuthentication(host,f);success=true;return result;}finally{
  let evidenceFailed=false;
  try{await cleanup();}finally{try{evidence(cleanupFailed?"CLEANUP_REFUSED":success?"COMPLETE":"FAILED",success&&!cleanupFailed);}catch{evidenceFailed=true;}}
  if(evidenceFailed)throw Error("WINDOWS_SANITISED_EVIDENCE_NOT_RETAINED");
 }}};
}

/** PowerShell's pipeline terminates its private stdin frame with CRLF. Keep
 * canonical duplicate-key rejection inside the bounded whitespace frame. */
export function parseWindowsConnectedInput(bytes:Buffer){
 assert(bytes.length>0&&bytes.length<=32768,"WINDOWS_CONNECTED_INPUT_BOUND");
 return nativeJson(Buffer.from(bytes.toString("utf8").trim()));
}
/** Private stdin entrypoint. No package/profile/credential/URL output. */
export async function windowsConnectedEntrypoint(){
 let bytes=Buffer.alloc(0);const timer=setTimeout(()=>{process.stderr.write("WINDOWS_CONNECTED_INPUT_TIMEOUT\n");process.exit(1);},10000);
 try{for await(const chunk of process.stdin){bytes=Buffer.concat([bytes,Buffer.from(chunk)]);assert(bytes.length<=32768,"WINDOWS_CONNECTED_INPUT_BOUND");}}finally{clearTimeout(timer);}
 assert(bytes.length>0);const input=resolveWindowsConnectedRecipe(parseWindowsConnectedInput(bytes));
 const result=await createConnectedWindowsHost(input).run();
 return {...result,evidenceClass:"AUTHENTICATED_WINDOWS_BACKEND",journey:"CONNECTED_WD1_WD5",callbackPaths:["WARM","COLD"],privacyBoundary:"DOCUMENT_CREATION_DOM_AND_RAF_NOT_COMPOSITOR_FRAMES",cleanup:"VERIFIED",nativeAggregate:"PARTIAL_OTHER_MANDATORY_RELEASE_GATES"};
}
if(/(?:^|[\\/])windows-connected-host\.(?:ts|mjs)$/.test(process.argv[1]??"")){
 windowsConnectedEntrypoint().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error("WINDOWS_CONNECTED_JOURNEY_FAILED_PRIVATE_DETAILS_WITHHELD");process.exitCode=1;});
}
