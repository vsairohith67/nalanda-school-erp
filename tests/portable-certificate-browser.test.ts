import {describe,it,expect,vi} from "vitest";
import {assertCertificateStep,assertCertificateSnapshot,assertDocumentIdentity} from "../scripts/portable/certificate-browser-assertions";
import {certificateModal,certificateModalReflow,certificateUiResponse,ownedCertificateContexts,certificateBrowser,isExpectedDenialConsole} from "../scripts/portable/certificate-browser";
import {certificateProbeScope,certificateActorUsername} from "../scripts/portable/certificate-browser-probe";
import {inspectCertificateDocument} from "../scripts/portable/certificate-browser-document";
import {createHash} from "node:crypto";
import {PDFDocument,StandardFonts} from "pdf-lib";

const base=()=>({scope:"synthetic-certificate-browser-test",studentId:"s",academicYear:"2026-27",requests:[],certificates:[],charges:[],receipts:[],versions:[],artifacts:[],events:[],payments:[]});
describe("certificate Browser assertions — UNIT_OR_CONTRACT, no rendered ERP",()=>{
 it("rejects stale scope and foreign targets",()=>{
  expect(()=>assertCertificateSnapshot(base(),"other","s")).toThrow();
  expect(()=>assertCertificateSnapshot({...base(),requests:[{studentId:"foreign",academicYear:"2026-27"}]},base().scope,"s")).toThrow();
 });
 it("requires the actual request event and actor and exactly one new request",()=>{
  const before=base(),request={id:"r",studentId:"s",academicYear:"2026-27",status:"SUBMITTED",createdByUserId:"a"};
  const event={id:"e",requestId:"r",eventType:"REQUEST_CREATED",previousStatus:null,newStatus:"SUBMITTED",recordedByUserId:"a"};
  const after={...before,requests:[request],events:[event]};
  expect(()=>assertCertificateStep(before,after,"request","a")).not.toThrow();
  for(const changed of [{...after,events:[]},{...after,events:[{...event,recordedByUserId:"wrong"}]},{...after,requests:[request,{...request,id:"duplicate"}]},{...after,requests:[{...request,status:"APPROVED"}]}])expect(()=>assertCertificateStep(before,changed,"request","a")).toThrow();
 });
 it("denied/cancelled/reprinted operations cannot change business state",()=>{
  expect(()=>assertCertificateStep(base(),base(),"unchanged","a")).not.toThrow();
  expect(()=>assertCertificateStep(base(),{...base(),receipts:[{id:"duplicate"}]},"unchanged","a")).toThrow();
 });
 it("rejects changed document bytes and missing provenance",()=>{
  const bytes=Buffer.from("%PDF-SYNTHETIC");
  expect(()=>assertDocumentIdentity(bytes,{pdfHash:createHash("sha256").update(bytes).digest("hex"),fontFamily:"Georgia Bold"})).not.toThrow();
  expect(()=>assertDocumentIdentity(bytes,{pdfHash:"a".repeat(64),fontFamily:"Georgia Bold"})).toThrow();
  expect(()=>assertDocumentIdentity(bytes,{pdfHash:"",fontFamily:"substitute"})).toThrow();
 });
 it.each(["source","runId","attempt"])("refuses substituted %s before fixture creation",key=>{
  const cap={source:"a".repeat(40),runId:"100",attempt:"1"},input={...cap,iteration:"12345678-1234-1234-1234-123456789012"};
  expect(certificateProbeScope(input,cap)).toMatch(/^synthetic-certificate-browser-/);
  expect(()=>certificateProbeScope({...input,[key]:"other"},cap)).toThrow();
 });
 it("normalises bounded real-login usernames without private Student canaries",()=>{
  for(const role of ["preparer","reviewer","financePreparer","financeApprover","parent","otherParent","low"] as const){const name=certificateActorUsername(base().scope,role);expect(name).toMatch(/^[a-z0-9][a-z0-9._-]{2,63}$/);expect(name).not.toContain(base().scope);}
 });
 it("registers response observation before clicking and rejects wrong denial/success",async()=>{
  const order:string[]=[],response=(status:number,body:any)=>({url:()=>"https://portable-staging.localhost:8443/api/certificates/r/workflow",status:()=>status,request:()=>({method:()=>"POST"}),headers:()=>({"content-type":"application/json"}),body:async()=>Buffer.from(JSON.stringify(body))});
  let reply=response(403,{error:"You do not have permission for this action"});const page={waitForResponse:async(fn:any)=>{order.push("listen");expect(fn(reply)).toBe(true);return reply;}};
  const click=async()=>{order.push("click");};
  await certificateUiResponse(page,"/api/certificates/r/workflow",click,403,"You do not have permission for this action");expect(order).toEqual(["listen","click"]);
  expect(isExpectedDenialConsole(page,reply.url(),"Failed to load resource: the server responded with a status of 403 (Forbidden)")).toBe(true);
  expect(isExpectedDenialConsole(page,"https://other.invalid/","Failed to load resource: the server responded with a status of 403 (Forbidden)")).toBe(false);
  expect(isExpectedDenialConsole(page,reply.url(),"Hydration failed")).toBe(false);
  for(const [status,error] of [[200,"success"],[400,"malformed"],[409,"conflict"],[429,"rate limit"],[500,"failed"],[403,"wrong reason"]] as const){reply=response(status,{error});await expect(certificateUiResponse(page,"/api/certificates/r/workflow",click,403,"You do not have permission for this action")).rejects.toThrow();}
 });
 it("verifies modal focus, Tab cycle, Escape and no-effect readback before confirmation",async()=>{
  const order:string[]=[];let inside=true;const dialog={waitFor:async()=>{},evaluate:async()=>inside,locator:()=>({count:async()=>2}),getByLabel:()=>({fill:async()=>{order.push("reason");}})};
  const trigger={click:async()=>{order.push("open");},evaluate:async()=>true};const page={getByRole:(role:string)=>role==="dialog"?dialog:trigger,keyboard:{press:async(key:string)=>{order.push(key);}}};
  await certificateModal(page,"Cancel Issued Certificate",async()=>{order.push("commit");},async()=>{order.push("readback");},"SYNTHETIC reason");
  expect(order).toEqual(["open","Tab","Tab","Tab","Tab","Escape","readback","open","reason","commit"]);
  inside=false;await expect(certificateModal(page,"Issue Certificate",async()=>{},async()=>{})).rejects.toThrow("INITIAL_FOCUS");
  trigger.click=async()=>{throw Error("missing control");};await expect(certificateModal(page,"Absent",async()=>{},async()=>{})).rejects.toThrow("missing control");
 });
 it("closes every owned context after interruption, including partial setup",async()=>{
  const close=vi.fn(async()=>{}),browser={newContext:vi.fn(async()=>({close}))};
  await expect(ownedCertificateContexts(async open=>{await open({});await open({});throw Error("interrupted");},browser)).rejects.toThrow("interrupted");expect(close).toHaveBeenCalledTimes(2);
  close.mockRejectedValueOnce(Error("cleanup refused"));await expect(ownedCertificateContexts(async open=>{await open({});return true;},browser)).rejects.toThrow("CONTEXT_CLEANUP_FAILED");
 });
 it("rejects modal clipping before dismissing a visible server error",async()=>{
  await expect(certificateModalReflow({evaluate:async()=>true})).resolves.toBeUndefined();
  await expect(certificateModalReflow({evaluate:async()=>false})).rejects.toThrow("CONTENT_CLIPPED");
 });
 it("rejects wrong target before a browser or fixture and closes missing-control contexts",async()=>{
  const probe=vi.fn(),browser={newContext:vi.fn()},input={origin:"https://portable-staging.localhost:8443",password:"x".repeat(64),source:"a".repeat(40),runId:"1",attempt:"1",bind:()=>{throw Error("wrong target");},probe};
  await expect(certificateBrowser(browser,input)).rejects.toThrow("wrong target");expect(probe).not.toHaveBeenCalled();expect(browser.newContext).not.toHaveBeenCalled();
  const close=vi.fn(async()=>{});browser.newContext.mockResolvedValue({close,route:async()=>{},addInitScript:async()=>{},newPage:async()=>({on:()=>{},goto:async()=>{},getByLabel:()=>({fill:async()=>{throw Error("missing UI control");}})})});
  probe.mockImplementation(async(data:any)=>data.operation==="prepare"?{scope:base().scope,studentId:"s",actors:{preparer:{username:"synthetic"}}}:base());
  await expect(certificateBrowser(browser,{...input,bind:()=>{}})).rejects.toThrow("missing UI control");expect(close).toHaveBeenCalledOnce();
 });
 it("rejects a hash-consistent PDF with substitute font and no actual required content",async()=>{
  const doc=await PDFDocument.create();doc.setTitle("School-issued certificate");const p=doc.addPage(),font=await doc.embedFont(StandardFonts.Helvetica);p.drawText("NALANDA PUBLIC SCHOOL",{font});const bytes=Buffer.from(await doc.save());
  assertDocumentIdentity(bytes,{pdfHash:createHash("sha256").update(bytes).digest("hex"),fontFamily:"Georgia Bold"});
  await expect(inspectCertificateDocument(bytes,"ISSUED",undefined,{studentName:"SYNTHETIC",academicYear:"2026-27"})).rejects.toThrow();
 });
});
