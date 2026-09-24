import assert from "node:assert/strict";
import path from "node:path";
import {NativeWebDriver,authenticateNativeBrowser} from "./native-webdriver";

export const WINDOWS_AUTH_SCENARIOS=["WD1","WD2","WD3","WD4","WD5"] as const;
const sha=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export type WindowsTarget={source:string;runId:string;attempt:string;architecture:string;appId:string;profile:string;origin:string;artifactSha256:string;executable:string;root:string;userSid:string;userProfile:string;roaming:string;local:string;browserData:string;appData:string;webviewData:string;tauriDriverVersion:string;webviewVersion:string;webviewDriverVersion:string;browserVersion:string;browserDriverVersion:string};
const samePath=(a:string,b:string)=>path.win32.normalize(a).toLowerCase()===path.win32.normalize(b).toLowerCase();
export function insideWindowsRoot(root:string,file:string){
 assert(path.win32.isAbsolute(root)&&path.win32.isAbsolute(file)&&/^[A-Za-z]:\\/.test(root)&&/^[A-Za-z]:\\/.test(file),"WINDOWS_PATH_REQUIRED");
 assert(!file.includes("..")&&!file.slice(2).includes(":"),"WINDOWS_PATH_ALIAS_REFUSED");
 const relative=path.win32.relative(root,file);assert(relative&&!relative.startsWith("..")&&!path.win32.isAbsolute(relative),"WINDOWS_FOREIGN_PATH");
}
/** Structural validation is NOT artifact admission. The host must separately
 * verify immutable build provenance, actual files/processes and backend admission. */
