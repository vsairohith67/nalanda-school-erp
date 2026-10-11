import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,lstatSync} from 'node:fs';
import {request} from 'node:https';
import {performance} from 'node:perf_hooks';
import {setTimeout as sleep} from 'node:timers/promises';
import {validateHttpFixture} from '../portable/integrated-acceptance';
import {canonicalDirectory} from './consumer-profile';
import {createCertificateAdapter,type CertificateBinding} from './consumer-certificate-adapter';
import {certificateSessionProbe} from './consumer-session';
import type {ConsumerProfile,ArtifactReceipt,LabAdapter} from './consumer-types';

export class ConsumerWallClock {
  readonly kind='MONOTONIC_WALL';private start=Date.now();private tick=performance.now();private observed=0;
  now(){return this.observed=Math.floor(performance.now()-this.tick);}
  iso(){return new Date(this.start+this.observed).toISOString();}
  async sleep(ms:number,signal?:AbortSignal){await sleep(ms,undefined,{signal});}
}
export function privateFile(root:string,file:string,max:number){canonicalDirectory(root);const p=path.join(root,file),s=lstatSync(p);assert(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.size>0&&s.size<=max,'CERTIFICATE_PRIVATE_INPUT_UNSAFE');return readFileSync(p);}
/** Post-readiness preparation resolves an actual fixture and issued session.
 * This private input is an operand, never an admission or approval receipt. */
export async function loadCertificateInputs(root:string,p:ConsumerProfile,r:ArtifactReceipt,containerId:string){
  const raw=JSON.parse(privateFile(root,'operation-inputs.json',16384).toString());
  assert(Object.keys(raw).sort().join()==='academicYear,consumerRunId,cookie,databaseIdentitySha256,fixture,userId','CERTIFICATE_PRIVATE_INPUT_CONTRACT');
  const fixture=validateHttpFixture(raw.fixture,r.source);assert.equal(fixture.containerId,containerId);assert.equal(fixture.origin,p.scope.origin);
  assert(raw.consumerRunId===p.consumer.runId&&typeof raw.cookie==='string'&&raw.cookie.length>0&&raw.cookie.length<=4096&&!/[\r\n]/.test(raw.cookie),'CERTIFICATE_SESSION_INPUT_REQUIRED');
  const binding:CertificateBinding={source:r.source,consumerRunId:p.consumer.runId,containerId,databaseIdentitySha256:raw.databaseIdentitySha256,userId:raw.userId,username:fixture.username,studentId:fixture.studentId,academicYear:raw.academicYear,...await certificateSessionProbe(raw.cookie)};
  return {binding,cookie:String(raw.cookie),ca:privateFile(path.join(root,'secrets'),'http_ca',16384)};
}
export function consumerHttp(p:ConsumerProfile,root:string,cookie?:string){
  const ca=privateFile(path.join(root,'secrets'),'http_ca',16384);
  return async(method:'GET'|'POST',route:'/api/certificates/requests'|'/api/auth/login',body:unknown,signal:AbortSignal)=>{
      assert(!signal.aborted,'CERTIFICATE_OPERATION_CANCELLED');const url=new URL(route,p.scope.origin),bytes=body===undefined?undefined:Buffer.from(JSON.stringify(body));
      assert(url.origin==='https://portable-staging.localhost:8443'&&['/api/certificates/requests','/api/auth/login'].includes(url.pathname)&&!url.search&&!url.hash&&!url.username&&!url.password,'CERTIFICATE_HTTP_TARGET');
      assert(route==='/api/auth/login'?method==='POST'&&!cookie:!!cookie,'CERTIFICATE_HTTP_SESSION_BOUNDARY');
      assert(!bytes||bytes.length<4096,'CERTIFICATE_REQUEST_BOUND');
      // Fixed verified loopback proxy and SNI/CA validation, no DNS override,
      // TLS waiver or automatic redirect. Rebind is checked by the adapter.
      return new Promise<Response>((resolve,reject)=>{
        let deadline:ReturnType<typeof setTimeout>|undefined,settled=false;
        const fail=(error:Error)=>{if(settled)return;settled=true;clearTimeout(deadline);reject(error);};
        const done=(response:Response)=>{if(settled)return;settled=true;clearTimeout(deadline);resolve(response);};
        const req=request({hostname:'127.0.0.1',servername:url.hostname,port:8443,path:url.pathname,method,ca,rejectUnauthorized:true,signal,timeout:Math.min(p.scope.phaseTimeoutMs,2000),headers:{host:url.host,origin:url.origin,...(cookie?{cookie}:{}),...(bytes?{'content-type':'application/json','content-length':bytes.length}:{})}},res=>{
          const chunks:Buffer[]=[];let size=0;res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>64*2**10)req.destroy(Error('CERTIFICATE_RESPONSE_BOUND'));else chunks.push(chunk);});
          res.on('aborted',()=>fail(Error('CERTIFICATE_RESPONSE_PARTIAL')));res.on('error',fail);
          res.on('end',()=>{try{const headers=new Headers();for(const [k,values] of Object.entries(res.headers))for(const value of Array.isArray(values)?values:[values])if(value!==undefined)headers.append(k,value);
            const status=res.statusCode??500;done(new Response([204,205,304].includes(status)?null:Buffer.concat(chunks),{status,headers}));}catch{fail(Error('CERTIFICATE_HTTP_RESPONSE_INVALID'));}});
        });req.on('timeout',()=>req.destroy(Error('CERTIFICATE_HTTP_TIMEOUT')));req.on('error',fail);
        // Socket inactivity is insufficient for a trickling response. Bound
        // the entire login or business exchange, including response bytes.
        if(!settled)deadline=setTimeout(()=>req.destroy(Error('CERTIFICATE_HTTP_DEADLINE')),Math.min(p.scope.phaseTimeoutMs,2000));
        req.end(bytes);
      });
    };
}
export async function boundCertificateAdapter(p:ConsumerProfile,r:ArtifactReceipt,root:string,containerId:string,rebind:(signal:AbortSignal)=>Promise<void>,readback:(probe:string,signal:AbortSignal)=>Promise<unknown>):Promise<LabAdapter>{
  const input=await loadCertificateInputs(root,p,r,containerId),clock=new ConsumerWallClock();
  return createCertificateAdapter(input.binding,{clock,drive:work=>work,measurement:'BOUND_HTTP',rebind,
    snapshot:signal=>readback(Buffer.from(JSON.stringify({contract:'NPS_CERTIFICATE_PROBE_V1',...input.binding})).toString('base64url'),signal),
    http:consumerHttp(p,root,input.cookie)});
}
