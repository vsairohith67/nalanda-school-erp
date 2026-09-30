import {parseReferenceObservation,type ReferenceObservation} from "../../lib/native-app/reference-observation";
import type {NativeMfaEvidence} from "../../lib/real-user-access/native-mfa-evidence";
import assert from "node:assert/strict";
export type WindowsProbeBinding={source:string;runId:string;attempt:string;iteration:string;phase:"synthetic-ON";databaseIdentitySha256:string;publicDeviceId:string;publicKeyHash:string};
export type WindowsProbeInput=WindowsProbeBinding&({operation:"prepare";password:string;governancePassword:string;original?:string}|{operation:"prepare-control";password:string;governancePassword:string}|{operation:"close-control";control:import("./windows-control-session").WindowsControl;governancePassword:string}|{operation:"read-control";control:import("./windows-control-session").WindowsControl}|{operation:"totp"}|{operation:"read";original:string;responseId?:string}|{operation:"approve";original:string;governancePassword:string}|{operation:"revoke-session";original:string;sessionId:string;governancePassword:string});
export type WindowsReadback={source:string;runId:string;attempt:string;databaseIdentitySha256:string;userId:string|null;deviceId:string|null;publicDeviceId:string;requestId:string;requestStatus:string;deviceStatus:string|null;sessionId:string|null;sessionRevoked:boolean|null;activeSessions:number;role:string|null;authorityActive:boolean;mfaUsed:true|null;mfaObservation:"NO_SESSION_CHALLENGE_LINK_RECORDED"|"EXPLICIT_SESSION_CHALLENGE_LINK"|"SESSION_CHALLENGE_LINK_CONFLICT";mfaEvidence:NativeMfaEvidence;referenceStudents:string[];referenceVersion:string;referenceObservation:"AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF"|"RESPONSE_PREPARED_NOT_CLIENT_PROOF";referenceResponse?:ReferenceObservation|null;tokenVersion:number|null;rotatedTokenVersions:number[]};
type Fixture={userId:string;username:string;governanceUserId:string;expectedStudents:string[];databaseIdentitySha256:string};
const sha=/^[a-f0-9]{64}$/,uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const ok=(value:unknown)=>assert(value,"WINDOWS_PROBE_CONTRACT_REFUSED");
function object(value:unknown,keys:string[]):Record<string,any>{ok(value&&typeof value==="object"&&!Array.isArray(value));const row=value as Record<string,any>;ok(JSON.stringify(Object.keys(row).sort())===JSON.stringify(keys.sort()));return row;}
const text=(v:unknown,max=128)=>typeof v==="string"&&v.length>0&&v.length<=max;
const matches=(pattern:RegExp,v:unknown)=>typeof v==="string"&&pattern.test(v);
export function parseWindowsControl(value:unknown){const v=object(value,["userId","deviceId","publicDeviceId","requestId","sessionId","webSessionId"]);for(const k of ["userId","deviceId","webSessionId"])ok(text(v[k]));for(const k of ["publicDeviceId","requestId","sessionId"])ok(matches(uuid,v[k]));return v as import("./windows-control-session").WindowsControl;}
const bindingKeys=["source","runId","attempt","iteration","phase","databaseIdentitySha256","publicDeviceId","publicKeyHash"];
function binding(value:unknown){const v=object(value,[...bindingKeys]);ok(matches(/^[a-f0-9]{40}$/,v.source)&&matches(/^\d{1,20}$/,v.runId)&&matches(/^\d{1,6}$/,v.attempt)&&matches(uuid,v.iteration)&&v.phase==="synthetic-ON"&&matches(sha,v.databaseIdentitySha256)&&matches(uuid,v.publicDeviceId)&&matches(sha,v.publicKeyHash));return v as WindowsProbeBinding;}
export const windowsProbeBinding={parse:binding};
function input(value:unknown):WindowsProbeInput {
 ok(value&&typeof value==="object");const v=value as Record<string,any>;
 const extras:Record<string,string[]>={prepare:["password","governancePassword"],"prepare-control":["password","governancePassword"],"read-control":["control"],"close-control":["control","governancePassword"],totp:[],read:["original"],approve:["original","governancePassword"],"revoke-session":["original","sessionId","governancePassword"]};ok(typeof v.operation==="string"&&Object.hasOwn(extras,v.operation));object(v,[...bindingKeys,"operation",...extras[v.operation],...(v.operation==="read"&&"responseId" in v?["responseId"]:[]),...(v.operation==="prepare"&&"original" in v?["original"]:[])]);binding(Object.fromEntries(bindingKeys.map(k=>[k,v[k]])));
 if("control" in v)parseWindowsControl(v.control);
 for(const key of ["password","governancePassword"])if(key in v)ok(text(v[key])&&v[key].length>=48);
 if("responseId" in v)ok(matches(uuid,v.responseId));
 if("original" in v)ok(text(v.original,2048));if("sessionId" in v)ok(matches(uuid,v.sessionId));return v as WindowsProbeInput;
}
export const windowsProbeInput={parse:input,safeParse(value:unknown){try{return {success:true as const,data:input(value)};}catch{return {success:false as const,data:undefined};}}};
export const windowsFixtureResult={parse(value:unknown):Fixture{const v=object(value,["userId","username","governanceUserId","expectedStudents","databaseIdentitySha256"]);ok(text(v.userId)&&text(v.username)&&text(v.governanceUserId)&&matches(sha,v.databaseIdentitySha256)&&Array.isArray(v.expectedStudents)&&v.expectedStudents.length===2&&v.expectedStudents.every((s:unknown)=>text(s)));return v as Fixture;}};
export const windowsReadback={parse(value:unknown):WindowsReadback{
 const v=object(value,["source","runId","attempt","databaseIdentitySha256","userId","deviceId","publicDeviceId","requestId","requestStatus","deviceStatus","sessionId","sessionRevoked","activeSessions","role","authorityActive","mfaUsed","mfaObservation","mfaEvidence","referenceStudents","referenceVersion","referenceObservation","tokenVersion","rotatedTokenVersions",...(value&&typeof value==="object"&&"referenceResponse" in value?["referenceResponse"]:[])]);
 ok(matches(/^[a-f0-9]{40}$/,v.source)&&matches(/^\d{1,20}$/,v.runId)&&matches(/^\d{1,6}$/,v.attempt)&&matches(sha,v.databaseIdentitySha256)&&matches(uuid,v.publicDeviceId)&&matches(uuid,v.requestId)&&text(v.requestStatus,40));
 for(const key of ["userId","deviceId","deviceStatus","role"])ok(v[key]===null||text(v[key]));ok(v.sessionId===null||matches(uuid,v.sessionId));ok(v.sessionRevoked===null||typeof v.sessionRevoked==="boolean");ok([0,1].includes(v.activeSessions)&&typeof v.authorityActive==="boolean");
 const e=v.mfaEvidence;ok(e&&typeof e==="object");
 if(e.status==="VERIFIED"){
  object(e,["status","factor","challengeId","verifiedAt","webSessionId","userId","requestId","nativeSessionId"]);
  ok(["TOTP","RECOVERY_CODE","WEBAUTHN"].includes(e.factor)&&matches(uuid,e.challengeId)&&text(e.webSessionId)&&typeof e.verifiedAt==="string"&&Number.isFinite(Date.parse(e.verifiedAt))&&new Date(e.verifiedAt).toISOString()===e.verifiedAt);
  ok(v.mfaUsed===true&&v.mfaObservation==="EXPLICIT_SESSION_CHALLENGE_LINK"&&v.sessionId!==null&&v.requestStatus==="CONSUMED"&&e.userId===v.userId&&e.requestId===v.requestId&&e.nativeSessionId===v.sessionId);
 }else{object(e,["status"]);ok(["NOT_RECORDED","NOT_YET_ISSUED","CONFLICT"].includes(e.status)&&v.mfaUsed===null&&v.mfaObservation===(e.status==="CONFLICT"?"SESSION_CHALLENGE_LINK_CONFLICT":"NO_SESSION_CHALLENGE_LINK_RECORDED"));}
 if(e.status==="NOT_YET_ISSUED")ok(v.sessionId===null&&v.requestStatus!=="CONSUMED");
 ok(matches(sha,v.referenceVersion));
 ok(v.referenceResponse===undefined||v.referenceResponse===null||typeof v.referenceResponse==="object");
 if(v.referenceResponse){const r=parseReferenceObservation(v.referenceResponse);ok(v.referenceObservation==="RESPONSE_PREPARED_NOT_CLIENT_PROOF"&&r.userId===v.userId&&r.sessionId===v.sessionId&&r.deviceId===v.deviceId&&r.publicDeviceId===v.publicDeviceId);}
 else ok(v.referenceObservation==="AVAILABLE_POPULATION_ONLY_NOT_REFRESH_PROOF");
 ok(Array.isArray(v.referenceStudents)&&v.referenceStudents.length<=800&&v.referenceStudents.every((s:unknown)=>text(s)));ok(v.tokenVersion===null||(Number.isSafeInteger(v.tokenVersion)&&v.tokenVersion>0));ok(Array.isArray(v.rotatedTokenVersions)&&v.rotatedTokenVersions.length<=100&&v.rotatedTokenVersions.every((n:unknown)=>Number.isSafeInteger(n)&&Number(n)>0));return v as WindowsReadback;
}};
export function parseWindowsProbe(raw:string){if(Buffer.byteLength(raw)>4096)throw Error("WINDOWS_PROBE_INPUT_BOUND");try{return input(JSON.parse(raw));}catch{throw Error("WINDOWS_PROBE_INPUT_REFUSED");}}
export function validateWindowsProbeResult(operation:WindowsProbeInput["operation"],value:unknown):unknown{
 if(operation==="prepare-control"||operation==="read-control")return parseWindowsControl(value);
 if(operation==="close-control"){const v=object(value,["state"]);ok(v.state==="CONTROL_SESSION_REVOKED");return v;}
 try{if(operation==="read")return windowsReadback.parse(value);if(operation==="prepare")return windowsFixtureResult.parse(value);if(operation==="totp"){const v=object(value,["token"]);ok(typeof v.token==="string"&&/^\d{6}$/.test(v.token));return v;}
  if(operation==="revoke-session"){const v=object(value,["evidenceClass","sessionId","eventCount","status"]);ok(v.evidenceClass==="SERVICE_GOVERNANCE"&&matches(uuid,v.sessionId)&&v.eventCount===1&&["REVOKED","ALREADY_REVOKED"].includes(v.status));return v;}
  ok(operation==="approve");const v=object(value,["evidenceClass","deviceId","eventCount"]);ok(v.evidenceClass==="SERVICE_GOVERNANCE"&&text(v.deviceId)&&v.eventCount===1);return v;
 }catch{throw Error("WINDOWS_PROBE_OUTPUT_REFUSED");}
}
