import assert from "node:assert/strict";
export type WindowsProbeBinding={source:string;runId:string;attempt:string;iteration:string;phase:"synthetic-ON";databaseIdentitySha256:string;publicDeviceId:string;publicKeyHash:string};
export type WindowsProbeInput=WindowsProbeBinding&({operation:"prepare";password:string;governancePassword:string}|{operation:"totp"}|{operation:"read";original:string}|{operation:"approve";original:string;governancePassword:string}|{operation:"revoke-session";original:string;sessionId:string});
export type WindowsReadback={source:string;runId:string;attempt:string;databaseIdentitySha256:string;userId:string|null;deviceId:string|null;publicDeviceId:string;requestId:string;requestStatus:string;deviceStatus:string|null;sessionId:string|null;sessionRevoked:boolean|null;activeSessions:number;role:string|null;authorityActive:boolean;mfaUsed:null;mfaObservation:"NO_SESSION_CHALLENGE_LINK_RECORDED";referenceStudents:string[];referenceVersion:string;referenceObservation:"AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF";tokenVersion:number|null;rotatedTokenVersions:number[]};
type Fixture={userId:string;username:string;governanceUserId:string;expectedStudents:string[];databaseIdentitySha256:string};
const sha=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ok=(value:unknown)=>assert(value,"WINDOWS_PROBE_CONTRACT_REFUSED");
function object(value:unknown,keys:string[]):Record<string,any>{ok(value&&typeof value==="object"&&!Array.isArray(value));const row=value as Record<string,any>;ok(JSON.stringify(Object.keys(row).sort())===JSON.stringify(keys.sort()));return row;}
const text=(v:unknown,max=128)=>typeof v==="string"&&v.length>0&&v.length<=max;
const matches=(pattern:RegExp,v:unknown)=>typeof v==="string"&&pattern.test(v);
const bindingKeys=["source","runId","attempt","iteration","phase","databaseIdentitySha256","publicDeviceId","publicKeyHash"];
function binding(value:unknown){const v=object(value,[...bindingKeys]);ok(matches(/^[a-f0-9]{40}$/,v.source)&&matches(/^\d{1,20}$/,v.runId)&&matches(/^\d{1,6}$/,v.attempt)&&matches(uuid,v.iteration)&&v.phase==="synthetic-ON"&&matches(sha,v.databaseIdentitySha256)&&matches(uuid,v.publicDeviceId)&&matches(sha,v.publicKeyHash));return v as WindowsProbeBinding;}
export const windowsProbeBinding={parse:binding};
function input(value:unknown):WindowsProbeInput {
 ok(value&&typeof value==="object");const v=value as Record<string,any>;
 const extras:Record<string,string[]>={prepare:["password","governancePassword"],totp:[],read:["original"],approve:["original","governancePassword"],"revoke-session":["original","sessionId"]};ok(typeof v.operation==="string"&&Object.hasOwn(extras,v.operation));object(v,[...bindingKeys,"operation",...extras[v.operation]]);binding(Object.fromEntries(bindingKeys.map(k=>[k,v[k]])));
 for(const key of ["password","governancePassword"])if(key in v)ok(text(v[key])&&v[key].length>=48);
 if("original" in v)ok(text(v.original,2048));if("sessionId" in v)ok(matches(uuid,v.sessionId));return v as WindowsProbeInput;
}
export const windowsProbeInput={parse:input,safeParse(value:unknown){try{return {success:true as const,data:input(value)};}catch{return {success:false as const,data:undefined};}}};
export const windowsFixtureResult={parse(value:unknown):Fixture{const v=object(value,["userId","username","governanceUserId","expectedStudents","databaseIdentitySha256"]);ok(text(v.userId)&&text(v.username)&&text(v.governanceUserId)&&matches(sha,v.databaseIdentitySha256)&&Array.isArray(v.expectedStudents)&&v.expectedStudents.length===2&&v.expectedStudents.every((s:unknown)=>text(s)));return v as Fixture;}};
export const windowsReadback={parse(value:unknown):WindowsReadback{
 const v=object(value,["source","runId","attempt","databaseIdentitySha256","userId","deviceId","publicDeviceId","requestId","requestStatus","deviceStatus","sessionId","sessionRevoked","activeSessions","role","authorityActive","mfaUsed","mfaObservation","referenceStudents","referenceVersion","referenceObservation","tokenVersion","rotatedTokenVersions"]);
 ok(matches(/^[a-f0-9]{40}$/,v.source)&&matches(/^\d{1,20}$/,v.runId)&&matches(/^\d{1,6}$/,v.attempt)&&matches(sha,v.databaseIdentitySha256)&&matches(uuid,v.publicDeviceId)&&matches(uuid,v.requestId)&&text(v.requestStatus,40));
 for(const key of ["userId","deviceId","deviceStatus","role"])ok(v[key]===null||text(v[key]));ok(v.sessionId===null||matches(uuid,v.sessionId));ok(v.sessionRevoked===null||typeof v.sessionRevoked==="boolean");ok([0,1].includes(v.activeSessions)&&typeof v.authorityActive==="boolean");
 ok(v.mfaUsed===null&&v.mfaObservation==="NO_SESSION_CHALLENGE_LINK_RECORDED"&&v.referenceObservation==="AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF"&&matches(sha,v.referenceVersion));
 ok(Array.isArray(v.referenceStudents)&&v.referenceStudents.length<=800&&v.referenceStudents.every((s:unknown)=>text(s)));ok(v.tokenVersion===null||(Number.isSafeInteger(v.tokenVersion)&&v.tokenVersion>0));ok(Array.isArray(v.rotatedTokenVersions)&&v.rotatedTokenVersions.length<=100&&v.rotatedTokenVersions.every((n:unknown)=>Number.isSafeInteger(n)&&Number(n)>0));return v as WindowsReadback;
}};
export function parseWindowsProbe(raw:string){if(Buffer.byteLength(raw)>4096)throw Error("WINDOWS_PROBE_INPUT_BOUND");try{return input(JSON.parse(raw));}catch{throw Error("WINDOWS_PROBE_INPUT_REFUSED");}}
export function validateWindowsProbeResult(operation:WindowsProbeInput["operation"],value:unknown):unknown{
 try{if(operation==="read")return windowsReadback.parse(value);if(operation==="prepare")return windowsFixtureResult.parse(value);if(operation==="totp"){const v=object(value,["token"]);ok(typeof v.token==="string"&&/^\d{6}$/.test(v.token));return v;}
  ok(operation==="approve");const v=object(value,["evidenceClass","deviceId","eventCount"]);ok(v.evidenceClass==="SERVICE_GOVERNANCE"&&text(v.deviceId)&&v.eventCount===1);return v;
 }catch{throw Error("WINDOWS_PROBE_OUTPUT_REFUSED");}
}
