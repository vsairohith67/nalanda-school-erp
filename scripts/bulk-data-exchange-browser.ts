import { unzipSync } from "fflate";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { normalizeStudentImportRows } from "../lib/student-import";
async function main() {
const run = process.env.IMPORT_BROWSER_RUN;
if (run !== undefined && !/^[a-z0-9-]+$/.test(run)) throw new Error("Invalid harness run label");
const out = run ? `tmp/${run}` : process.env.IMPORT_BROWSER_A11Y === "1" ? "tmp/mobile-import-a11y-1b" : "tmp/bulk-exchange-browser";
const port = Number(process.env.IMPORT_BROWSER_PORT ?? 47831);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid harness port");
mkdirSync(out, { recursive: !run });
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {StudentImportPanel} from '../../components/student-import-panel';
import {MarksImporter} from '../../components/marks-importer';
import {OnboardingCentre} from '../../components/onboarding-centre';
import {ImportRowErrors} from '../../components/import-row-errors';
function App(){const [dark,setDark]=React.useState(false); const [kind,setKind]=React.useState('student'); React.useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark)},[dark]); return <div className="app-shell" style={{display:"block"}}><main style={{padding:12,minWidth:0}}><h1>Isolated synthetic component QA</h1><p>SYNTHETIC COMPONENT QA — NO ERP CONNECTION / NO SCHOOL DATA IMPORTED.</p><button onClick={()=>setDark(!dark)}>Toggle light/dark</button><label>Harness component<select value={kind} onChange={e=>setKind(e.target.value)}><option value="student">Student</option><option value="marks">Legacy marks</option><option value="onboarding">Onboarding</option><option value="errors">Long errors</option>${process.env.IMPORT_BROWSER_A11Y === "1" ? '<option value="onboarding-review">Onboarding synthetic review</option>' : ""}</select></label><div className={kind.startsWith('onboarding')?'page page-shell onboarding-page':kind==='marks'?'page marks-page':'page'}>{kind==='student'?<StudentImportPanel/>:kind==='marks'?<MarksImporter/>:kind.startsWith('onboarding')?<OnboardingCentre key={kind} initialBatches={kind==='onboarding-review'?[{batchReference:'SYNTHETIC-A11Y',bundleType:'STUDENT_GUARDIAN',status:'APPROVAL_REQUIRED',version:1,workbookHash:'synthetic-only',templateVersion:'1.0',schemaVersion:'IMPORT-1A-2026-08-10',createdAt:'2026-01-01T00:00:00Z',planHash:'synthetic-plan',plan:{sheetRows:{Students:1},createCount:1},issues:[]}]:[]} role="PRINCIPAL" permissions={{upload:true,validate:true,resolve:true,approve:true,execute:true,audit:true,rollback:true}}/>:<ImportRowErrors rows={[{row:2,field:'Student name',messages:['Invented Unicode విద్యార్థి हिन्दी العربية '.repeat(30)]}]}/>}</div></main></div>}; createRoot(document.getElementById('root')).render(<App/>);`;
writeFileSync(`${out}/entry.tsx`, entry);
await build({ entryPoints: [`${out}/entry.tsx`], bundle: true, outfile: `${out}/app.js`, format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "worker-url", setup(b) { b.onLoad({ filter: /(?:student-import-panel|marks-importer|onboarding-centre)\.tsx$/ }, async a => ({ contents: readFileSync(a.path, "utf8").replaceAll('new URL("../lib/student-source.worker.ts", import.meta.url)', 'new URL("/worker.js", window.location.href)').replaceAll('new URL("../lib/onboarding-upload.worker.ts", import.meta.url)', 'new URL("/onboarding-worker.js", window.location.href)'), loader: "tsx" })); } }] });
await build({ entryPoints: ["lib/student-source.worker.ts"], bundle: true, outfile: `${out}/worker.js`, format: "iife" });
await build({ entryPoints: ["lib/onboarding-upload.worker.ts"], bundle: true, outfile: `${out}/onboarding-worker.js`, format: "iife" });
writeFileSync(`${out}/student-sentinel.csv`, 'Admision No,Full Name,Class Name,Section,PrivateBalance\r\n00001,INVENTED విద్యార్థి,I,A,FORBIDDEN_SYNTHETIC_SENTINEL_1A\r\n');
writeFileSync(`${out}/marks.csv`, 'examCode,className,section,subjectName,componentName,admissionNumber,marksObtained,entryStatus,remarks\r\nSYNTH-EXAM,I,A,Math,Theory,00001,0,PRESENT,\r\n');
const captures: unknown[] = [];
function capture(value: unknown) { if (captures.length === 100) captures.shift(); captures.push(value); writeFileSync(`${out}/network-capture.json`, JSON.stringify(captures, null, 2)); }
const choice = {id:'synthetic-assessment',academicYear:'2026-27',className:'I',section:'A',subjectName:'Math',componentName:'Theory',maxMarks:'10',examCycle:{examCode:'SYNTH-EXAM'}};
const server = createServer(async(req,res)=>{
  try {
  res.setHeader('cache-control','no-store');
  res.setHeader('Content-Security-Policy', "default-src 'self'; connect-src 'self'; script-src 'self'; worker-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'none'");
  const url = new URL(req.url!, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    const allowed = (req.method === 'GET' && ['/api/import/students','/api/marks/import'].includes(url.pathname) && !url.search) || (req.method === 'GET' && url.pathname === '/api/onboarding/batches' && url.search === '?capability=1') || (req.method === 'POST' && ['/api/import/students','/api/marks/import','/api/onboarding/batches'].includes(url.pathname) && !url.search);
    if (!allowed) {res.writeHead(403,{'content-type':'application/json'}).end(JSON.stringify({error:'Harness denies this action; no ERP service exists here.'}));return;}
    const chunks: Buffer[]=[]; let size=0; for await(const chunk of req) { size+=chunk.length; if(size>6000000){res.writeHead(413).end();return;} chunks.push(chunk); }
    const bytes=Buffer.concat(chunks); const raw=bytes.toString('utf8');
    if(String(req.headers['content-type']).startsWith('multipart/')) {
      if (url.pathname !== '/api/onboarding/batches') {res.writeHead(403).end();return;}
      const form=await new Response(bytes,{headers:{'content-type':String(req.headers['content-type'])}}).formData();
      const file=form.get('workbook') as File;
      const content=Object.values(unzipSync(new Uint8Array(await file.arrayBuffer()))).map(v=>new TextDecoder().decode(v)).join('');
      capture({path:url.pathname,action:'canonical-upload',keys:[...form.keys()].slice(0,32),forbiddenSentinelObserved:content.includes('FORBIDDEN_SYNTHETIC_SENTINEL_1A')});
      res.writeHead(403,{'content-type':'application/json'}).end(JSON.stringify({error:'Synthetic harness refuses execution; capture only.'}));return;
    }
    let body: any; try { body=raw?JSON.parse(raw):{}; } catch {res.writeHead(400).end();return;}
    if (req.method === 'POST' && (body?.action !== 'preview' || !['/api/import/students','/api/marks/import'].includes(url.pathname))) {res.writeHead(403,{'content-type':'application/json'}).end(JSON.stringify({error:'Synthetic harness refuses execution.'}));return;}
    if(raw) capture({path:url.pathname,action:body.action,keys:Object.keys(body).slice(0,32),rowCount:body.rows?.length ?? 0,rowKeys:(body.rows??[]).slice(0,3).map((r:any)=>Object.keys(r).slice(0,64)),forbiddenSentinelObserved:raw.includes('FORBIDDEN_SYNTHETIC_SENTINEL_1A')});
    res.setHeader('content-type','application/json');
    if(url.pathname==='/api/import/students') res.end(JSON.stringify(req.method==='GET'?{actorContext:'synthetic-actor',classes:[{academicYear:'2026-27',className:'I',section:'A'}],preview:true,import:false}:{preview:normalizeStudentImportRows(body.rows??[]),receipt:'synthetic-component-only'}));
    else if(url.pathname==='/api/marks/import') res.end(JSON.stringify(req.method==='GET'?{actorContext:'synthetic-actor',choices:[choice],preview:true,import:true}:{preview:{totalRows:1,validRows:1,errorRows:0,errors:[],rows:[{admissionNumber:'00001',entryStatus:'PRESENT',marksObtained:'0'}]},receipt:'synthetic-component-only',import:true}));
    else if(url.pathname==='/api/onboarding/batches' && url.searchParams.get('capability')==='1') res.end(JSON.stringify({actorContext:'synthetic-actor',role:'PRINCIPAL',permissions:{upload:true,validate:true,resolve:true,approve:process.env.IMPORT_BROWSER_A11Y === "1",execute:false,audit:true,rollback:true}}));
    else {res.statusCode=403;res.end(JSON.stringify({error:'Harness denies this action; no ERP service exists here.'}));} return;
  }
  if(req.method!=='GET'){res.writeHead(405).end();return;}
  if(url.pathname==='/network-capture.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(captures));return;}
  if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bulk exchange synthetic QA</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');return;}
  const files:Record<string,string>={'/app.js':`${out}/app.js`,'/worker.js':`${out}/worker.js`,'/onboarding-worker.js':`${out}/onboarding-worker.js`,'/style.css':'app/globals.css'};
  if(!files[url.pathname]){res.writeHead(404).end();return;}
  res.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':'application/javascript');res.end(readFileSync(files[url.pathname]));
  } catch { if (!res.headersSent) res.writeHead(400, {'content-type':'application/json'}); res.end(JSON.stringify({error:'Invalid synthetic harness request.'})); }
});
server.listen(port,'127.0.0.1',()=>console.log(`SYNTHETIC_COMPONENT_HARNESS http://127.0.0.1:${port}; no ERP/DB; PID=${process.pid}`));

}
void main();
