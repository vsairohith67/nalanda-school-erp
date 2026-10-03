/** Synthetic component QA only. Imports the actual workspace/CSS; never forwards to ERP.
 * Run after IR_EVIDENCE_CAPTURE_DIR service tests, using already installed tooling.
 */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import path from "node:path";
import {createServer} from "node:http";
import {build} from "esbuild";
import {chromium} from "playwright";
const root=path.resolve("tmp/attendance-evidence-1b"),fixtures=JSON.parse(readFileSync(path.join(root,"service-fixtures.json"),"utf8"));
assert.match(fixtures.label,/SYNTHETIC actual migrated SQLite/);
mkdirSync(root,{recursive:true});
await build({stdin:{contents:'import React from "react";import{createRoot}from"react-dom/client";import{Workspace}from"./components/intelligent-reports/workspace";createRoot(document.getElementById("root")).render(<Workspace initialAccess={{families:["ATTENDANCE","ACADEMIC"],years:["2026-27","2023-24"],context:"synthetic-context"}}/>);',resolveDir:process.cwd(),loader:"tsx"},alias:{react:path.resolve("node_modules/react"),"react-dom":path.resolve("node_modules/react-dom")},bundle:true,platform:"browser",format:"iife",jsx:"automatic",outfile:path.join(root,"workspace.js"),define:{"process.env.NODE_ENV":'"production"'}});
let mode="normal",accessDenied=false,sourceRequests=0;
const receipts=[],consoleMessages=[],failures=[];
const apiHeaders={"content-type":"application/json","cache-control":"private, no-store, max-age=0","x-robots-tag":"noindex, nofollow, noarchive"};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,"http://127.0.0.1");
    if(req.method==="GET"&&url.pathname==="/"){res.writeHead(200,{"content-type":"text/html","cache-control":"no-store"});res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Ask Nalanda — synthetic component QA</title><link rel="stylesheet" href="/workspace.css"><style>html{font:16px Georgia,serif;color:#152b43;background:#f5f7fa}body{margin:0;padding:20px}*{box-sizing:border-box}body>header{font-family:Georgia,serif;font-weight:bold;margin-bottom:20px}.dark{color:#ecf1f7;background:#0f1727}@media(max-width:600px){body{padding:10px}}</style></head><body><header>NALANDA PUBLIC SCHOOL<small style="display:block;font:14px sans-serif">Synthetic component QA — invented service fixture</small></header><main id="root"></main><script src="/workspace.js"></script></body></html>');return;}
    if(req.method==="GET"&&["/workspace.js","/workspace.css"].includes(url.pathname)){res.writeHead(200,{"content-type":url.pathname.endsWith("js")?"text/javascript":"text/css","cache-control":"no-store"});res.end(readFileSync(path.join(root,url.pathname.slice(1))));return;}
    if(url.pathname==="/favicon.ico"){res.writeHead(204);res.end();return;}
    if(url.pathname==="/api/intelligent-reports/access"&&req.method==="GET"){res.writeHead(accessDenied?403:200,apiHeaders);res.end(JSON.stringify(accessDenied?{code:"ACCESS_DENIED",error:"Synthetic access revoked"}:{families:["ATTENDANCE","ACADEMIC"],years:["2026-27","2023-24"],context:"synthetic-context"}));return;}
    if(req.method!=="POST"||!new Set(["/api/intelligent-reports/options","/api/intelligent-reports/run","/api/intelligent-reports/source"]).has(url.pathname)){res.writeHead(404,apiHeaders);res.end(JSON.stringify({error:"Unknown synthetic route refused"}));return;}
    let raw="";for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000){res.writeHead(413,apiHeaders);res.end('{}');return;}}
    const body=JSON.parse(raw),action=url.pathname.split('/').at(-1),query=body.query,year=body.academicYear??query?.academicYear;
    const report=year==="2023-24"?fixtures.report:fixtures.current;
    if(action==="options"){res.writeHead(200,apiHeaders);res.end(JSON.stringify({targets:[{id:report.query.targets[0].id,className:"7",section:"A",exams:[]}]}));return;}
    if(action==="run"){assert.equal(query.academicYear,report.query.academicYear);assert.deepEqual(query.targets,report.query.targets);res.writeHead(200,apiHeaders);res.end(JSON.stringify({...report,query}));return;}
    sourceRequests++;const selectedMode=mode;
    if(selectedMode==="slow"||selectedMode==="stale"&&body.key===fixtures.complete.row.key)await new Promise(r=>setTimeout(r,600));
    if(selectedMode==="changed"||selectedMode==="denied"||selectedMode==="failed"){res.writeHead(selectedMode==="changed"?409:selectedMode==="denied"?403:500,apiHeaders);res.end(JSON.stringify({code:selectedMode==="changed"?"SOURCE_CHANGED":selectedMode==="denied"?"ACCESS_DENIED":"REQUEST_FAILED",error:selectedMode==="failed"?'Synthetic failure <script>window.bad=1</script> '+"長い説明確認".repeat(70):"Synthetic source " + selectedMode}));return;}
    const sources=year==="2023-24"?[fixtures.complete,fixtures.missing,fixtures.zero,fixtures.interval]:[fixtures.currentDetail];
    const detail=sources.find(d=>d.row.key===body.key);
    if(!detail||body.expectedRevision!==report.sourceRevision){res.writeHead(404,apiHeaders);res.end(JSON.stringify({code:"SOURCE_UNAVAILABLE",error:"Synthetic source unavailable"}));return;}
    if(selectedMode==="malformed"){res.writeHead(200,apiHeaders);res.end('{');return;}
    res.writeHead(200,apiHeaders);res.end(JSON.stringify(selectedMode==="empty"?fixtures.empty:detail));
  }catch{if(!res.headersSent)res.writeHead(400,apiHeaders);res.end(JSON.stringify({error:"Invalid synthetic request"}));}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext();
  await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();page.on("pageerror",error=>failures.push(error.message));page.on("console",message=>{if(["warning","error"].includes(message.type()))consoleMessages.push(message.text());});
  const run=async(year="2023-24")=>{
    mode="normal";accessDenied=false;await page.goto(origin);await page.getByRole("heading",{name:"Ask Nalanda",exact:true}).waitFor();assert.equal(await page.title(),"Ask Nalanda — synthetic component QA");assert.equal(new URL(page.url()).origin,origin);
    await page.getByRole("combobox",{name:/Academic year/}).selectOption(year);await page.getByRole("checkbox",{name:"7A",exact:true}).check();const q=year==="2023-24"?fixtures.report.query:fixtures.current.query;
    await page.getByLabel("From",{exact:true}).fill(q.from);await page.getByLabel("To",{exact:true}).fill(q.to);await page.getByRole("combobox",{name:/Comparison/}).selectOption(q.comparator);await page.getByLabel("Percentage threshold").fill(String(q.threshold));await page.getByRole("button",{name:"Review structured filters",exact:true}).click();await page.getByRole("button",{name:"Run report",exact:true}).click();await page.getByRole("heading",{name:"Report results",exact:true}).waitFor();
    assert(await page.getByRole("heading",{name:"Report results",exact:true}).evaluate(el=>el===document.activeElement));
  };
  const row=n=>page.getByRole("row").filter({has:page.getByText(`SYN-${n}`,{exact:true})}).getByRole("button",{name:"Details",exact:true});
  const dialog=page.getByRole("dialog"),close=()=>page.getByRole("button",{name:"Close source details",exact:true}).click();
  const check=async(label)=>{assert.equal(await page.locator('nextjs-portal,vite-error-overlay').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(failures.length,0);receipts.push(label);};
  for(const viewport of [{width:1366,height:768},{width:390,height:844}])for(const theme of ["light","dark"]){
    await page.setViewportSize(viewport);await run();await page.evaluate(theme=>document.documentElement.className=theme,theme);await check(`identity/results ${viewport.width} ${theme}`);
    if(viewport.width===1366&&theme==="light")await page.screenshot({path:path.join(root,"before-desktop.png")});
    await row(0).click();await dialog.getByText("90% authoritative attendance",{exact:false}).waitFor();assert(await dialog.getByRole("button",{name:"Close source details"}).evaluate(el=>el===document.activeElement));assert.equal(await dialog.getByRole("link").count(),0);
    await page.keyboard.press("Shift+Tab");assert(await dialog.evaluate(el=>el.contains(document.activeElement)));await page.keyboard.press("Tab");assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
    await check(`complete/focus containment ${viewport.width} ${theme}`);await page.screenshot({path:path.join(root,`after-${viewport.width}-${theme}.png`)});
    await dialog.getByText("2024-02-01",{exact:true}).scrollIntoViewIfNeeded();if(viewport.width===390)await page.screenshot({path:path.join(root,`table-390-${theme}.png`)});
    await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);assert(await row(0).evaluate(el=>el===document.activeElement));
    await row(1).click();await dialog.getByText("Incomplete",{exact:true}).waitFor();const beforeFilter=sourceRequests;await dialog.getByLabel("Dates shown").selectOption("ATTENTION");assert.equal(sourceRequests,beforeFilter);assert(await dialog.getByText("Whole-period numerator 17; denominator 20",{exact:false}).isVisible());await dialog.getByText("Showing 1 of 20 dates.",{exact:false}).waitFor();assert(await dialog.getByText("2024-02-18",{exact:true}).isVisible());await close();
  }
  await run("2026-27");await row(0).click();await dialog.getByText("Academic year 2026-27",{exact:true}).waitFor();assert.equal(await dialog.getByRole("link").count(),0);await close();receipts.push("current/historical scopes");
  await run();mode="slow";await row(0).click();await dialog.getByText("Loading authorised source details…",{exact:true}).waitFor();await close();await page.waitForTimeout(700);assert.equal(await dialog.count(),0);mode="normal";await row(0).click();await dialog.getByText("Complete",{exact:true}).waitFor();await close();receipts.push("cancel and reopen");
  // Adversarial browser boundary: ignore AbortSignal so old response actually arrives.
  await page.evaluate(()=>{const original=window.fetch;window.fetch=(url,options)=>original(url,typeof url==="string"&&url.endsWith("/source")?{...options,signal:undefined}:options);});
  mode="stale";await row(0).click();await dialog.getByText("Loading authorised source details…",{exact:true}).waitFor();await close();await row(1).click();await dialog.getByText("Incomplete",{exact:true}).waitFor();await page.waitForTimeout(700);assert(await dialog.getByText("SYNTHETIC Student 1 · SYN-1",{exact:true}).isVisible());assert.equal(await dialog.getByText("90% authoritative attendance",{exact:false}).count(),0);await close();receipts.push("late A response never renders under B");
  for(const state of ["changed","denied","failed","malformed"]){await run();mode=state;await page.setViewportSize({width:320,height:780});await row(0).click();await dialog.getByRole("alert").waitFor();await check(`error ${state} 320px`);assert.equal(await page.evaluate(()=>window.bad),undefined);if(state==="failed")await page.screenshot({path:path.join(root,"error-320.png")});await page.keyboard.press("Escape");assert.equal(await dialog.count(),0);assert(await page.evaluate(()=>document.activeElement?.tagName!=="BODY"));}
  for(const theme of ["light","dark"]){await run();await page.setViewportSize({width:320,height:780});await page.evaluate(t=>document.documentElement.className=t,theme);await row(1).click();await dialog.getByText("Incomplete",{exact:true}).waitFor();await dialog.getByLabel("Dates shown").selectOption("ATTENTION");await dialog.getByText("2024-02-18",{exact:true}).scrollIntoViewIfNeeded();await check(`attention table 320px ${theme}`);assert(await dialog.locator("table").evaluate(el=>el.getBoundingClientRect().width<=el.parentElement.clientWidth+1));await page.screenshot({path:path.join(root,`table-320-${theme}.png`)});await close();mode="failed";await row(0).click();await dialog.getByRole("alert").waitFor();await check(`long Unicode error 320px ${theme}`);await close();}
  if(fixtures.empty){await run();mode="empty";await row(0).click();await dialog.getByText("No eligible days",{exact:true}).waitFor();await dialog.getByLabel("Dates shown").selectOption("EXCLUDED");await close();receipts.push("zero eligible/excluded dates");}
  await run();await row(0).click();await dialog.getByText("Complete",{exact:true}).waitFor();await close();await page.getByRole("combobox",{name:/Academic year/}).selectOption("2026-27");assert.equal(await page.getByRole("heading",{name:"Report results",exact:true}).count(),0);receipts.push("year change invalidates report/details");
  for(const change of ["date","scope","family","rerun"]){await run();mode="slow";await row(0).click();await dialog.getByText("Loading authorised source details…",{exact:true}).waitFor();await close();if(change==="date")await page.getByLabel("From",{exact:true}).fill("2024-02-02");else if(change==="scope")await page.getByRole("checkbox",{name:"7A",exact:true}).uncheck();else if(change==="family")await page.getByRole("button",{name:"Academic support",exact:true}).click();else {mode="normal";await page.getByRole("button",{name:"Run report",exact:true}).click();await page.getByRole("heading",{name:"Report results",exact:true}).waitFor();}await page.waitForTimeout(700);assert.equal(await dialog.count(),0);if(change!=="rerun")assert.equal(await page.getByRole("heading",{name:"Report results",exact:true}).count(),0);receipts.push(change+" invalidates obsolete detail");}
  await run();await row(0).click();await dialog.getByText("Complete",{exact:true}).waitFor();accessDenied=true;await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));await page.getByText("No reporting domain is available",{exact:false}).waitFor();assert.equal(await dialog.count(),0);receipts.push("access refresh invalidates visible detail");
  const ids=await page.locator('[id]').evaluateAll(elements=>elements.map(e=>e.id));assert.equal(ids.length,new Set(ids).size);
  assert.equal(await page.evaluate(()=>localStorage.length),0);assert.equal(failures.length,0);
  assert(consoleMessages.every(message=>/Failed to load resource.*(403|409|500)/.test(message)),JSON.stringify(consoleMessages));
  writeFileSync(path.join(root,"browser-receipt.json"),JSON.stringify({status:"PASS",origin,label:fixtures.label,browserPlugin:"ABSENT; installed Playwright 1.63.0",receipts,consoleMessages,pageErrors:failures,viewportIsNotZoom:true},null,2));
  console.log(JSON.stringify({status:"PASS",checks:receipts.length,receipt:path.join(root,"browser-receipt.json")}));
}catch(error){console.error(JSON.stringify({pageErrors:failures,consoleMessages}));for(const c of browser.contexts())for(const p of c.pages())console.error((await p.locator("body").innerText()).slice(0,2500));throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));console.log("Owned synthetic listener stopped");}
