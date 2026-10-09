import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {BROWSER_MATRIX} from "./integrated-acceptance";
import {STUDENT_IMPORT_FIELDS} from "../../lib/student-import-contract";
import {parseCsv} from "../../lib/marks-import-csv";

export function assertProjectedUpload(raw:string){
 const body=JSON.parse(raw);assert(Array.isArray(body.rows)&&body.rows.length>0);
 assert(!raw.includes("FORBIDDEN_BROWSER_SENTINEL"));
 for(const row of body.rows)for(const field of Object.keys(row))assert((STUDENT_IMPORT_FIELDS as readonly string[]).includes(field),"UNAPPROVED_UPLOAD_FIELD");
 return body.action;
}
export async function downloadBytes(download:any){
 const stream=await download.createReadStream();assert(stream);const chunks:Buffer[]=[];let count=0;
 for await(const chunk of stream){count+=chunk.length;assert(count<=16*1024*1024);chunks.push(Buffer.from(chunk));}
 assert.equal(await download.failure(),null);return Buffer.concat(chunks);
}
/** Receives a real Playwright Browser from the admitted host entrypoint. No
 * routes are fulfilled/mocked and no success cookies are installed. */
export async function integratedBrowser(browser:any,input:{origin:string;password:string;totp:()=>Promise<string>;snapshot:(admission:string)=>Promise<any>;bind:()=>unknown}){
 assert.equal(input.origin,"https://portable-staging.localhost:8443");const results=[];
 for(const matrix of BROWSER_MATRIX){
  input.bind();const context=await browser.newContext({viewport:matrix.viewport,colorScheme:matrix.colorScheme,reducedMotion:"reduce",acceptDownloads:true,ignoreHTTPSErrors:false,serviceWorkers:"block"});
  const errors:string[]=[],uploads:string[]=[];
  try{
   await context.addInitScript(()=>{
    if(sessionStorage.getItem("qa-private-observation-complete"))return;
    const check=()=>{if(Array.from(document.querySelectorAll("h3")).some(e=>e.textContent?.includes("Student Master Import"))||document.body?.innerText.includes("SYNTHETIC Browser Student"))sessionStorage.setItem("qa-private-flash","true");};
    const observer=new MutationObserver(check);observer.observe(document,{childList:true,subtree:true,characterData:true});check();
    (window as any).__stopPrivateObservation=()=>{check();observer.disconnect();sessionStorage.setItem("qa-private-observation-complete","true");return sessionStorage.getItem("qa-private-flash")!=="true";};
   });
   const page=await context.newPage();page.on("pageerror",()=>errors.push("PAGE_ERROR"));page.on("console",(m:any)=>{if(m.type()==="error")errors.push("CONSOLE_ERROR");});
   page.on("request",(r:any)=>{if(new URL(r.url()).pathname==="/api/import/students"&&r.method()==="POST"){try{uploads.push(assertProjectedUpload(r.postData()??""));}catch{errors.push("PRIVATE_UPLOAD_BOUNDARY");}}});
   await page.goto(input.origin+"/import-export");await page.waitForURL("**/login**");
   assert.equal(await page.getByRole("heading",{name:"Student Master Import — reviewed source mapping"}).count(),0,"PRIVATE_DATA_FLASH");
   assert(await page.evaluate(()=>(window as any).__stopPrivateObservation()),"PRIVATE_DATA_FLASH_DURING_UNAUTHENTICATED_NAVIGATION");
   await page.getByLabel("Username or verified login identifier").fill("director");await page.locator('input[name="password"]').fill(input.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();
   await page.getByLabel("Six-digit authenticator code").waitFor();await page.getByLabel("Six-digit authenticator code").fill(await input.totp());await page.getByRole("button",{name:"Verify and sign in",exact:true}).click();await page.waitForURL((u:URL)=>u.pathname!=="/login");
   await page.goto(input.origin+"/import-export");
   const panel=page.locator("section").filter({has:page.getByRole("heading",{name:"Student Master Import — reviewed source mapping"})});
   await panel.getByLabel("Academic year",{exact:true}).selectOption("2026-27");
   const admission=`SYNTHETIC-BROWSER-${randomUUID()}`;assert.equal((await input.snapshot(admission)).count,0);
   const csv=Buffer.from(`admissionNo,studentName,className,section,PrivateBalance\r\n${admission},SYNTHETIC Browser Student,I,A,FORBIDDEN_BROWSER_SENTINEL\r\n`);
   const file=panel.getByLabel("Source CSV / XLSX");await file.setInputFiles({name:"synthetic.csv",mimeType:"text/csv",buffer:csv});
   await panel.getByLabel("PrivateBalance",{exact:true}).waitFor();assert.equal(await panel.getByLabel("PrivateBalance",{exact:true}).inputValue(),"");
   await panel.getByRole("button",{name:"Validate approved fields locally",exact:true}).click();assert.equal(uploads.length,0);
   await panel.getByRole("button",{name:"Server validation / preview",exact:true}).click();await panel.getByText("Server preview complete; no batch or Student write.",{exact:true}).waitFor();
   assert.equal((await input.snapshot(admission)).count,0);assert(uploads.includes("preview"));
   await panel.getByLabel("I reviewed this context, mapping, mode, errors and warnings.",{exact:true}).check();
   await panel.getByLabel("Import mode").selectOption("create-only");assert.equal(await panel.getByRole("button",{name:"Confirm Student import",exact:true}).count(),0,"STALE_PREVIEW_SURVIVED");
   await panel.getByRole("button",{name:"Validate approved fields locally",exact:true}).click();await panel.getByRole("button",{name:"Server validation / preview",exact:true}).click();await panel.getByText("Server preview complete; no batch or Student write.",{exact:true}).waitFor();
   await panel.getByLabel("I reviewed this context, mapping, mode, errors and warnings.",{exact:true}).check();await panel.getByRole("button",{name:"Confirm Student import",exact:true}).click();await panel.getByRole("link",{name:"Open authoritative batch reconciliation"}).waitFor();
   assert.deepEqual(await input.snapshot(admission),{count:1,academicYear:"2026-27",className:"I",section:"A",nameMatches:true});
   const downloadPromise=page.waitForEvent("download");await page.getByRole("link",{name:"Student Master CSV — all master records",exact:true}).click();const rows=parseCsv((await downloadBytes(await downloadPromise)).toString("utf8"));assert.equal(rows.filter(r=>r.includes(admission)).length,1);
   await panel.getByRole("button",{name:"Cancel / clear review",exact:true}).click();assert.equal(await file.inputValue(),"");assert.equal(await panel.getByRole("button",{name:"Confirm Student import",exact:true}).count(),0);
   // Cancellation is a genuine empty file selection, with no upload.
   const prior=uploads.length;await file.setInputFiles([]);assert.equal(uploads.length,prior);
   // Keep actual locally parsed errors visible at the narrow viewport. Neither
   // server responses nor component error text are replaced by the driver.
   const longHeader="SYNTHETIC_UNMAPPED_COLUMN_".repeat(12);
   await file.setInputFiles({name:"synthetic-errors.csv",mimeType:"text/csv",buffer:Buffer.from(`admissionNo,studentName,className,section,${longHeader}\r\nSYNTHETIC-ERROR,,I,A,excluded\r\n`)});
   await panel.getByLabel(longHeader,{exact:true}).waitFor();await panel.getByRole("button",{name:"Validate approved fields locally",exact:true}).click();
   await panel.getByText("1 rows need review.",{exact:true}).waitFor();await panel.locator("details").filter({has:page.locator("summary",{hasText:/issue\(s\)/})}).locator("summary").click();
   assert(await panel.getByText("Missing studentName",{exact:true}).isVisible());assert.equal(uploads.length,prior);
   assert.equal(await panel.getByRole("button",{name:"Confirm Student import",exact:true}).count(),0);
   if(matrix.viewport.width===320)assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"VISIBLE_IMPORT_ERROR_REFLOW_OVERFLOW");
   await panel.getByRole("button",{name:"Cancel / clear review",exact:true}).click();
   await page.keyboard.press("Tab");assert(await page.evaluate(()=>document.activeElement!==document.body));
   await page.evaluate(()=>{document.documentElement.style.zoom="2";});
   assert(await page.evaluate(()=>matchMedia("(prefers-reduced-motion: reduce)").matches));
   assert.equal(await page.locator("nextjs-portal").count(),0);
   if(matrix.viewport.width===320)assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"IMPORT_REFLOW_OVERFLOW");
   assert.deepEqual(errors,[]);input.bind();results.push({viewport:matrix.viewport,theme:matrix.colorScheme,state:"PASSED",classification:"RENDERED_AUTHENTICATED_TEST_IMAGE",uploadProjection:true,authoritativeReadback:true});
  }finally{await context.close();}
 }
 return results;
}
