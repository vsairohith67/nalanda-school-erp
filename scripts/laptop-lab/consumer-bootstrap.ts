import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFileSync} from 'node:fs';
import {validateHttpFixture} from '../portable/integrated-acceptance';
import {validateCertificateBinding,validateCertificateSnapshot} from './consumer-certificate-adapter';
import {certificateSessionProbe} from './consumer-session';
import {privateFile,consumerHttp} from './consumer-operation-ports';
import type {ConsumerProfile,ArtifactReceipt} from './consumer-types';
export type BootstrapPorts={rebind(signal:AbortSignal):Promise<void>;fixture(input:Uint8Array,signal:AbortSignal):Promise<unknown>;ca(signal:AbortSignal):Promise<string>;readback(probe:string,signal:AbortSignal):Promise<unknown>};
/** Reuse existing OFF fixture/login/readback after the actual target exists.
 * No predicted container/user/session/CA identities are pre-launch operands. */
export async function prepareCertificateInputs(p:ConsumerProfile,r:ArtifactReceipt,root:string,containerId:string,ports:BootstrapPorts,signal:AbortSignal){
 const check=()=>assert(!signal.aborted,'CERTIFICATE_PREPARATION_CANCELLED');
 const bind=async()=>{check();await ports.rebind(signal);check();};
 const password=privateFile(root,'fixture-password',128).toString();
 assert(password.length>=48&&password.length<=128,'CERTIFICATE_FIXTURE_PASSWORD_REQUIRED');
 await bind();
 const fixture=validateHttpFixture({...await ports.fixture(Buffer.from(JSON.stringify({password,source:r.source,initializeEmptySynthetic:true})),signal) as object,containerId},r.source);
 assert.equal(fixture.origin,p.scope.origin,'CERTIFICATE_FIXTURE_ORIGIN_MISMATCH');await bind();
 const encode=(value:unknown)=>Buffer.from(JSON.stringify(value)).toString('base64url');
 const resolved=await ports.readback(encode({contract:'NPS_CERTIFICATE_FIXTURE_BINDING_V1',source:r.source,consumerRunId:p.consumer.runId,containerId,username:fixture.username,studentId:fixture.studentId}),signal) as Record<string,unknown>;
 assert(resolved&&resolved.contract==='NPS_CERTIFICATE_FIXTURE_IDENTITY_V1','CERTIFICATE_FIXTURE_READBACK_REQUIRED');
 for(const [key,value] of Object.entries({source:r.source,consumerRunId:p.consumer.runId,containerId,username:fixture.username,studentId:fixture.studentId,academicYear:'2026-27'}))assert.equal(resolved[key],value,'CERTIFICATE_FIXTURE_BINDING_MISMATCH');
 await bind();const ca=await ports.ca(signal);assert(ca.startsWith('-----BEGIN CERTIFICATE-----')&&Buffer.byteLength(ca)<=16384,'CERTIFICATE_CA_INVALID');
 writeFileSync(path.join(root,'secrets/http_ca'),ca,{flag:'wx',mode:0o600});await bind();
 // Ordinary production-OFF login. Unexpected MFA/challenge/denial is retained
 // as a prerequisite; never enable flags, mint sessions or invoke signed ON QA.
 const login=await consumerHttp(p,root)('POST','/api/auth/login',{identifier:fixture.username,password},signal);check();
 assert(login.status===200&&!login.redirected&&(login.headers.get('content-type')??'').split(';')[0]==='application/json','CERTIFICATE_NORMAL_LOGIN_REQUIRED');
 const result=await login.json() as Record<string,unknown>;assert(result.user&&!result.mfaRequired&&!result.error&&!result.setupRequired,'CERTIFICATE_NORMAL_LOGIN_REQUIRED');
 const cookies=login.headers.getSetCookie();assert(cookies.length===1,'CERTIFICATE_ISSUED_SESSION_REQUIRED');
 const cookie=cookies[0].split(';')[0];const session=await certificateSessionProbe(cookie);
 const binding=validateCertificateBinding({source:r.source,consumerRunId:p.consumer.runId,containerId,username:fixture.username,studentId:fixture.studentId,userId:resolved.userId as string,academicYear:'2026-27',databaseIdentitySha256:resolved.databaseIdentitySha256 as string,...session});
 await bind();validateCertificateSnapshot(await ports.readback(encode({contract:'NPS_CERTIFICATE_PROBE_V1',...binding}),signal),binding);check();
 writeFileSync(path.join(root,'operation-inputs.json'),JSON.stringify({academicYear:binding.academicYear,consumerRunId:p.consumer.runId,cookie,databaseIdentitySha256:binding.databaseIdentitySha256,userId:binding.userId,fixture}),{flag:'wx',mode:0o600});
}
