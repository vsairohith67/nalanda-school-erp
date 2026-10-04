// REAL_COMPONENT, SOURCE_ONLY: actual LockScreen/React/CSS with labelled callback
// double. No Tauri, Stronghold, native target, backend, picker or page-zoom claim.
import { build } from "esbuild";
import { chromium } from "playwright";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const root=process.cwd(),out=mkdtempSync(path.join(tmpdir(),"nalanda-native-component-1b-"));
const entry=path.join(out,"entry.tsx");
writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {LockScreen} from ${JSON.stringify(path.join(root,'apps/nalanda-cross-platform/src/App').replaceAll('\\','/'))};import ${JSON.stringify(path.join(root,'apps/nalanda-cross-platform/src/styles.css').replaceAll('\\','/'))};
createRoot(document.getElementById('root')).render(<LockScreen profile={{name:'NO_REMOTE_SERVER_CONFIGURED',origin:null,remoteConfigured:false,minimumServerVersion:'0.1.0',appVersion:'0.1.0'}} onUnlock={async()=>{throw Error('APP_UNLOCK_FAILED:4')}}/>);`);
await build({entryPoints:[entry],nodePaths:[path.join(root,"node_modules")],bundle:true,outfile:path.join(out,"app.js"),format:"esm",jsx:"automatic",define:{"process.env.NODE_ENV":'"development"'}});
let browser;
const server=createServer((req,res)=>{
  const u=new URL(req.url,"http://127.0.0.1");
  if(req.method!=="GET"){res.writeHead(405).end();return;}
  const files={"/app.js":[path.join(out,"app.js"),"application/javascript"],"/app.css":[path.join(out,"app.css"),"text/css"],"/nalanda-logo-transparent.png":[path.join(root,"public/nalanda-logo-transparent.png"),"image/png"]};
  if(u.pathname==="/"){res.setHeader("content-type","text/html");res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Native lock component synthetic QA</title><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');return;}
  if(!files[u.pathname]){res.writeHead(404).end();return;}
  res.setHeader("content-type",files[u.pathname][1]);res.end(readFileSync(files[u.pathname][0]));
});
try {
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  browser=await chromium.launch({headless:true});const page=await browser.newPage();const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const url=`http://127.0.0.1:${server.address().port}`;
  await page.goto(url);assert.equal(await page.title(),"Native lock component synthetic QA");assert.equal(page.url(),url+"/");
  await page.getByRole("heading",{name:"Welcome back"}).waitFor();
  assert.equal(await page.getByRole("img",{name:"Nalanda Public School emblem"}).evaluate(e=>e.complete&&e.naturalWidth>0),true);
  await page.getByRole("status").filter({hasText:"App 0.1.0"}).waitFor();
  assert((await page.locator("body").innerText()).includes("No remote server configured"));
  assert.equal(await page.getByRole("button",{name:"Unlock app"}).isDisabled(),true);
  const pin=page.getByLabel("App PIN",{exact:true});await pin.fill("12x34567");assert.equal(await pin.inputValue(),"1234567");
  assert.equal(await page.getByRole("button",{name:"Unlock app"}).isDisabled(),true);
  assert.equal(await pin.getAttribute("aria-describedby"),"app-pin-help");
  await pin.fill("31415926");await page.getByRole("button",{name:"Unlock app"}).click();
  await page.getByRole("alert").filter({hasText:"App PIN was not accepted"}).waitFor();
  assert.equal(await pin.evaluate(e=>e===document.activeElement),true);
  assert.equal(await pin.getAttribute("aria-invalid"),"true");
  assert.equal(await pin.getAttribute("aria-describedby"),"app-pin-help app-pin-error");
  for(const viewport of [{width:390,height:844},{width:844,height:390}]){
    await page.setViewportSize(viewport);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const error=await page.getByRole("alert").boundingBox();assert(error&&error.width>0&&error.x>=0&&error.x+error.width<=viewport.width);
  }
  assert.equal(errors.length,0);assert.equal(await page.locator("vite-error-overlay").count(),0);
  await page.screenshot({path:path.join(out,"lock-error.png"),fullPage:true});
  const result={status:"PASS",classification:"REAL_COMPONENT_SOURCE_ONLY",browser:await browser.version(),checks:["identity","meaningful-content","loaded-profile-version","short-pin-refusal","digit-filter","error-announcement-description","error-focus","portrait-landscape-component-reflow","console","no-overlay"],native:false,backend:false,osLifecycle:false,genuineZoom:false,output:out};
  writeFileSync(path.join(out,"result.json"),JSON.stringify(result));console.log(JSON.stringify(result));
} finally {await browser?.close();await new Promise((r,j)=>server.close(e=>e?j(e):r()));}