export function validateWindowsTarget(t:WindowsTarget,expected:{source:string;runId:string;attempt:string}){
 for(const key of ["source","runId","attempt"] as const)assert.equal(t[key],expected[key],"WINDOWS_RUN_BINDING");
 assert(/^[a-f0-9]{40}$/.test(t.source)&&/^\d+$/.test(t.runId)&&/^\d+$/.test(t.attempt));
 assert.equal(t.architecture,"x64");assert.equal(t.appId,"com.nalandaps.erp");assert.equal(t.profile,"PRIVATE_STAGING");
 assert.equal(t.origin,"https://portable-staging.localhost:8443");assert(sha.test(t.artifactSha256));assert(/^S-1-5-21-(?:\d+-){3}\d+$/.test(t.userSid));
 assert.equal(path.win32.basename(t.root),`run-${t.runId}-${t.attempt}`);
 for(const key of ["executable","userProfile","roaming","local","browserData","appData","webviewData"] as const)insideWindowsRoot(t.root,t[key]);
 assert(samePath(t.roaming,path.win32.join(t.userProfile,"AppData","Roaming"))&&samePath(t.local,path.win32.join(t.userProfile,"AppData","Local")),"WINDOWS_KNOWN_FOLDER_BINDING");
 assert(samePath(t.appData,path.win32.join(t.roaming,t.appId))&&samePath(t.webviewData,path.win32.join(t.local,t.appId)),"WINDOWS_TAURI_STORAGE_BINDING");
 assert(samePath(t.browserData,path.win32.join(t.local,"Microsoft","Edge","User Data")),"WINDOWS_DEFAULT_BROWSER_PROFILE_BINDING");
 assert(/^2\.\d+\.\d+$/.test(t.tauriDriverVersion),"WINDOWS_TAURI_DRIVER_VERSION");
 for(const k of ["webviewVersion","webviewDriverVersion","browserVersion","browserDriverVersion"] as const)assert(/^\d+\.\d+\.\d+\.\d+$/.test(t[k]),"WINDOWS_DRIVER_VERSION");
 assert.equal(t.webviewDriverVersion,t.webviewVersion,"WINDOWS_WEBVIEW_DRIVER_MISMATCH");assert.equal(t.browserDriverVersion,t.browserVersion,"WINDOWS_BROWSER_DRIVER_MISMATCH");
 return t;
}
export function validateOriginalAuthorization(raw:string,origin:string){
 assert(raw.length<4096&&raw.length>0,"WINDOWS_ORIGINAL_REQUEST_MISSING");const u=new URL(raw);
 assert.equal(u.origin,origin,"WINDOWS_AUTHORIZATION_ORIGIN");assert.equal(u.protocol,"https:");assert.equal(u.pathname,"/native/authorize");assert(!u.username&&!u.password&&!u.hash);
 assert.deepEqual([...u.searchParams.keys()].sort(),["challenge","proof","request","state"]);
 assert(uuid.test(u.searchParams.get("request")!));for(const k of ["state","challenge"])assert(/^[A-Za-z0-9_-]{43}$/.test(u.searchParams.get(k)!));assert(/^[A-Za-z0-9_-]{86}$/.test(u.searchParams.get("proof")!));
 return {requestId:u.searchParams.get("request")!,state:u.searchParams.get("state")!}; // private memory only
}
export type ProcessIdentity={pid:number;created:string;executable:string;sha256:string;userSid:string};
export function assertOwnedProcess(actual:ProcessIdentity,owned:ProcessIdentity){
 assert(Number.isSafeInteger(owned.pid)&&owned.pid>0&&sha.test(owned.sha256)&&owned.created.length>0,"WINDOWS_PROCESS_IDENTITY_REQUIRED");
 for(const k of ["pid","created","sha256","userSid"] as const)assert.equal(actual[k],owned[k],"WINDOWS_FOREIGN_PROCESS");assert(samePath(actual.executable,owned.executable),"WINDOWS_FOREIGN_EXECUTABLE");
}
export type NativeIdentity={source:string;runId:string;attempt:string;databaseIdentitySha256:string;userId:string;deviceId:string;publicDeviceId:string;sessionId:string;requestId:string;requestStatus:string;deviceStatus:string;sessionRevoked:boolean;activeSessions:number;role:string;mfaUsed:boolean;referenceStudents:string[];referenceVersion:string;tokenVersion:number;rotatedTokenVersions:number[]};
export function assertNativeIdentity(actual:NativeIdentity,expected:NativeIdentity){
 for(const k of ["source","runId","attempt","databaseIdentitySha256","userId","deviceId","publicDeviceId","sessionId","requestId","role"] as const)assert.equal(actual[k],expected[k],"WINDOWS_NATIVE_IDENTITY_MISMATCH");
 assert.equal(actual.requestStatus,"CONSUMED");assert.equal(actual.deviceStatus,"ACTIVE");assert.equal(actual.sessionRevoked,false);assert.equal(actual.activeSessions,1);assert.equal(actual.mfaUsed,true);
 assert(actual.referenceVersion.length>0);assert.deepEqual([...actual.referenceStudents].sort(),[...expected.referenceStudents].sort(),"WINDOWS_REFERENCE_SCOPE");assert(new Set(actual.referenceStudents).size===actual.referenceStudents.length);
 assert(Number.isSafeInteger(actual.tokenVersion)&&actual.tokenVersion>=1);assert.deepEqual(actual.rotatedTokenVersions,Array.from({length:actual.tokenVersion-1},(_,i)=>i+1),"WINDOWS_ROTATION_HISTORY");
}
export function assertLockedView(body:string,canaries:string[]){
 assert(body.includes("Welcome back")&&body.includes("Unlock app"),"WINDOWS_LOCK_SCREEN_REQUIRED");
 assert(!body.includes("Student reference")&&!body.includes("compatibility READY"),"WINDOWS_LOCKED_PRIVATE_CONTENT");
 for(const canary of canaries){assert(canary.length>=8);assert(!body.includes(canary),"WINDOWS_LOCKED_PRIVATE_CONTENT");}
}
export function assertRevokedReadback(actual:NativeIdentity,before:NativeIdentity,denial:string){
 for(const k of ["source","runId","attempt","databaseIdentitySha256","userId","deviceId","publicDeviceId","sessionId"] as const)assert.equal(actual[k],before[k],"WINDOWS_REVOCATION_TARGET");
 assert(actual.sessionRevoked||actual.deviceStatus==="REVOKED","WINDOWS_REVOCATION_MISSING");
 assert(["NATIVE_SESSION_REVOKED","NATIVE_ACCESS_INVALID_OR_EXPIRED","NATIVE_REFRESH_INVALID_OR_EXPIRED"].includes(denial),"WINDOWS_WRONG_REVOCATION_DENIAL");
 assert.equal(actual.activeSessions,0,"WINDOWS_REVOKED_AUTHORITY_RESURRECTED");
}

export type WindowsFixture={username:string;password:string;pin:string;wrongPin:string;canaries:string[];expectedStudents:string[];userId:string;databaseIdentitySha256:string};
/** Concrete Windows process/WebDriver and same-serving-target implementations
 * are required; doubles are permitted ONLY by contract tests. No evidence from
 * this interface qualifies an image or clears the aggregate native gate. */
