import assert from "node:assert/strict";
import {createHash,randomUUID} from "node:crypto";
import {BROWSER_MATRIX} from "./integrated-acceptance";
import {downloadBytes} from "./integrated-browser";
import {assertDenial} from "./http-assertions";
import {decodeCertificateQr} from "./certificate-qr";
import {inspectCertificateDocument} from "./certificate-browser-document";
import {assertCertificateSnapshot,assertCertificateStep,assertDocumentIdentity,type CertificateBrowserAction,type CertificateBrowserState} from "./certificate-browser-assertions";
import type {CertificateActor} from "./certificate-browser-probe";

export const CERTIFICATE_BROWSER_SCENARIOS=Object.freeze([
 "CB1-readiness-request-independent-review", "CB2-charge-approval-single-collection", "CB3-draft-submit-approve-issue",
 "CB4-private-document-reprint-qr", "CB5-governed-reissue-void", "CB6-parent-denied-and-revoked-link",
 "CB7-modal-keyboard-responsive-private-render"
]);
type Input={origin:string;password:string;source:string;runId:string;attempt:string;bind:()=>unknown;probe:(input:unknown)=>Promise<any>};
export async function ownedCertificateContexts<T>(work:(open:(options:any)=>Promise<any>)=>Promise<T>,browser:any){
 const contexts:any[]=[];try{return await work(async options=>{const context=await browser.newContext(options);contexts.push(context);return context;});}
 finally{const results=await Promise.allSettled(contexts.map(c=>c.close()));assert(results.every(r=>r.status==="fulfilled"),"CERTIFICATE_BROWSER_CONTEXT_CLEANUP_FAILED");}
}
export async function certificateUiResponse(page:any,path:string,action:()=>Promise<unknown>,status=200,error?:string){
 const waiting=page.waitForResponse((r:any)=>{const u=new URL(r.url());return u.origin==="https://portable-staging.localhost:8443"&&u.pathname===path&&r.request().method()==="POST";});
 const [response]=await Promise.all([waiting,action()]);
 if(error){recordExpectedDenial(page,response);await assertDenial(new Response(await response.body(),{status:response.status(),headers:response.headers()}),status as 403,{error});}
 else assert.equal(response.status(),status,"CERTIFICATE_UI_OPERATION_REFUSED");
}
export async function certificateModal(page:any,label:string,commit:()=>Promise<void>,unchanged:()=>Promise<void>,reason?:string){
 const trigger=page.getByRole("button",{name:label,exact:true});await trigger.click();
 const dialog=page.getByRole("dialog",{name:label,exact:true});await dialog.waitFor();
 assert(await dialog.evaluate((e:HTMLElement)=>e.contains(document.activeElement)),"CERTIFICATE_MODAL_INITIAL_FOCUS");
 await certificateModalReflow(dialog);
 const count=await dialog.locator("button,textarea,input,select,a[href]").count();assert(count>0&&count<20);
 for(let i=0;i<count+2;i++){await page.keyboard.press("Tab");assert(await dialog.evaluate((e:HTMLElement)=>e.contains(document.activeElement)),"CERTIFICATE_MODAL_FOCUS_ESCAPED");}
 await page.keyboard.press("Escape");await dialog.waitFor({state:"hidden"});assert(await trigger.evaluate((e:HTMLElement)=>document.activeElement===e),"CERTIFICATE_MODAL_FOCUS_RETURN");await unchanged();
 await trigger.click();await dialog.waitFor();if(reason)await dialog.getByLabel("Reason",{exact:true}).fill(reason);await commit();
}
export async function certificateModalReflow(dialog:any){
 assert(await dialog.evaluate((e:HTMLElement)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1&&e.scrollWidth<=e.clientWidth+1;}),"CERTIFICATE_MODAL_CONTENT_CLIPPED");
}
export async function certificateBrowser(browser:any,input:Input){
 assert.equal(input.origin,"https://portable-staging.localhost:8443");const results=[];
 // Each matrix and motion mode has a new owned Student, actors and template.
 // No earlier issued request is reused to stand in for a fresh journey.
 for(const matrix of BROWSER_MATRIX){
  const reducedMotion=matrix.colorScheme==="dark"?"reduce":"no-preference";
  input.bind();const binding={source:input.source,runId:input.runId,attempt:input.attempt,iteration:randomUUID()};
  const probe=async(operation:string,extra:Record<string,unknown>={})=>{input.bind();const r=await input.probe({...binding,operation,...extra});input.bind();return r;};
  const fixture=await probe("prepare",{password:input.password}),errors:Array<{kind:string;page?:any;url?:string;text?:string}>=[];
  const read=async()=>{const s=await probe("snapshot") as CertificateBrowserState;assertCertificateSnapshot(s,fixture.scope,fixture.studentId);for(const row of s.certificates)assert.equal(row.templateId,fixture.templateId);for(const version of s.versions){const template=JSON.parse(version.snapshotJson).template;assert.equal(template.code,fixture.scope);assert.equal(template.versionNumber,1);}return s;};
  const initial=await read();assert.equal(initial.requests.length,0);assert.equal(initial.certificates.length,0);assert.equal(initial.receipts.length,0);
  await ownedCertificateContexts(async open=>{
   const pages:Partial<Record<CertificateActor,any>>={};
   const options={viewport:matrix.viewport,colorScheme:matrix.colorScheme,reducedMotion,acceptDownloads:true,ignoreHTTPSErrors:false,serviceWorkers:"block"};
   const watch=(page:any)=>{page.on("pageerror",()=>errors.push({kind:"PAGE_ERROR"}));page.on("console",(m:any)=>{if(m.type()==="error")errors.push({kind:"CONSOLE_ERROR",page,url:m.location().url,text:m.text()});});return page;};
   const createPage=async(canaries:string[]=[])=>{
    const context=await open(options);
    await context.route("**/*",async(route:any)=>{const url=new URL(route.request().url());if(url.origin!==input.origin||url.username||url.password){errors.push({kind:"UNEXPECTED_NETWORK_TARGET"});await route.abort("blockedbyclient");return;}await route.continue();});
    await context.addInitScript((values:string[])=>{
     // Starts before page scripts and survives document navigation via storage.
     const check=()=>{if(values.some(v=>document.documentElement?.textContent?.includes(v)))sessionStorage.setItem("certificate-private-flash","true");};
     new MutationObserver(check).observe(document,{subtree:true,childList:true,characterData:true});check();
    },canaries);
    return watch(await context.newPage());
   };
   const login=async(name:CertificateActor,canaries:string[]=[])=>{
    const page=await createPage(canaries);await page.goto(input.origin+"/login");
    await page.getByLabel("Username or verified login identifier").fill(fixture.actors[name].username);await page.locator('input[name="password"]').fill(input.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();
    await page.getByLabel("Six-digit authenticator code").waitFor();await page.getByLabel("Six-digit authenticator code").fill((await probe("totp",{actor:name})).token);await page.getByRole("button",{name:"Verify and sign in",exact:true}).click();await page.waitForURL((u:URL)=>u.pathname!=="/login");assert.equal((await probe("login-evidence",{actor:name})).userId,fixture.actors[name].id);pages[name]=page;return page;
   };
   const workspace=async(page:any,request?:string)=>{
    await page.goto(input.origin+"/certificates/graduation");await page.getByRole("heading",{name:"Graduation Certificates",exact:true}).waitFor();
    if(request)await page.getByLabel("Request",{exact:true}).selectOption(request);
   };
   const health=async(page:any)=>{
    assert.equal(await page.locator("nextjs-portal").count(),0,"CERTIFICATE_FRAMEWORK_OVERLAY");
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"CERTIFICATE_PAGE_OVERFLOW");
    assert.equal(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches),reducedMotion==="reduce");
    assert.equal(await page.evaluate(()=>matchMedia("(prefers-color-scheme: dark)").matches),matrix.colorScheme==="dark");
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains("dark")),matrix.colorScheme==="dark","CERTIFICATE_RENDERED_THEME_MISMATCH");
    if(reducedMotion==="reduce")assert(await page.locator(".app-shell button").evaluateAll((buttons:HTMLElement[])=>buttons.every(b=>[getComputedStyle(b).animationDuration,getComputedStyle(b).transitionDuration].every(value=>value.split(",").every(v=>parseFloat(v)<=0.001)))),"CERTIFICATE_REDUCED_MOTION_NOT_APPLIED");
   };
   const change=async(operation:CertificateBrowserAction,name:CertificateActor,action:()=>Promise<void>,target?:string)=>{const b=await read();await action();const a=await read();assertCertificateStep(b,a,operation,fixture.actors[name].id,target);await health(pages[name]);return a;};
   const requestPage=async(name:CertificateActor,id:string)=>{const page=pages[name]??await login(name);await workspace(page,id);return page;};
   const modalAction=async(name:CertificateActor,label:string,path:string,operation:CertificateBrowserAction,target:string,reason?:string,denial?:string)=>{
    const page=pages[name],before=await read();await certificateModal(page,label,async()=>{
     await certificateUiResponse(page,path,()=>page.getByRole("dialog",{name:label,exact:true}).getByRole("button",{name:label,exact:true}).click(),denial?403:200,denial);
     if(denial){const d=page.getByRole("dialog",{name:label,exact:true});await d.getByRole("alert").getByText(denial,{exact:true}).waitFor();await certificateModalReflow(d);await d.getByRole("button",{name:"Go back",exact:true}).click();}
     else await page.getByRole("dialog",{name:label,exact:true}).waitFor({state:"hidden"});
    },async()=>assertCertificateStep(before,await read(),"unchanged",fixture.actors[name].id),reason);
    const after=await read();assertCertificateStep(before,after,operation,fixture.actors[name].id,target);
    if(operation!=="reissue"&&!denial){const c=after.certificates.find(c=>c.id===target);if(c)await page.locator(".status-badge").filter({hasText:new RegExp(`^${c.status.replaceAll("_"," ")}$`)}).waitFor();}
    await health(page);return after;
   };
   const prep=await login("preparer");await workspace(prep);
   await prep.getByLabel("Student",{exact:true}).selectOption(fixture.studentId);await prep.getByLabel("Certificate academic year").fill("2027-28");await prep.getByRole("button",{name:"Check readiness",exact:true}).click();await prep.getByText("Evidence needs correction before issue.",{exact:true}).waitFor();assert(await prep.getByRole("button",{name:"Create recognition request",exact:true}).isDisabled());await health(prep);
   assertCertificateStep(initial,await read(),"unchanged",fixture.actors.preparer.id);
   await prep.getByLabel("Certificate academic year").fill(fixture.academicYear);await prep.getByRole("button",{name:"Check readiness",exact:true}).click();await prep.getByText("School-completion evidence is ready for review.",{exact:true}).waitFor();await prep.getByText("Board-pass wording: unavailable; no claim will be printed.",{exact:true}).waitFor();
   let state=await change("request","preparer",()=>certificateUiResponse(prep,"/api/certificates/requests",()=>prep.getByRole("button",{name:"Create recognition request",exact:true}).click(),201));const request=state.requests[0],rp=`/api/certificates/requests/${request.id}`;
   await requestPage("preparer",request.id);await modalAction("preparer","Start Certificate Review",rp+"/workflow","review",request.id);
   await requestPage("preparer",request.id);await modalAction("preparer","Approve Certificate Request",rp+"/workflow","unchanged",request.id,undefined,"A different authorized reviewer must approve the request.");
   const reviewer=await requestPage("reviewer",request.id);
   // A second real tab retains the pre-approval version. The first tab consumes
   // it legitimately; the stale confirmation must refuse without a second event.
   const stale=watch(await reviewer.context().newPage());await workspace(stale,request.id);await stale.getByRole("button",{name:"Approve Certificate Request",exact:true}).click();
   await modalAction("reviewer","Approve Certificate Request",rp+"/workflow","requestApprove",request.id);
   const approved=await read();await certificateUiResponse(stale,rp+"/workflow",()=>stale.getByRole("dialog",{name:"Approve Certificate Request",exact:true}).getByRole("button",{name:"Approve Certificate Request",exact:true}).click(),409,"Request cannot approve from APPROVED.");
   await stale.getByRole("dialog").waitFor({state:"hidden"});assert.equal(await stale.getByRole("button",{name:"Approve Certificate Request",exact:true}).count(),0);assertCertificateStep(approved,await read(),"unchanged",fixture.actors.reviewer.id);await stale.close();
   const fp=await requestPage("financePreparer",request.id);await change("prepareCharge","financePreparer",()=>certificateUiResponse(fp,rp+"/charge",()=>fp.getByRole("button",{name:"Prepare configured charge",exact:true}).click()),request.id);
   await change("unchanged","financePreparer",()=>certificateUiResponse(fp,rp+"/charge",()=>fp.getByRole("button",{name:"Approve charge or explicit waiver",exact:true}).click(),403,"A different authorized finance approver must approve the charge."),request.id);
   const finance=await requestPage("financeApprover",request.id);await finance.getByRole("button",{name:"Inspect charge",exact:true}).click();await finance.getByRole("button",{name:"Approve charge or explicit waiver",exact:true}).waitFor();
   await change("approveCharge","financeApprover",()=>certificateUiResponse(finance,rp+"/charge",()=>finance.getByRole("button",{name:"Approve charge or explicit waiver",exact:true}).click()),request.id);
   await finance.getByLabel("Receipt date",{exact:true}).fill(new Date().toISOString().slice(0,10));await finance.getByLabel("Payment method",{exact:true}).selectOption("CASH");await finance.getByLabel("Received account",{exact:true}).selectOption("CASH_COUNTER");
   const retryCollection=watch(await finance.context().newPage());await workspace(retryCollection,request.id);await retryCollection.getByRole("button",{name:"Inspect charge",exact:true}).click();await retryCollection.getByLabel("Receipt date",{exact:true}).fill(new Date().toISOString().slice(0,10));
   await change("collect","financeApprover",()=>certificateUiResponse(finance,rp+"/charge",()=>finance.getByRole("button",{name:"Collect approved amount once",exact:true}).click()),request.id);
   await change("unchanged","financeApprover",()=>certificateUiResponse(retryCollection,rp+"/charge",()=>retryCollection.getByRole("button",{name:"Collect approved amount once",exact:true}).click()),request.id);await health(retryCollection);await retryCollection.close();
   await finance.getByText("Charge: PAID · INR 125 · receipt linked",{exact:true}).waitFor();const paid=await read();await finance.reload();assertCertificateStep(paid,await read(),"unchanged",fixture.actors.financeApprover.id);
   await requestPage("preparer",request.id);await prep.getByLabel("Approved template",{exact:true}).selectOption(fixture.templateId);await prep.getByLabel("Reviewed issue date",{exact:true}).fill(new Date().toISOString().slice(0,10));await prep.getByLabel("Issue place",{exact:true}).fill("SYNTHETIC SCHOOL");
   state=await change("draft","preparer",()=>certificateUiResponse(prep,"/api/certificates",()=>prep.getByRole("button",{name:"Prepare draft",exact:true}).click(),201));const original=state.certificates[0];assert.equal(original.templateId,fixture.templateId);
   const row=(page:any,id:string)=>page.getByRole("row").filter({has:page.locator(`a[href="/certificates/${id}"]`)});
   const download=async(page:any,control:any,mode:"DRAFT"|"ISSUED",id:string)=>{
    const before=await read(),waiting=page.waitForEvent("download");const [d]=await Promise.all([waiting,control.click()]);let bytes:Buffer;
    try{bytes=await downloadBytes(d);const a=before.artifacts.find(a=>a.certificateId===id);if(mode==="ISSUED"){assert(a);assertDocumentIdentity(bytes,a);}await inspectCertificateDocument(bytes,mode,a?.fontHash,{studentName:fixture.studentName,academicYear:fixture.academicYear});assertCertificateStep(before,await read(),"unchanged",fixture.actors.preparer.id);return bytes;}
    finally{await d.delete();}
   };
   await workspace(prep);await download(prep,row(prep,original.id).getByRole("button",{name:"Preview DRAFT PDF",exact:true}),"DRAFT",original.id);
   const certificatePage=async(name:CertificateActor,id:string)=>{const page=pages[name]??await login(name);await page.goto(input.origin+`/certificates/${id}`);await page.getByRole("heading",{name:"Certificate Workflow",exact:true}).waitFor();return page;};
   const issueJourney=async(id:string)=>{
    await certificatePage("preparer",id);await modalAction("preparer","Submit Certificate for Approval",`/api/certificates/${id}/workflow`,"submit",id);
    await certificatePage("preparer",id);await modalAction("preparer","Approve Certificate",`/api/certificates/${id}/workflow`,"unchanged",id,undefined,"A different authorized reviewer must approve this certificate.");
    await certificatePage("reviewer",id);await modalAction("reviewer","Approve Certificate",`/api/certificates/${id}/workflow`,"approve",id);
    await certificatePage("reviewer",id);const retryIssue=watch(await pages.reviewer.context().newPage());await retryIssue.goto(input.origin+`/certificates/${id}`);await retryIssue.getByRole("button",{name:"Issue Certificate",exact:true}).click();
    await modalAction("reviewer","Issue Certificate",`/api/certificates/${id}/workflow`,"issue",id);
    const issuedState=await read();await certificateUiResponse(retryIssue,`/api/certificates/${id}/workflow`,()=>retryIssue.getByRole("dialog",{name:"Issue Certificate",exact:true}).getByRole("button",{name:"Issue Certificate",exact:true}).click());assertCertificateStep(issuedState,await read(),"unchanged",fixture.actors.reviewer.id);await retryIssue.getByRole("dialog").waitFor({state:"hidden"});assert.equal(await retryIssue.getByRole("button",{name:"Issue Certificate",exact:true}).count(),0);await health(retryIssue);await retryIssue.close();
   };
   await issueJourney(original.id);await workspace(prep);const issued=await download(prep,row(prep,original.id).getByRole("link",{name:"Reprint saved PDF",exact:true}),"ISSUED",original.id);
   const qr=await decodeCertificateQr(issued,()=>{input.bind();});assert.equal(createHash("sha256").update(qr).digest("hex"),(await read()).artifacts.find(a=>a.certificateId===original.id).tokenHash);
   const saved=await read();await prep.reload();assertCertificateStep(saved,await read(),"unchanged",fixture.actors.preparer.id);assert.equal(await row(prep,original.id).getByRole("button",{name:"Issue Certificate",exact:true}).count(),0);
   const reprint=await download(prep,row(prep,original.id).getByRole("link",{name:"Reprint saved PDF",exact:true}),"ISSUED",original.id);assert(issued.equals(reprint));
   const parent=await login("parent");await parent.goto(input.origin+`/parent/certificates?student=${fixture.studentId}`);await parent.getByRole("link",{name:"Open Issued Certificate",exact:true}).click();const parentLink=parent.getByRole("link",{name:"Open saved issued PDF",exact:true});await download(parent,parentLink,"ISSUED",original.id);
   const protectedBefore=await read();await probe("unlink-parent");await certificateUiReadDenial(parent,parentLink,`/api/parent/certificates/${original.id}/pdf`,"This Student is not linked to the Parent account.");assertCertificateStep(protectedBefore,await read(),"unchanged",fixture.actors.parent.id);await probe("relink-parent");await parent.goto(input.origin+`/parent/certificates?student=${fixture.studentId}`);await parent.getByRole("link",{name:"Open Issued Certificate",exact:true}).click();await download(parent,parent.getByRole("link",{name:"Open saved issued PDF",exact:true}),"ISSUED",original.id);
   for(const name of ["otherParent","low"] as const){const page=await login(name,[fixture.studentName,fixture.scope]);await page.goto(input.origin+(name==="otherParent"?`/parent/certificates?student=${fixture.studentId}`:`/certificates/${original.id}`));await page.waitForURL("**/unauthorized");await assertNoPrivateFlash(page);await health(page);}
   const anonymous=await createPage([fixture.studentName,fixture.scope]);await anonymous.goto(input.origin+`/certificates/${original.id}`);await anonymous.waitForURL("**/login**");await assertNoPrivateFlash(anonymous);
   assertCertificateStep(protectedBefore,await read(),"unchanged",fixture.actors.parent.id);
   await certificatePage("preparer",original.id);state=await modalAction("preparer","Reissue Certificate",`/api/certificates/${original.id}/workflow`,"reissue",original.id,"SYNTHETIC governed replacement");const successor=state.certificates.find(c=>c.supersedesCertificateId===original.id);assert(successor);await issueJourney(successor.id);
   await workspace(prep);await download(prep,row(prep,successor.id).getByRole("link",{name:"Reprint saved PDF",exact:true}),"ISSUED",successor.id);
   await certificatePage("reviewer",original.id);await modalAction("reviewer","Cancel Issued Certificate",`/api/certificates/${original.id}/workflow`,"void",original.id,"SYNTHETIC void; original history retained");
   await workspace(prep);await row(prep,original.id).getByText("VOID — history retained",{exact:true}).waitFor();await prep.locator(`a[href="/certificates/${original.id}"]`).click();await prep.getByRole("link",{name:"A4 Print Preview",exact:true}).click();await prep.getByText("VOID - history retained. This certificate is no longer valid.",{exact:true}).waitFor();
   const final=await read();assert.deepEqual(final.artifacts.filter(a=>a.certificateId===original.id),saved.artifacts.filter(a=>a.certificateId===original.id));assert.deepEqual(final.versions.filter(v=>v.certificateId===original.id),saved.versions.filter(v=>v.certificateId===original.id));assert.deepEqual(final.receipts,saved.receipts);assert.equal(final.certificates.length,2);
   for(const p of Object.values(pages))await health(p);assert(errors.every(e=>e.kind==="CONSOLE_ERROR"&&isExpectedDenialConsole(e.page,e.url??"",e.text??"")),"CERTIFICATE_BROWSER_UNEXPECTED_CONSOLE");input.bind();
  },browser);
  results.push({viewport:matrix.viewport,theme:matrix.colorScheme,reducedMotion,scenarios:CERTIFICATE_BROWSER_SCENARIOS,classification:"RENDERED_AUTHENTICATED_TEST_IMAGE",state:"PASSED",trueBrowserZoom:"NOT_EXECUTED",publicPrivateArtifacts:false});
 }
 return results;
}
export async function assertNoPrivateFlash(page:any){assert(await page.evaluate(()=>sessionStorage.getItem("certificate-private-flash")!=="true"),"CERTIFICATE_PRIVATE_FLASH");}
export async function certificateUiReadDenial(page:any,control:any,path:string,error:string){
 const wait=page.waitForResponse((r:any)=>new URL(r.url()).origin==="https://portable-staging.localhost:8443"&&new URL(r.url()).pathname===path&&r.request().method()==="GET");
 const [response]=await Promise.all([wait,control.click()]);recordExpectedDenial(page,response);await assertDenial(new Response(await response.body(),{status:response.status(),headers:response.headers()}),403,{error});
}

const expectedDenials=new WeakMap<object,Set<string>>();
function recordExpectedDenial(page:object,response:any){const set=expectedDenials.get(page)??new Set<string>();set.add(`${response.url()}|${response.status()}`);expectedDenials.set(page,set);}
export function isExpectedDenialConsole(page:object,url:string,text:string){
 const match=/^Failed to load resource: the server responded with a status of (403|409) \(.*\)$/.exec(text);
 return !!match&&!!expectedDenials.get(page)?.has(`${url}|${match[1]}`);
}
