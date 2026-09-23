import {afterEach,it,expect,vi} from "vitest";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {CertificateWorkflowActions,CertificateRequestActions} from "../components/certificate-forms";
import CertificatePrintPage from "../app/certificates/[id]/print/page";

const state=vi.hoisted(()=>({values:[] as any[],effects:[] as Array<()=>void>,setters:[] as any[]}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:()=>{}})}));
vi.mock("../lib/auth",()=>({requirePermission:async()=>({id:"SYNTHETIC"})}));
vi.mock("../lib/prisma",()=>({prisma:{studentCertificate:{findUnique:async()=>({id:"synthetic",certificateType:"GRADUATION",status:"CANCELLED"})}}}));
vi.mock("../lib/school-settings",()=>({getSchoolSettings:async()=>({schoolName:"NALANDA PUBLIC SCHOOL"})}));
vi.mock("../lib/certificate-graduation-policy",()=>({assertGraduationEnabled:()=>{}}));
vi.mock("react",async original=>{const actual=await original<typeof import("react")>();return {...actual,useState:()=>{const setter=vi.fn();state.setters.push(setter);return [state.values.shift(),setter];},useEffect:(effect:()=>void)=>{state.effects.push(effect);}};});
afterEach(()=>{state.values=[];state.effects=[];state.setters=[];vi.unstubAllGlobals();});
function render(component:any,props:any,dialog:string|null,error="",reason=""){
 vi.stubGlobal("React",React);state.values=[error,false,dialog,reason];return renderToStaticMarkup(React.createElement(component,props));
}
it("UNIT_OR_CONTRACT: pending error is inside the native modal, not hidden behind its inert background",()=>{
 const html=render(CertificateWorkflowActions,{id:"synthetic",status:"APPROVED",updatedAt:"v1",type:"GRADUATION",permissions:["ISSUE_CERTIFICATES"]},"issue","SYNTHETIC refused");
 const modal=html.slice(html.indexOf("<dialog"),html.indexOf("</dialog>"));expect(modal).toContain('aria-label="Issue Certificate"');expect(modal).toContain('role="alert"');expect(modal).toContain("SYNTHETIC refused");expect(html.match(/SYNTHETIC refused/g)).toHaveLength(1);expect(modal).toContain("Go back");
});
it("UNIT_OR_CONTRACT: cancelled status exposes no issue action and reasonless void cannot commit",()=>{
 const html=render(CertificateWorkflowActions,{id:"synthetic",status:"CANCELLED",updatedAt:"v2",type:"GRADUATION",permissions:["ISSUE_CERTIFICATES","CANCEL_ISSUED_CERTIFICATES"]},null);expect(html).not.toContain("Issue Certificate</button>");
 state.setters=[];const pending=render(CertificateWorkflowActions,{id:"synthetic",status:"ISSUED",updatedAt:"v2",type:"GRADUATION",permissions:["CANCEL_ISSUED_CERTIFICATES"]},"cancel");expect(pending).toMatch(/disabled="">Cancel Issued Certificate/);
});
it("UNIT_OR_CONTRACT: new authoritative request state clears stale dialog and reason",()=>{
 render(CertificateRequestActions,{id:"synthetic",status:"APPROVED",updatedAt:"new",permissions:["APPROVE_CERTIFICATES"]},"approve");
 state.effects[0]();expect(state.setters[2]).toHaveBeenCalledWith(null);expect(state.setters[3]).toHaveBeenCalledWith("");
});
it("UNIT_OR_CONTRACT: actual cancelled Graduation print page says void, never draft or downloadable",async()=>{
 vi.stubGlobal("React",React);const html=renderToStaticMarkup(await CertificatePrintPage({params:Promise.resolve({id:"synthetic"}),searchParams:Promise.resolve({})}));
 expect(html).toContain("VOID - history retained. This certificate is no longer valid.");expect(html).not.toContain("DRAFT");expect(html).not.toContain("Open saved issued PDF");
});
