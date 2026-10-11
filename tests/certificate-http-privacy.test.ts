import {beforeEach,it,expect,vi} from "vitest";
import {NextRequest,NextResponse} from "next/server";
import {createHash} from "node:crypto";
import {POST} from "../app/api/certificates/verify/route";
import {assertVerification,assertDenial} from "../scripts/portable/http-assertions";
const state=vi.hoisted(()=>({auth:vi.fn(),artifact:vi.fn(),certificate:vi.fn(),successor:vi.fn(),version:vi.fn(),enabled:vi.fn()}));
vi.mock("@/lib/auth",()=>({requireApiPermission:state.auth}));
vi.mock("@/lib/prisma",()=>({prisma:{certificateIssueArtifact:{findUnique:state.artifact},studentCertificate:{findUnique:state.certificate,findFirst:state.successor},studentCertificateVersion:{findUnique:state.version}}}));
vi.mock("@/lib/release-feature-flag-runtime",()=>({CERTIFICATE_VERIFICATION_FEATURE:{key:"certificate-verification-1a"},assertOperationalReleaseFeature:(...args:unknown[])=>state.enabled(...args),ReleaseFeatureUnavailableError:class extends Error{status=404;}}));
const token="T".repeat(43),secret="SYNTHETIC-PRIVATE-SENTINEL",snapshot=JSON.stringify({studentName:secret,phone:secret,dob:secret,marks:secret,income:secret,session:secret,path:secret});
const request=(value:unknown)=>new NextRequest("https://portable-staging.localhost:8443/api/certificates/verify",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({token:value})});
beforeEach(()=>{
 vi.resetAllMocks();state.auth.mockResolvedValue({user:{id:"synthetic-reviewer"},response:null});
 state.artifact.mockImplementation(async({where}:{where:{tokenHash:string}})=>where.tokenHash===createHash("sha256").update(token).digest("hex")?{certificateId:"cert",versionId:"version",expiresAt:new Date("2099-01-01"),snapshotHash:createHash("sha256").update(snapshot).digest("hex"),pdfBase64:secret}:null);
 state.certificate.mockResolvedValue({id:"cert",status:"ISSUED",currentVersionNumber:1,certificateType:"GRADUATION",academicYear:"2026-27",studentName:secret});
 state.version.mockResolvedValue({id:"version",certificateId:"cert",versionNumber:1,snapshotJson:snapshot,snapshotHash:createHash("sha256").update(snapshot).digest("hex")});state.successor.mockResolvedValue(null);
});
it("SERVICE_OR_ROUTE_HANDLER: real verification service projects exact private status responses",async()=>{
 await assertVerification(await POST(request(token)),{status:"ISSUED",authentic:true,certificateType:"GRADUATION",academicYear:"2026-27",issuerKind:"SCHOOL_INSTITUTIONAL"},[secret,token]);
 state.successor.mockResolvedValue({id:"successor"});await assertVerification(await POST(request(token)),{status:"SUPERSEDED",authentic:false},[secret,token]);
 state.certificate.mockResolvedValue({id:"cert",status:"CANCELLED"});await assertVerification(await POST(request(token)),{status:"VOID",authentic:false},[secret,token]);
 for(const value of ["short","U".repeat(43),"https://external.invalid/",null])await assertVerification(await POST(request(value)),{status:"UNAVAILABLE",authentic:false},[secret,token]);
 expect(state.auth).toHaveBeenCalledWith("VIEW_CERTIFICATES");
});
it("SERVICE_OR_ROUTE_HANDLER: refuses unauthenticated or unauthorised calls before private reads",async()=>{
 for(const [status,error] of [[401,"Authentication required"],[403,"You do not have permission for this action"]] as const){
  state.auth.mockResolvedValue({response:NextResponse.json({error},{status})});await assertDenial(await POST(request(token)),status,{error},[secret,token]);
 }
 expect(state.artifact).not.toHaveBeenCalled();
});
it("SERVICE_OR_ROUTE_HANDLER: storage exceptions never disclose private details",async()=>{
 state.artifact.mockRejectedValue(Error(secret));const response=await POST(request(token));expect(response.status).toBe(400);expect(await response.json()).toEqual({error:"Certificate operation failed. Review the selected records and configuration."});
});
