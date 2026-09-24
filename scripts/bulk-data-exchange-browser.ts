import { unzipSync } from "fflate";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { build } from "esbuild";
import { normalizeStudentImportRows } from "../lib/student-import";
async function main() {
const out = "tmp/bulk-exchange-browser";
mkdirSync(out, { recursive: true });
const entry = `import React from 'react'; import {createRoot} from 'react-dom/client';
import {StudentImportPanel} from '../../components/student-import-panel';
import {MarksImporter} from '../../components/marks-importer';
import {OnboardingCentre} from '../../components/onboarding-centre';
import {ImportRowErrors} from '../../components/import-row-errors';
function App(){const [dark,setDark]=React.useState(false); const [kind,setKind]=React.useState('student'); React.useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.classList.toggle('dark',dark)},[dark]); return <main style={{padding:12,minWidth:0}}><h1>Isolated synthetic component QA</h1><p>No ERP connection. Responses below are synthetic harness responses, not authenticated E2E.</p><button onClick={()=>setDark(!dark)}>Toggle light/dark</button><label>Harness component<select value={kind} onChange={e=>setKind(e.target.value)}><option value="student">Student</option><option value="marks">Legacy marks</option><option value="onboarding">Onboarding</option><option value="errors">Long errors</option></select></label>{kind==='student'?<StudentImportPanel/>:kind==='marks'?<MarksImporter/>:kind==='onboarding'?<OnboardingCentre initialBatches={[]} role="PRINCIPAL" permissions={{upload:true,validate:true,resolve:true,approve:true,execute:true,audit:true,rollback:true}}/>:<ImportRowErrors rows={[{row:2,field:'Student name',messages:['Invented Unicode విద్యార్థి हिन्दी العربية '.repeat(30)]}]}/>}</main>}; createRoot(document.getElementById('root')).render(<App/>);`;
writeFileSync(`${out}/entry.tsx`, entry);
await build({ entryPoints: [`${out}/entry.tsx`], bundle: true, outfile: `${out}/app.js`, format: "esm", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "worker-url", setup(b) { b.onLoad({ filter: /(?:student-import-panel|marks-importer|onboarding-centre)\.tsx$/ }, async a => ({ contents: readFileSync(a.path, "utf8").replaceAll('new URL("../lib/student-source.worker.ts", import.meta.url)', 'new URL("/worker.js", window.location.href)').replaceAll('new URL("../lib/onboarding-upload.worker.ts", import.meta.url)', 'new URL("/onboarding-worker.js", window.location.href)'), loader: "tsx" })); } }] });
await build({ entryPoints: ["lib/student-source.worker.ts"], bundle: true, outfile: `${out}/worker.js`, format: "iife" });
await build({ entryPoints: ["lib/onboarding-upload.worker.ts"], bundle: true, outfile: `${out}/onboarding-worker.js`, format: "iife" });
writeFileSync(`${out}/student-sentinel.csv`, 'Admision No,Full Name,Class Name,Section,PrivateBalance\r\n00001,INVENTED విద్యార్థి,I,A,FORBIDDEN_SYNTHETIC_SENTINEL_1A\r\n');
writeFileSync(`${out}/marks.csv`, 'examCode,className,section,subjectName,componentName,admissionNumber,marksObtained,entryStatus,remarks\r\nSYNTH-EXAM,I,A,Math,Theory,00001,0,PRESENT,\r\n');
const captures: unknown[] = [];
const choice = {id:'synthetic-assessment',academicYear:'2026-27',className:'I',section:'A',subjectName:'Math',componentName:'Theory',maxMarks:'10',examCycle:{examCode:'SYNTH-EXAM'}};
const server = createServer(async(req,res)=>{
  res.setHeader('cache-control','no-store');
  const url = new URL(req.url!, 'http://127.0.0.1');
  if (url.pathname.startsWith('/api/')) {
    const chunks: Buffer[]=[]; let size=0; for await(const chunk of req) { size+=chunk.length; if(size>6000000){res.writeHead(413).end();return;} chunks.push(chunk); }
    const bytes=Buffer.concat(chunks); const raw=bytes.toString('utf8');
    if(String(req.headers['content-type']).startsWith('multipart/')) {
      const form=await new Response(bytes,{headers:{'content-type':String(req.headers['content-type'])}}).formData();
      const file=form.get('workbook') as File;
      const content=Object.values(unzipSync(new Uint8Array(await file.arrayBuffer()))).map(v=>new TextDecoder().decode(v)).join('');
      captures.push({path:url.pathname,action:'canonical-upload',keys:[...form.keys()],forbiddenSentinelObserved:content.includes('FORBIDDEN_SYNTHETIC_SENTINEL_1A')});
      writeFileSync(`${out}/network-capture.json`,JSON.stringify(captures,null,2));
      res.writeHead(403,{'content-type':'application/json'}).end(JSON.stringify({error:'Synthetic harness refuses execution; capture only.'}));return;
    }
    const body=raw?JSON.parse(raw):{};
    if(raw) { captures.push({path:url.pathname,action:body.action,keys:Object.keys(body),rowKeys:(body.rows??[]).map((r:any)=>Object.keys(r)),forbiddenSentinelObserved:raw.includes('FORBIDDEN_SYNTHETIC_SENTINEL_1A')}); writeFileSync(`${out}/network-capture.json`,JSON.stringify(captures,null,2)); }
    res.setHeader('content-type','application/json');
    if(url.pathname==='/api/import/students') res.end(JSON.stringify(req.method==='GET'?{actorContext:'synthetic-actor',classes:[{academicYear:'2026-27',className:'I',section:'A'}],preview:true,import:false}:{preview:normalizeStudentImportRows(body.rows??[]),receipt:'synthetic-component-only'}));
    else if(url.pathname==='/api/marks/import') res.end(JSON.stringify(req.method==='GET'?{actorContext:'synthetic-actor',choices:[choice],preview:true,import:true}:{preview:{totalRows:1,validRows:1,errorRows:0,errors:[],rows:[{admissionNumber:'00001',entryStatus:'PRESENT',marksObtained:'0'}]},receipt:'synthetic-component-only',import:true}));
    else if(url.pathname==='/api/onboarding/batches' && url.searchParams.get('capability')==='1') res.end(JSON.stringify({actorContext:'synthetic-actor',role:'PRINCIPAL',permissions:{upload:true,validate:true,resolve:true,approve:false,execute:false,audit:true,rollback:true}}));
    else {res.statusCode=403;res.end(JSON.stringify({error:'Harness denies this action; no ERP service exists here.'}));} return;
  }
  if(url.pathname==='/network-capture.json'){res.setHeader('content-type','application/json');res.end(JSON.stringify(captures));return;}
  if(url.pathname==='/'){res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bulk exchange synthetic QA</title><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');return;}
  const files:Record<string,string>={'/app.js':`${out}/app.js`,'/worker.js':`${out}/worker.js`,'/onboarding-worker.js':`${out}/onboarding-worker.js`,'/style.css':'app/globals.css'};
  if(!files[url.pathname]){res.writeHead(404).end();return;}
  res.setHeader('content-type',url.pathname.endsWith('.css')?'text/css':'application/javascript');res.end(readFileSync(files[url.pathname]));
});
server.listen(47831,'127.0.0.1',()=>console.log('SYNTHETIC_COMPONENT_HARNESS http://127.0.0.1:47831; no ERP/DB; PID='+process.pid));

}
void main();
