import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {lstatSync,readFileSync} from "node:fs";
import path from "node:path";
import type {ProcessIdentity,WindowsTarget} from "./windows-auth-lifecycle";
import {validateOriginalAuthorization} from "./windows-auth-lifecycle";
import {assertWindowsFile,privateWindowsOs} from "./windows-webdriver-host";
import type {NativeWebDriver} from "./native-webdriver";

const sha=(v:string)=>createHash("sha256").update(v).digest("hex"),hex=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
function fields(v:any,names:string[]){assert(v&&typeof v==="object"&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),names.sort());}
export type NativeObservation={contract:string;source:string;runId:string;attempt:string;pid:number;executableSha256:string;instance:string;sequence:number;device:null|{publicDeviceId:string;publicKeyHash:string;requestId:string};original:null|{requestId:string;stateHash:string;urlHash:string};callbacks:Array<{requestId:string;stateHash:string;callbackHash:string;delivery:string}>;exchanges:Array<{requestId:string;sessionId:string;stage:string}>};
export function parseNativeObservation(raw:string,t:WindowsTarget,p:ProcessIdentity):NativeObservation{
 assert(Buffer.byteLength(raw)<=16384,"WINDOWS_OBSERVATION_BOUND");const v=JSON.parse(raw);
 fields(v,["contract","source","runId","attempt","pid","executableSha256","instance","sequence","device","original","callbacks","exchanges"]);
 assert.equal(v.contract,"NALANDA_NATIVE_OBSERVATION_V1");
 for(const k of ["source","runId","attempt"] as const)assert.equal(v[k],t[k],"WINDOWS_OBSERVATION_RUN_CHANGED");
 assert.equal(v.pid,p.pid,"WINDOWS_OBSERVATION_INSTANCE_CHANGED");assert(/^[a-f0-9]{32}$/.test(v.instance));assert(Number.isSafeInteger(v.sequence)&&v.sequence>0&&v.sequence<=128);
 assert.equal(v.executableSha256,t.artifactSha256,"WINDOWS_OBSERVATION_FOREIGN_EXECUTABLE");
 if(v.device){fields(v.device,["publicDeviceId","publicKeyHash","requestId"]);assert(uuid.test(v.device.publicDeviceId)&&hex.test(v.device.publicKeyHash)&&uuid.test(v.device.requestId));}
 if(v.original){fields(v.original,["requestId","stateHash","urlHash"]);assert(uuid.test(v.original.requestId)&&hex.test(v.original.stateHash)&&hex.test(v.original.urlHash));}
 for(const key of ["callbacks","exchanges"]){assert(Array.isArray(v[key])&&v[key].length<=16);}
 for(const c of v.callbacks){fields(c,["requestId","stateHash","callbackHash","delivery"]);assert(uuid.test(c.requestId)&&hex.test(c.stateHash)&&hex.test(c.callbackHash)&&["COLD_ARGUMENT","SINGLE_INSTANCE_ARGUMENT"].includes(c.delivery));}
 assert(new Set(v.callbacks.map((c:{callbackHash:string})=>c.callbackHash)).size===v.callbacks.length,"WINDOWS_CALLBACK_REPLAY");
 for(const e of v.exchanges){fields(e,["requestId","sessionId","stage"]);assert(uuid.test(e.requestId)&&uuid.test(e.sessionId)&&e.stage==="SERVER_EXCHANGE_RETURNED_NOT_STORAGE_PROOF");}
 return v;
}
/** Local private metadata only. No vault read or IPC. The journal cannot itself
 * certify OS origin; the host must also establish owned process/protocol delivery. */
export function readNativeObservation(t:WindowsTarget,p:ProcessIdentity){
 const file=path.join(t.appData,`qa-observation-${p.pid}.json`);assertWindowsFile(file,t.root);
 const stat=lstatSync(file);assert(stat.isFile()&&stat.nlink===1&&stat.size>0&&stat.size<=16384,"WINDOWS_OBSERVATION_FILE");
 assert(stat.birthtimeMs>=Date.parse(p.created)-1000,"WINDOWS_OBSERVATION_STALE_FILE");
 const acl=privateWindowsOs({operation:"file-security",file});
 assert(acl.owner===t.userSid&&acl.userSid===t.userSid&&acl.rules.length>0&&acl.rules.every((r:{sid:string;type:string})=>r.type==="Allow"&&[t.userSid,"S-1-5-18","S-1-5-32-544"].includes(r.sid)),"WINDOWS_OBSERVATION_OWNER");
 return parseNativeObservation(readFileSync(file,"utf8"),t,p);
}
/** OS start precedes Rust setup. Only an absent/empty initial owned file is
 * pending; a malformed, stale, linked or foreign file is never retried away. */
export function pendingNativeObservation(t:WindowsTarget,p:ProcessIdentity){
 const file=path.join(t.appData,`qa-observation-${p.pid}.json`);assertWindowsFile(file,t.root);
 let stat;try{stat=lstatSync(file);}catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw e;}
 assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.birthtimeMs>=Date.parse(p.created)-1000,"WINDOWS_OBSERVATION_STALE_FILE");
 if(stat.size===0)return null;
 return readNativeObservation(t,p);
}
export function assertOriginalObservation(o:NativeObservation,original:string,origin:string){
 const r=validateOriginalAuthorization(original,origin);assert(o.original&&o.device,"WINDOWS_APP_REQUEST_NOT_RECORDED");
 assert.equal(o.original.requestId,r.requestId);assert.equal(o.original.stateHash,sha(r.state));assert.equal(o.original.urlHash,sha(original),"WINDOWS_AUTHORIZATION_SUBSTITUTED");assert.equal(o.device.requestId,r.requestId);
 return o.device;
}
export function assertCallbackObservation(o:NativeObservation,original:string,origin:string,expectedInstance:string){
 const r=validateOriginalAuthorization(original,origin);assert.equal(o.instance,expectedInstance,"WINDOWS_CALLBACK_WRONG_INSTANCE");
 const callbacks=o.callbacks.filter(c=>c.requestId===r.requestId);assert.equal(callbacks.length,1,"WINDOWS_CALLBACK_MISSING_OR_DUPLICATED");assert.equal(callbacks[0].stateHash,sha(r.state),"WINDOWS_CALLBACK_WRONG_STATE");
 return callbacks[0]; // delivery only; exchange/storage must be independently checked
}
export function assertEarlyPrivacy(value:any){
 fields(value,["contract","early","failed","samples","transitions","armed","boundary"]);
 assert(value.contract==="NALANDA_EARLY_DOM_OBSERVATION_V1"&&value.early===true&&value.failed===false&&Number.isSafeInteger(value.samples)&&value.samples>0&&Number.isSafeInteger(value.transitions)&&value.transitions>=0&&typeof value.armed==="boolean","WINDOWS_EARLY_PRIVACY_FAILED");
 assert.equal(value.boundary,"DOCUMENT_CREATION_DOM_AND_RAF_NOT_COMPOSITOR_FRAMES");
}
export async function checkEarlyWindowsPrivacy(app:NativeWebDriver){
 const result=await app.command("POST","/execute/sync",{script:"return window.__nalandaEarlyPrivacy?.read() ?? null",args:[]});assertEarlyPrivacy(result);return result;
}
