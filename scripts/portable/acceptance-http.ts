import assert from "node:assert/strict";
import {request} from "node:https";
import {readFileSync,lstatSync} from "node:fs";
import type {PrismaClient} from "@prisma/client";
import {syntheticFeatureCapability} from "../../lib/portable-runtime/synthetic-capability";
import {servedSyntheticDatabase} from "./acceptance-target-database";
import {assertNoDefaultRoute} from "./private-fixtures";
import {generateTotpForSyntheticQa} from "../../lib/real-user-access/totp";
import {beginTotpEnrollment,confirmTotpEnrollment} from "../../lib/real-user-access/mfa-service";
import {boundAuthEnvironment} from "../../lib/real-user-access/login-mfa";

export const syntheticOrigin="https://portable-staging.localhost:8443";
export function assertSyntheticServingTarget(){
 assert.equal(process.env.PORTABLE_ACCEPTANCE_FIXTURE,"synthetic-ON");
 servedSyntheticDatabase();assert(syntheticFeatureCapability(),"SIGNED_SYNTHETIC_CAPABILITY_REQUIRED");
 assertNoDefaultRoute(readFileSync("/proc/net/route","utf8"),readFileSync("/proc/net/ipv6_route","utf8"));
 for(const key of ["LIVE_PROVIDERS_ENABLED","WHATSAPP_LIVE_SENDING_ENABLED","SMS_EMAIL_SMS_LIVE_ENABLED","SMS_EMAIL_EMAIL_LIVE_ENABLED"])assert.equal(process.env[key],"false");
}
/** Uses the real reviewed proxy inside the private network, with hostname and
 * CA verification. No localhost bypass, extra host, request mock or TLS waiver. */
