// Invented in-process records and virtual clock. Never imported by the CLI.
import {randomUUID} from 'node:crypto';
import {VirtualClock} from './fixture.mjs';
import {createCertificateAdapter,type CertificateBinding,type CertificateRow,type CertificateSnapshot,type CertificatePorts} from './consumer-certificate-adapter';
export function certificateFixture(){
 const clock=new VirtualClock(),rows:CertificateRow[]=[],calls:{method:string;body:unknown}[]=[];
 const binding:CertificateBinding={source:'a'.repeat(40),consumerRunId:randomUUID().replaceAll('-',''),containerId:'b'.repeat(64),databaseIdentitySha256:'c'.repeat(64),userId:'synthetic-actor',username:'synthetic-lab-actor',studentId:'synthetic-student',academicYear:'2026-27',sessionId:randomUUID(),sessionSecretSha256:'f'.repeat(64)};
 const snapshot=():CertificateSnapshot=>({contract:'NPS_CERTIFICATE_READBACK_V1',source:binding.source,consumerRunId:binding.consumerRunId,containerId:binding.containerId,databaseIdentitySha256:binding.databaseIdentitySha256,userId:binding.userId,studentId:binding.studentId,sessionId:binding.sessionId,sessionState:'CURRENT_BOUND',rows:structuredClone(rows)});
 const ports:CertificatePorts={clock,measurement:'CONTROLLED_TRANSPORT',drive:work=>clock.drive(work),rebind:async()=>{},snapshot:async()=>snapshot(),http:async(method,_route,body,signal)=>{
  calls.push({method,body});await clock.sleep(5,signal);
  if(method==='GET')return Response.json({requests:rows});
  const input=body as {purpose:string};const row:CertificateRow={id:'synthetic-'+calls.length,studentId:binding.studentId,academicYear:'2026-27',certificateType:'BONAFIDE',purpose:input.purpose,requestedCopies:1,urgency:'NORMAL',status:'SUBMITTED',requestSource:'INTERNAL',createdByUserId:binding.userId,requestNumber:'CR-SYNTHETIC-'+calls.length,createdEvents:1};
  rows.unshift(row);return Response.json({request:row},{status:201});
 }};
 return {binding,ports,clock,rows,calls,snapshot,adapter:()=>createCertificateAdapter(binding,ports)};
}
