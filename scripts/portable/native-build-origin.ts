import assert from "node:assert/strict";
import {createPublicKey,verify,type JsonWebKey} from "node:crypto";
import {hashBytes} from "./artifact-handoff";
import type {NativeInventory} from "./native-artifact";

const issuer="https://token.actions.githubusercontent.com";
const repository="vsairohith67/nalanda-school-erp";
const workflow=`${repository}/.github/workflows/cross-platform-apps.yml@refs/heads/release/recovery-integration-1a`;
export const nativeAudience=(v:NativeInventory)=>`urn:nalanda:native-build:${hashBytes(JSON.stringify(v))}`;
async function boundedJson(url:string,headers:Record<string,string>={}){
 const r=await fetch(url,{headers,redirect:"error",signal:AbortSignal.timeout(15000)});assert(r.ok&&r.body,"NATIVE_BUILD_ORIGIN_UNAVAILABLE");
 const reader=r.body.getReader();let size=0;const parts:Buffer[]=[];
 try{while(true){const n=await reader.read();if(n.done)break;size+=n.value.length;assert(size<=65536,"NATIVE_BUILD_ORIGIN_BOUND");parts.push(Buffer.from(n.value));}}finally{await reader.cancel();reader.releaseLock();}
 return JSON.parse(Buffer.concat(parts).toString());
}
/** Cryptographic contract seam; a supplied key set is NOT admission. Only the
 * live fixed-issuer function below is called by the real controller. */
export function verifyNativeBuildToken(token:string,jwks:unknown,v:NativeInventory,now=Date.now()){
 assert(typeof token==="string"&&token.length<16384&&/^[\w-]+\.[\w-]+\.[\w-]+$/.test(token),"NATIVE_BUILD_TOKEN_INVALID");
 const [h,p,s]=token.split("."),header=JSON.parse(Buffer.from(h,"base64url").toString()),claims=JSON.parse(Buffer.from(p,"base64url").toString());
 assert.deepEqual(Object.keys(header).sort(),["alg","kid","typ",...(header.x5t===undefined?[]:["x5t"])].sort());assert(header.alg==="RS256"&&header.typ==="JWT"&&typeof header.kid==="string"&&header.kid.length<=200);
 if(header.x5t!==undefined)assert(typeof header.x5t==="string"&&/^[\w-]{27}$/.test(header.x5t));
 const keys=(jwks as {keys:JsonWebKey[]})?.keys;assert(Array.isArray(keys)&&keys.length>0&&keys.length<=20);
 const matches=keys.filter(k=>k.kid===header.kid);assert.equal(matches.length,1,"NATIVE_BUILD_SIGNER_UNTRUSTED");const jwk=matches[0];
 assert(jwk.kty==="RSA"&&jwk.alg==="RS256"&&jwk.use==="sig"&&!jwk.d);const key=createPublicKey({key:jwk,format:"jwk"});assert((key.asymmetricKeyDetails?.modulusLength??0)>=2048);
 assert(verify("RSA-SHA256",Buffer.from(`${h}.${p}`),key,Buffer.from(s,"base64url")),"NATIVE_BUILD_SIGNATURE_REJECTED");
 const expected={iss:issuer,aud:nativeAudience(v),repository,repository_id:"1308508401",repository_owner:"vsairohith67",repository_owner_id:"290251166",event_name:"workflow_dispatch",ref:"refs/heads/release/recovery-integration-1a",workflow_ref:workflow,workflow_sha:v.source,sha:v.source,run_id:v.runId,run_attempt:v.attempt,runner_environment:"github-hosted"};
 for(const [k,value] of Object.entries(expected))assert.equal(claims[k],value,"NATIVE_BUILD_ORIGIN_MISMATCH");
 assert(!claims.job_workflow_ref&&!claims.job_workflow_sha,"NATIVE_REUSABLE_WORKFLOW_UNSUPPORTED");
 const seconds=Math.floor(now/1000);for(const k of ["iat","nbf","exp"])assert(Number.isSafeInteger(claims[k]));
 assert(claims.iat<=seconds&&claims.iat>=seconds-300&&claims.nbf<=seconds&&claims.exp>seconds&&claims.exp>claims.iat&&claims.exp-claims.iat<=600&&claims.iat>=Math.floor(v.createdAt/1000),"NATIVE_BUILD_TOKEN_STALE");
 return {inventorySha256:hashBytes(JSON.stringify(v)),source:v.source,runId:v.runId,attempt:v.attempt};
}
export async function authenticateNativeBuild(token:string,v:NativeInventory){
 // Trust keys come ONLY from GitHub over verified TLS, not the request/receipt.
 return verifyNativeBuildToken(token,await boundedJson(`${issuer}/.well-known/jwks`),v);
}
export async function requestNativeBuildToken(v:NativeInventory){
 const endpoint=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL??"missing:");
 assert(endpoint.protocol==="https:"&&/^[a-z0-9-]+\.actions\.githubusercontent\.com$/.test(endpoint.hostname)&&!endpoint.port&&!endpoint.username&&!endpoint.password&&!endpoint.hash,"NATIVE_BUILD_TOKEN_ENDPOINT");
 const credential=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;assert(credential&&credential.length<16384,"NATIVE_BUILD_TOKEN_CREDENTIAL_MISSING");
 endpoint.searchParams.set("audience",nativeAudience(v));const r=await boundedJson(endpoint.href,{Authorization:`Bearer ${credential}`});
 assert(typeof r.value==="string"&&r.value.length<16384);return r.value as string;
}
