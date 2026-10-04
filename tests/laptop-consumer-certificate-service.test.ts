import {beforeEach,it,expect,vi} from 'vitest';
import {NextRequest,NextResponse} from 'next/server';
import {GET,POST} from '../app/api/certificates/requests/route';
import {certificateFixture} from '../scripts/laptop-lab/consumer-certificate-test-support';
import {runConnectedScenario} from '../scripts/laptop-lab/consumer-runner.mjs';
const state=vi.hoisted(()=>({auth:vi.fn(),list:vi.fn(),create:vi.fn(),event:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireApiPermission:state.auth}));
vi.mock('@/lib/prisma',()=>({prisma:{studentCertificateRequest:{findMany:state.list,create:state.create},studentCertificateEvent:{create:state.event}}}));
// Existing route/service mocking convention: real GET/POST and real
// createCertificateRequest, controlled auth/delegates; no database or listener.
beforeEach(()=>vi.resetAllMocks());
const scope={scenario:'disposable-mutation' as const,operations:['certificate_list','certificate_request'] as ('certificate_list'|'certificate_request')[],cpu:1,memoryBytes:2**30,pids:128,phaseTimeoutMs:2000,outputLimitBytes:2**20,origin:'https://portable-staging.localhost:8443' as const};
const connection={mode:'HARNESS_ONLY' as const,adapter:'AUTHENTICATED_OPERATION_ADAPTER' as const,profileSha256:'d'.repeat(64),producerSource:'a'.repeat(40),consumerRunId:'e'.repeat(32),lifecycle:'SIMULATED_RUNTIME' as const,processIntegration:'SIMULATED_PROCESS' as const};
function serviceFixture(){
 const f=certificateFixture();let requestCount=0;
 state.auth.mockResolvedValue({response:null,user:{id:f.binding.userId}});
 state.list.mockImplementation(async()=>structuredClone(f.rows));
 state.create.mockImplementation(async({data}:{data:Record<string,unknown>})=>{
  const row={id:'synthetic-service-'+(++requestCount),studentId:f.binding.studentId,academicYear:'2026-27',certificateType:'BONAFIDE',purpose:String(data.purpose),requestedCopies:1,urgency:'NORMAL',status:'SUBMITTED',requestSource:'INTERNAL',createdByUserId:f.binding.userId,requestNumber:String(data.requestNumber),createdEvents:0};
  f.rows.unshift(row);return {...row};
 });
 state.event.mockImplementation(async({data}:{data:{requestId:string;eventType:string;newStatus:string;recordedByUserId:string}})=>{
  expect(data.eventType).toBe('REQUEST_CREATED');expect(data.newStatus).toBe('SUBMITTED');expect(data.recordedByUserId).toBe(f.binding.userId);
  f.rows.find(r=>r.id===data.requestId)!.createdEvents++;return {};
 });
 f.ports.http=async(method,route,body,signal)=>{
  await f.clock.sleep(5,signal);const req=new NextRequest(scope.origin+route,{method,signal,...(method==='POST'?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
  return method==='GET'?GET(req):POST(req);
 };return f;
}
it('IN_PROCESS_SERVICE: normal adapter executes actual certificate routes and creation service with exact existing permissions',async()=>{
 const f=serviceFixture(),r=await runConnectedScenario(scope,f.adapter(),connection);expect(r.result.coverageComplete).toBe(true);expect(r.result.counts.success).toBe(12);
 expect(state.auth).toHaveBeenCalledWith('VIEW_CERTIFICATES');expect(state.auth).toHaveBeenCalledWith('MANAGE_CERTIFICATE_REQUESTS');
 expect(state.list).toHaveBeenCalledWith({where:{},orderBy:{createdAt:'desc'},take:250});expect(state.create).toHaveBeenCalledTimes(2);expect(state.event).toHaveBeenCalledTimes(2);
 expect(r.json).toContain('HARNESS_ONLY');expect(r.json).not.toContain(f.binding.studentId);
});
it.each([401,403])('IN_PROCESS_SERVICE: denied or expired auth %s stops before business delegates',async status=>{
 const f=serviceFixture();state.auth.mockResolvedValue({response:NextResponse.json({error:'SYNTHETIC refusal'},{status})});
 const r=await runConnectedScenario(scope,f.adapter(),connection);expect(r.result.counts.success).toBe(0);expect(r.result.counts.refused).toBe(3);expect(state.list).not.toHaveBeenCalled();expect(state.create).not.toHaveBeenCalled();
});
it('IN_PROCESS_SERVICE: actual service rejects malformed copies, with no request or event write',async()=>{
 const f=serviceFixture();const r=await POST(new NextRequest(scope.origin+'/api/certificates/requests',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({studentId:f.binding.studentId,certificateType:'BONAFIDE',purpose:'SYNTHETIC',requestedCopies:4})}));
 expect(r.status).toBe(400);expect(state.create).not.toHaveBeenCalled();expect(state.event).not.toHaveBeenCalled();
});
it('IN_PROCESS_SERVICE: a missing creation event cannot become a successful business operation',async()=>{
 const f=serviceFixture();state.event.mockResolvedValue({});const r=await runConnectedScenario({...scope,operations:['certificate_request']},f.adapter(),connection);expect(r.result.counts.success).toBe(0);expect(r.result.coverageComplete).toBe(false);
});