export interface WindowsLifecycleHost {
 admit():Promise<WindowsTarget>;
 launch():Promise<{app:NativeWebDriver;browser:NativeWebDriver;instance:ProcessIdentity}>;
 bind(instance:ProcessIdentity):Promise<void>;
 observeOriginalAuthorization(browser:NativeWebDriver):Promise<string>;
 totp():Promise<string>;
 read(requestId:string):Promise<NativeIdentity>;
 approvePendingDevice(requestId:string):Promise<void>; // labelled governance/test-preparation evidence
 revokeSession(sessionId:string):Promise<void>;
 observeCallback(instance:ProcessIdentity,requestId:string):Promise<void>;
 restart(instance:ProcessIdentity):Promise<{app:NativeWebDriver;instance:ProcessIdentity}>;
 background(instance:ProcessIdentity):Promise<void>;
 foreground(instance:ProcessIdentity):Promise<void>;
 assertProfilePreserved():Promise<void>;
 cleanup():Promise<void>;
}
const pinField='input[type="password"][autocomplete="off"]';
export async function unlockWindows(app:NativeWebDriver,pin:string){await app.waitText("Welcome back");await app.fill(pinField,pin);await app.clickText("Unlock app");await app.waitText("Workspace");}
export async function lockWindows(app:NativeWebDriver,canaries:string[]){const button=await app.element("css selector",".top-actions button.secondary");await app.command("POST",`/element/${button}/click`,{});await app.waitText("Welcome back");assertLockedView(await app.body(),canaries);}
async function wrongPin(app:NativeWebDriver,f:WindowsFixture){await app.fill(pinField,f.wrongPin);await app.clickText("Unlock app");await app.waitText("App PIN was not accepted.");assertLockedView(await app.body(),f.canaries);}
async function references(app:NativeWebDriver,expected:string[]){
 await app.clickText("Security");await app.waitText("Current server reference data is encrypted on this device and ready for offline drafts.");await app.clickText("Refresh encrypted reference data");await app.waitText("Current server reference data is encrypted on this device and ready for offline drafts.");await app.clickText("Workspace");
 const values=await app.command("POST","/execute/sync",{script:"return Array.from(document.querySelectorAll('label')).find(e => e.textContent.startsWith('Student reference'))?.querySelector('select') ? Array.from(Array.from(document.querySelectorAll('label')).find(e => e.textContent.startsWith('Student reference')).querySelector('select').options).map(o => o.value).filter(Boolean) : null",args:[]});
 assert.deepEqual(values?.sort(),[...expected].sort(),"WINDOWS_RENDERED_REFERENCE_SCOPE");
}
/** Actions are rendered W3C interactions; read/approve/revoke are private,
 * signed serving-target connections. Cancellation navigates away BEFORE confirm. */