export async function privateHttp(input:string|URL,init:RequestInit={}):Promise<Response>{
 assertSyntheticServingTarget();
 const url=new URL(input);assert.equal(url.origin,syntheticOrigin);assert(!url.username&&!url.password);
 const caFile="/run/qa-ca/root.crt",stat=lstatSync(caFile);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size<16384&&!(stat.mode&0o022));
 const req=new Request(url,init),body=Buffer.from(await req.arrayBuffer());assert(body.length<=4*1024*1024);
 const headers=Object.fromEntries(req.headers);headers.host=url.host;headers.origin=syntheticOrigin;
 return new Promise((resolve,reject)=>{
  const outgoing=request({hostname:"reverse-proxy",servername:url.hostname,port:8443,path:url.pathname+url.search,method:req.method,headers,ca:readFileSync(caFile),rejectUnauthorized:true,timeout:30_000},incoming=>{
   const chunks:Buffer[]=[];let size=0;
   incoming.on("data",(chunk:Buffer)=>{size+=chunk.length;if(size>16*1024*1024){outgoing.destroy();reject(Error("ACCEPTANCE_RESPONSE_BOUND"));}else chunks.push(chunk);});
   incoming.on("end",()=>{const h=new Headers();for(const [key,value] of Object.entries(incoming.headers))for(const v of Array.isArray(value)?value:[value])if(v!==undefined)h.append(key,v);
    const status=incoming.statusCode??500;resolve(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers:h}));});
  });
  outgoing.on("timeout",()=>outgoing.destroy(Error("ACCEPTANCE_HTTP_TIMEOUT")));outgoing.on("error",()=>reject(Error("ACCEPTANCE_HTTP_TRANSPORT_FAILED")));outgoing.end(body);
 });
}
export async function nextTotp(db:PrismaClient,userId:string){
 const factor=await db.mfaAuthenticator.findFirstOrThrow({where:{userId,type:"TOTP",status:"ACTIVE",revokedAt:null}});
 assert(factor.secretEnvelope);const used=factor.totpLastUsedStep??-1;
 const wait=(used+1)*30_000-Date.now()+50;if(wait>0){assert(wait<=31_000);await new Promise(resolve=>setTimeout(resolve,wait));}
 return generateTotpForSyntheticQa({secretEnvelope:factor.secretEnvelope,userId,authenticatorId:factor.id});
}
export async function provisionSyntheticMfa(db:PrismaClient,userId:string){
 assertSyntheticServingTarget();
 assert.equal(await db.mfaAuthenticator.count({where:{userId}}),0,"MFA_FIXTURE_NOT_FRESH");
 const enrollment=await beginTotpEnrollment(db,{userId,displayName:"SYNTHETIC isolated factor",accountLabel:"synthetic@example.invalid"});
 const factor=await db.mfaAuthenticator.findUniqueOrThrow({where:{publicKey:enrollment.factorHandle}});assert(factor.secretEnvelope);
 const token=generateTotpForSyntheticQa({secretEnvelope:factor.secretEnvelope,userId,authenticatorId:factor.id});
 await confirmTotpEnrollment(db,{userId,factorHandle:enrollment.factorHandle,token,environment:boundAuthEnvironment()});
}
export async function realLogin(db:PrismaClient,username:string,password:string){
 const user=await db.user.findUniqueOrThrow({where:{username}});
 const before=await db.authSession.count({where:{userId:user.id}});
 const login=await privateHttp(syntheticOrigin+"/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({identifier:username,password})});
 assert.equal(login.status,202,"MFA_CHALLENGE_REQUIRED");assert.equal(login.headers.getSetCookie().length,0,"PRE_MFA_SESSION_COOKIE");assert.equal(await db.authSession.count({where:{userId:user.id}}),before);
 const challenge=await login.json();assert.equal(challenge.mfaRequired,true);assert(challenge.challengeToken);
 const challengeId=challenge.challengeToken.split(".")[0];
 const pending=await db.mfaChallenge.findUniqueOrThrow({where:{id:challengeId}});assert.equal(pending.userId,user.id);assert.equal(pending.usedAt,null);assert.equal(pending.type,"LOGIN");
 const authenticated=await privateHttp(syntheticOrigin+"/api/auth/login/mfa",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({challengeToken:challenge.challengeToken,factor:"TOTP",response:await nextTotp(db,user.id)})});
 assert.equal(authenticated.status,200,"ACTUAL_LOGIN_FAILED");const cookie=authenticated.headers.getSetCookie().map(c=>c.split(";")[0]).join("; ");assert(cookie);
 assert((await db.mfaChallenge.findUniqueOrThrow({where:{id:challengeId}})).usedAt);assert.equal(await db.authSession.count({where:{userId:user.id}}),before+1);
 return {userId:user.id,cookie};
}
export async function realStepUp(db:PrismaClient,actor:{userId:string;cookie:string},action:string){
 const post=(url:string,body:unknown)=>privateHttp(syntheticOrigin+url,{method:"POST",headers:{cookie:actor.cookie,"content-type":"application/json"},body:JSON.stringify(body)});
 const challenge=await post("/api/auth/step-up/challenge",{action});assert.equal(challenge.status,200);const body=await challenge.json();
 assert(typeof body.challengeToken==="string");const challengeId=body.challengeToken.split(".")[0];
 const pending=await db.mfaChallenge.findUniqueOrThrow({where:{id:challengeId}});assert.equal(pending.userId,actor.userId);assert.equal(pending.action,action);assert.equal(pending.usedAt,null);assert.equal(pending.revokedAt,null);assert.equal(pending.environment,boundAuthEnvironment());
 const done=await post("/api/auth/step-up/complete",{challengeToken:body.challengeToken,action,factor:"TOTP",response:await nextTotp(db,actor.userId)});assert.equal(done.status,200);const result=await done.json();assert(typeof result.stepUpToken==="string");
 const grant=await db.stepUpGrant.findUniqueOrThrow({where:{id:result.stepUpToken.split(".")[0]}});assert.equal(grant.userId,actor.userId);assert.equal(grant.sessionId,pending.sessionId);assert.equal(grant.action,action);assert.equal(grant.usedAt,null);assert.equal(grant.revokedAt,null);assert(grant.expiresAt.getTime()>Date.now());assert((await db.mfaChallenge.findUniqueOrThrow({where:{id:challengeId}})).usedAt);
 return result.stepUpToken as string;
}
