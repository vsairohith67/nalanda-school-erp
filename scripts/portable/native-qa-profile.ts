import {createHash,createPublicKey,sign,verify,X509Certificate,type KeyObject} from "node:crypto";
import {lstatSync,readFileSync,realpathSync,writeFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import type {SyntheticBuildTrust} from "../../lib/portable-runtime/synthetic-capability";
import {readSigningRoot,validateProducerRoot,type ProducerIdentity} from "./synthetic-build-lifecycle";

export const NATIVE_QA_ORIGIN="https://portable-staging.localhost:8443";
export const NATIVE_QA_PATHS=["/api/native-auth/request","/api/native-auth/exchange","/api/native-auth/refresh","/api/native/v1/context","/api/native/v1/reference-pack","/api/native-auth/logout"] as const;
export type NativeQaProfile={contract:"NALANDA_NATIVE_QA_PROFILE_V1";source:string;runId:string;attempt:string;buildId:string;nativeBuildId:string;databaseSha256:string;origin:string;environment:"synthetic-staging";phase:"windows-auth";appId:"com.nalandaps.erp";architecture:"x64";issuedAt:number;expiresAt:number;caPem:string;caSha256:string;paths:string[]};
export type NativeQaEnvelope={payload:string;signature:string};
const fields="appId,architecture,attempt,buildId,caPem,caSha256,contract,databaseSha256,environment,expiresAt,issuedAt,nativeBuildId,origin,paths,phase,runId,source";
const hash=(b:string|Buffer)=>createHash("sha256").update(b).digest("hex");
export function validateNativeQaProfile(trust:SyntheticBuildTrust|null,envelope:unknown,now=Date.now()):NativeQaProfile {
 try {
  if(!trust||trust.contract!=="NALANDA_SYNTHETIC_BUILD_V1")throw Error();
  const e=envelope as NativeQaEnvelope;
  if(!e||Object.keys(e).sort().join()!=="payload,signature"||typeof e.payload!=="string"||e.payload.length>24576||!/^[-\w]+$/.test(e.payload)||!/^[-\w]{86}$/.test(e.signature))throw Error();
  const key=createPublicKey(trust.publicKey),bytes=Buffer.from(e.payload,"base64url");
  if(key.asymmetricKeyType!=="ed25519"||!verify(null,bytes,key,Buffer.from(e.signature,"base64url")))throw Error();
  const p=JSON.parse(bytes.toString()) as NativeQaProfile;
  if(Object.keys(p).sort().join()!==fields||p.contract!=="NALANDA_NATIVE_QA_PROFILE_V1"||p.origin!==NATIVE_QA_ORIGIN||p.environment!=="synthetic-staging"||p.phase!=="windows-auth"||p.appId!=="com.nalandaps.erp"||p.architecture!=="x64")throw Error();
  if(!/^[a-f0-9]{40}$/.test(p.source)||!/^\d{1,20}$/.test(p.runId)||!/^\d{1,6}$/.test(p.attempt)||![p.buildId,p.nativeBuildId,p.databaseSha256,p.caSha256].every(v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v)))throw Error();
  for(const k of ["source","runId","attempt","buildId"] as const)if(p[k]!==trust[k])throw Error();
  if(!Number.isSafeInteger(p.issuedAt)||!Number.isSafeInteger(p.expiresAt)||p.issuedAt>now||p.expiresAt<=now||p.expiresAt<=p.issuedAt||p.expiresAt-p.issuedAt>3600000||JSON.stringify(p.paths)!==JSON.stringify(NATIVE_QA_PATHS))throw Error();
  if(typeof p.caPem!=="string"||p.caPem.length>8192||!/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\s*$/.test(p.caPem))throw Error();
  const ca=new X509Certificate(p.caPem);
  if(!ca.ca||hash(ca.raw)!==p.caSha256||Date.parse(ca.validFrom)>now||Date.parse(ca.validTo)<=p.expiresAt||!ca.verify(ca.publicKey))throw Error();
  return p;
 }catch{throw Error("NATIVE_QA_PROFILE_REJECTED");}
}
export function signNativeQaProfile(profile:NativeQaProfile,trust:SyntheticBuildTrust,key:KeyObject,now=Date.now()) {
 const bytes=Buffer.from(JSON.stringify(profile)),e={payload:bytes.toString("base64url"),signature:sign(null,bytes,key).toString("base64url")};
 validateNativeQaProfile(trust,e,now);return e;
}
/** Called only after exact backend artifact/replica admission by issue-native.
 * Inputs contain public trust only; private signer remains in its existing root. */
export function prepareNativeQaInputs(workspace:string,id:ProducerIdentity,caPem:string,databaseSha256:string,key:KeyObject,now=Date.now()) {
 if(id.architecture!=="amd64")throw Error("NATIVE_QA_WINDOWS_X64_REQUIRED");
 const work=validateProducerRoot(workspace,id,"work"),{trust}=readSigningRoot(workspace,id);
 const nativeBuildId=hash(JSON.stringify({source:id.source,runId:id.runId,attempt:id.attempt,backendBuildId:trust.buildId,profile:"synthetic-qa",architecture:"x64"}));
 const p:NativeQaProfile={contract:"NALANDA_NATIVE_QA_PROFILE_V1",source:id.source,runId:id.runId,attempt:id.attempt,buildId:trust.buildId,nativeBuildId,databaseSha256,origin:NATIVE_QA_ORIGIN,environment:"synthetic-staging",phase:"windows-auth",appId:"com.nalandaps.erp",architecture:"x64",issuedAt:now,expiresAt:now+3600000,caPem,caSha256:hash(new X509Certificate(caPem).raw),paths:[...NATIVE_QA_PATHS]};
 const envelope=signNativeQaProfile(p,trust,key,now),dir=path.join(work,"native-qa");mkdirSync(dir,{mode:0o700});
 writeFileSync(path.join(dir,"profile.json"),JSON.stringify(envelope),{flag:"wx",mode:0o400});
 writeFileSync(path.join(dir,"trust.json"),JSON.stringify(trust),{flag:"wx",mode:0o400});
 return {profile:p,envelope,profileSha256:hash(JSON.stringify(envelope)),directory:dir};
}
export function readNativeQaInput(file:string) {
 const stat=lstatSync(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>32768||realpathSync(file)!==path.resolve(file))throw Error("NATIVE_QA_INPUT_UNSAFE");
 return JSON.parse(readFileSync(file,"utf8"));
}