export async function runWindowsAuthentication(host:WindowsLifecycleHost,f:WindowsFixture){
 const completed:string[]=[];let failure:unknown;
 try{
  const target=await host.admit();assert(/^\d{8,12}$/.test(f.pin)&&/^\d{8,12}$/.test(f.wrongPin)&&f.pin!==f.wrongPin);assert(f.password.length>=48&&f.expectedStudents.length>0&&sha.test(f.databaseIdentitySha256));
  let {app,browser,instance}=await host.launch();await host.bind(instance);await app.observeLockedPrivacy(f.canaries);completed.push("WD1");
  // First unlock establishes the PIN on a verified empty profile. Wrong-PIN
  // evidence is meaningful only after this first creation, not on an empty vault.
  await unlockWindows(app,f.pin);assert(!(await app.body()).includes("compatibility READY"),"WINDOWS_PIN_IS_NOT_SERVER_AUTH");
  await lockWindows(app,f.canaries);await wrongPin(app,f);await unlockWindows(app,f.pin);
  await app.clickText("Security");await app.clickText("Connect through system browser");
  await host.background(instance);
  const cancelled=await host.observeOriginalAuthorization(browser),cancelId=validateOriginalAuthorization(cancelled,target.origin).requestId;
  await browser.command("POST","/url",{url:target.origin+"/login"});const cancelledState=await host.read(cancelId);assert.equal(cancelledState.requestStatus,"PENDING_BROWSER_AUTH");assert.equal(cancelledState.activeSessions,0,"WINDOWS_CANCELLED_AUTH_CONNECTED");
  await app.waitText("Welcome back");assertLockedView(await app.body(),f.canaries);await unlockWindows(app,f.pin);
  const authorize=async(first:boolean)=>{
   await host.bind(instance);await app.clickText("Security");await app.clickText("Connect through system browser");
   await host.background(instance);
   const original=await host.observeOriginalAuthorization(browser),request=validateOriginalAuthorization(original,target.origin);
   if(first)await authenticateNativeBrowser(browser,{authorizationUrl:original,username:f.username,password:f.password,totp:()=>host.totp()});
   else{await browser.command("POST","/url",{url:original});await browser.waitText("Connect this ERP app?");await browser.clickText("Confirm this device");}
   return request.requestId;
  };
  const pending=await authorize(true);await browser.waitText("Device approval required");const pendingState=await host.read(pending);assert.equal(pendingState.userId,f.userId);assert.equal(pendingState.deviceStatus,"PENDING_APPROVAL");assert.equal(pendingState.activeSessions,0);
  await host.approvePendingDevice(pending);await app.waitText("Welcome back");await unlockWindows(app,f.pin);
  const requestId=await authorize(false);await host.observeCallback(instance,requestId);await app.waitText("Welcome back");assertLockedView(await app.body(),f.canaries);await unlockWindows(app,f.pin);
  await references(app,f.expectedStudents);const initial=await host.read(requestId);
  const expected={...initial,source:target.source,runId:target.runId,attempt:target.attempt,userId:f.userId,databaseIdentitySha256:f.databaseIdentitySha256,requestId,deviceId:pendingState.deviceId,publicDeviceId:pendingState.publicDeviceId,role:"ACCOUNTANT",referenceStudents:f.expectedStudents};assertNativeIdentity(initial,expected);completed.push("WD2","WD3");
  await lockWindows(app,f.canaries);await unlockWindows(app,f.pin);await host.background(instance);await app.waitText("Welcome back");assertLockedView(await app.body(),f.canaries);await host.foreground(instance);assertLockedView(await app.body(),f.canaries);await unlockWindows(app,f.pin);
  await host.assertProfilePreserved();const beforeRestart=await host.read(requestId);await app.closeLockedPrivacy();({app,instance}=await host.restart(instance));await host.bind(instance);await app.observeLockedPrivacy(f.canaries);await app.waitText("Welcome back");assertLockedView(await app.body(),f.canaries);await wrongPin(app,f);await unlockWindows(app,f.pin);await app.clickText("Security");await app.clickText("Refresh encrypted reference data");await app.waitText("Current server reference data is encrypted on this device and ready for offline drafts.");const afterRestart=await host.read(requestId);assertNativeIdentity(afterRestart,expected);assert(afterRestart.tokenVersion>beforeRestart.tokenVersion,"WINDOWS_RESTART_ROTATION_MISSING");await host.assertProfilePreserved();completed.push("WD4");
  await host.revokeSession(initial.sessionId);
  const refused=async()=>{await app.clickText("Security");await app.clickText("Refresh encrypted reference data");await app.waitText("NATIVE_");const body=await app.body(),denial=body.match(/NATIVE_(?:SESSION_REVOKED|ACCESS_INVALID_OR_EXPIRED|REFRESH_INVALID_OR_EXPIRED)/)?.[0];assert(denial,"WINDOWS_REVOCATION_DENIAL_MISSING");assertRevokedReadback(await host.read(requestId),initial,denial);};
  await refused();await lockWindows(app,f.canaries);await app.closeLockedPrivacy();({app,instance}=await host.restart(instance));await host.bind(instance);await app.observeLockedPrivacy(f.canaries);await app.waitText("Welcome back");assertLockedView(await app.body(),f.canaries);await unlockWindows(app,f.pin);await refused();
  const newRequest=await authorize(false);assert.notEqual(newRequest,requestId);await host.observeCallback(instance,newRequest);await app.waitText("Welcome back");await unlockWindows(app,f.pin);await references(app,f.expectedStudents);
  const renewed=await host.read(newRequest);assert.notEqual(renewed.sessionId,initial.sessionId,"WINDOWS_OLD_SESSION_REVIVED");assertNativeIdentity(renewed,{...expected,sessionId:renewed.sessionId,requestId:newRequest});assert.equal((await host.read(requestId)).sessionRevoked,true);await app.closeLockedPrivacy();completed.push("WD5");
 }catch(error){failure=error;}
 finally{try{await host.cleanup();}catch{throw Error("WINDOWS_AUTH_CLEANUP_FAILED_RESIDUE_REQUIRES_RECONCILIATION");}}
 if(failure)throw Error("WINDOWS_AUTH_LIFECYCLE_FAILED_PRIVATE_DETAILS_WITHHELD");
 return {scenarios:completed,evidenceClass:"UNIT_OR_DRIVER_CONTRACT_REQUIRES_ADMITTED_HOST_CLASSIFICATION",nativeAggregate:"PARTIAL",ownerDeviceCertification:false};
}
