import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,writeFile,unlink,lstat } from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import { exampleConfig,hash,preflight,runtimePreflight } from './config.mjs';
import { VirtualClock,fixture } from './fixture.mjs';
import { runScenario } from './runner.mjs';
import { normalizeSample,portableCounters,counterRate,resourceSummary } from './metrics.mjs';
import { reports,validateResult,escapeHtml,percentile } from './report.mjs';
import { reserveOutput,writeReports,cleanupOutput,ROOT } from './output.mjs';

async function run(change={}, overrides=()=>({})){
  const config={...exampleConfig('disposable-mutation'),...change};
  const clock=new VirtualClock();const seams={clock,...fixture(clock),identity:{expectedConfigHash:hash(config)},...overrides(clock)};
  const result=await clock.drive(runScenario(config,seams));
  assert.equal(clock.queue.length,0,'all owned timers released');return result;
}
test('connected positive scenario reaches validated JSON CSV HTML and reconciles totals',async()=>{
  const r=await run(),p=reports(r);assert.equal(r.scheduled,12);assert.equal(r.actions.length,12);assert.equal(p.result.counts.success,12);assert.equal(p.result.completedBusinessOperations,12);assert.equal(p.result.coverageComplete,true);assert.equal(p.result.achievedHttpRequestsPerSecond,null);assert.equal(p.result.clockKind,'VIRTUAL');assert.equal(p.result.artifact,null);assert.ok(p.csv.includes('certificate_request'));assert.ok(p.html.includes('HARNESS_ONLY'));assert.ok(!/<(?:script|img|iframe|link)\b|(?:src|href)\s*=/i.test(p.html));
});
for(const [name,change] of Object.entries({unknownTarget:{target:'https://example.invalid'},unknownProfile:{profile:'local-single-node'},wrongSource:{source:'a'.repeat(40)},wrongSubject:{subject:'a'.repeat(64)},unknownKey:{password:'PRIVATE'},invalidConcurrency:{maxInFlight:9},invalidArrival:{arrivalPerSecond:Infinity},invalidMix:{mix:[{operation:'unknown',weight:1}]},readOnlyWrite:{scenario:'read-only'}}))test(`refuses ${name} before adapter invocation`,async()=>{
  let calls=0;await assert.rejects(run(change,()=>({transport:()=>{calls++;}})));assert.equal(calls,0);
});
test('mismatched expected config/source and runtime permission refuse',()=>{
  const c=exampleConfig();assert.throws(()=>preflight(c,{expectedConfigHash:'a'.repeat(64)}));assert.throws(()=>preflight(c,{expectedConfigHash:hash(c),expectedSource:'a'.repeat(40)}));assert.throws(()=>runtimePreflight({permission:true,artifact:'sha256:'+ 'a'.repeat(64)}));
});
test('concurrency, per-user think time, arrival bound and operation weights',async()=>{
  const r=await run({virtualUsers:5,maxInFlight:2,arrivalPerSecond:100,thinkMs:30,maxActions:20},clock=>({transport:async({operation,ordinal,signal})=>{await clock.sleep(35,signal);return fixture(clock).transport({operation,ordinal,signal});}}));
  assert.equal(r.peakInFlight,2);
  const starts=r.actions.map(a=>a.startMs).sort((a,b)=>a-b);for(let i=1;i<starts.length;i++)assert.ok(starts[i]-starts[i-1]>=10);
  assert.equal(r.actions.filter(a=>a.operation==='certificate_request').length,4);
});
test('single user think time follows completion',async()=>{
  const r=await run({virtualUsers:1,maxInFlight:1,maxActions:3,thinkMs:100});for(let i=1;i<r.actions.length;i++)assert.ok(r.actions[i].startMs-r.actions[i-1].endMs>=100);
});
test('HTTP 200 login/error/denial does not count as business success',async()=>{
  for(const response of [{status:200,contentType:'text/html',body:'login'},{status:200,contentType:'application/json',body:{error:'PRIVATE'}},{status:200,contentType:'application/json',body:{denied:true}},{status:200,contentType:'application/json',body:{requests:[]}},{status:200,contentType:'application/json',redirected:true,body:{requests:[]}}]){
    const r=await run({},()=>({transport:async()=>response}));assert.equal(reports(r).result.counts.success,0);assert.equal(r.stopReason,'SUSTAINED_ERRORS');
  }
});
test('permission denials recorded as refused',async()=>{const r=await run({},()=>({transport:async()=>({status:403})}));assert.equal(reports(r).result.counts.refused,3);});
test('mutation requires one authoritative matching effect',async()=>{
  const r=await run({mix:[{operation:'certificate_request',weight:1}]},clock=>({transport:async a=>{const r=await fixture(clock).transport(a);r.readback.effectCount=2;return r;}}));assert.equal(reports(r).result.counts.failed,3);assert.ok(r.actions.every(a=>a.mutationUncertain));
});
test('hung transport times out, records uncertain writes and never retries',async()=>{
  let calls=0;const r=await run({mix:[{operation:'certificate_request',weight:1}]},()=>({transport:()=>{calls++;return new Promise(()=>{});}}));assert.equal(r.actions.length,calls);assert.ok(r.actions.some(a=>a.outcome==='timeout'));assert.equal(r.stopReason,'SUSTAINED_ERRORS');assert.ok(r.actions.every(a=>a.mutationUncertain));
});
test('thrown private errors are fixed failed outcomes without leakage',async()=>{const r=await run({},()=>({transport:async()=>{throw Error('token=PRIVATE C:/Users/private');}}));assert.ok(!reports(r).json.includes('PRIVATE'));assert.equal(r.stopReason,'SUSTAINED_ERRORS');});
test('external cancellation halts scheduling and preserves partial results',async()=>{
  let calls=0;const controller=new AbortController();
  const r=await run({},clock=>({signal:controller.signal,transport:async a=>{calls++;controller.abort();await clock.sleep(500,a.signal);}}));
  assert.equal(r.stopReason,'CANCELLED');assert.equal(calls,1);assert.equal(r.actions[0].outcome,'cancelled');assert.ok(r.notScheduled>0);assert.equal(reports(r).result.coverageComplete,false);
});
test('cancellation during sample or before queued transport prevents new work',async()=>{
  for(const phase of ['sample','microtask']){
    const controller=new AbortController(),clock=new VirtualClock(),config=exampleConfig();let calls=0;
    const promise=runScenario(config,{clock,...fixture(clock),identity:{expectedConfigHash:hash(config)},signal:controller.signal,sample:()=>{if(phase==='sample')controller.abort();return {};},transport:()=>{calls++;}});
    if(phase==='microtask')controller.abort();
    const r=await clock.drive(promise);assert.equal(calls,0);assert.equal(r.stopReason,'CANCELLED');assert.ok(r.actions.every(a=>a.outcome==='cancelled'));assert.equal(reports(r).result.coverageComplete,false);
  }
});
test('portable cumulative outputs connect through runner to report with reset evidence',async()=>{
  const r=await run({},clock=>({sample:()=>({portableMetrics:`nalanda_requests_total ${clock.now()<100?10:2}`})}));
  assert.equal(reports(r).result.portableCounters.nalanda_requests_total.ratesPerSecond[0].state,'COUNTER_RESET');
});
test('stored counter newline/value/key injection is refused',async()=>{
  const base=await run();for(const values of [{nalanda_requests_total:'1\nnalanda_http_5xx_total 2'},{'nalanda_requests_total\n':1},{nalanda_requests_total:-1},{nalanda_requests_total:1.1}]){
    const r=structuredClone(base);r.samples[0].portable.values=values;assert.throws(()=>reports(r));
  }
});
test('fixture mutations are independently read from a disposable in-memory map',async()=>{
  const clock=new VirtualClock(),f=fixture(clock),signal=new AbortController().signal;
  await clock.drive(f.transport({operation:'certificate_request',ordinal:1,signal}));
  const read=await clock.drive(f.transport({operation:'certificate_list',ordinal:2,signal}));
  assert.equal(read.body.requests.length,3);assert.equal(read.body.requests[0].id,'INVENTED-REQUEST-1');
});
test('duration cancels in-flight work within the bounded deadline',async()=>{
  const r=await run({durationMs:40},()=>({transport:()=>new Promise(()=>{})}));assert.equal(r.stopReason,'DURATION_LIMIT');assert.equal(r.elapsedMs,40);assert.equal(r.actions[0].outcome,'cancelled');
});
test('ownership loss prevents launch and handles thrown ownership probe',async()=>{
  for(const owns of [()=>false,()=>{throw Error('private');}]){let calls=0;const r=await run({},()=>({owns,transport:()=>calls++}));assert.equal(r.stopReason,'OWNERSHIP_LOST');assert.equal(calls,0);assert.equal(reports(r).result.operations[0].p50Ms,null);}
});
for(const [key,value,unit,reason] of [['freeMemoryBytes',1,'bytes','MEMORY_PRESSURE'],['diskFreeBytes',1,'bytes','LOW_DISK'],['temperatureC',90,'celsius','TEMPERATURE_LIMIT']])test(`resource stop ${reason} before scheduling`,async()=>{
  const r=await run({},()=>({sample:()=>({[key]:{value,unit}})}));assert.equal(r.stopReason,reason);assert.equal(r.scheduled,0);
});
test('memory growth stops and lost telemetry remains unavailable',async()=>{
  const r=await run({},clock=>({sample:()=>({appMemoryBytes:{value:clock.now()<100?100:2**30,unit:'bytes'}})}));assert.equal(r.stopReason,'MEMORY_GROWTH');assert.equal(reports(r).result.resources.temperatureC.availableSamples,0);
  const absent=await run({},()=>({sample:()=>{throw Error('private');}}));assert.equal(absent.samples[0].metrics.hostCpuPercent.state,'UNAVAILABLE');
});
test('malformed unit, missing fields, empty samples, counter resets and conversion',()=>{
  const s=normalizeSample({hostMemoryBytes:{value:1,unit:'GiB'},hostCpuPercent:{value:101,unit:'percent'},diskFreeBytes:{value:NaN,unit:'bytes'}},0);
  assert.equal(s.metrics.hostMemoryBytes.state,'INVALID');assert.equal(s.metrics.hostCpuPercent.state,'INVALID');assert.equal(s.metrics.swapBytes.value,null);
  assert.equal(resourceSummary([]).hostMemoryBytes.max,null);assert.deepEqual(counterRate(100,90,1000),{value:null,state:'COUNTER_RESET'});assert.equal(counterRate(null,4,1000).value,null);assert.equal(counterRate(2,4,0).value,null);assert.equal(counterRate(100,300,500).value,400);
});
test('existing portable metric parser rejects labels/secrets and negative or duplicate counters',()=>{
  const p=portableCounters('nalanda_requests_total 12\nnalanda_requests_total 13\nnalanda_http_5xx_total -1\nsecret{password="PRIVATE"} 2\nunknown 3\n');assert.deepEqual(p.values,{nalanda_requests_total:12});assert.deepEqual(p.issues,['REJECTED_METRIC_LINE']);assert.ok(!JSON.stringify(p).includes('PRIVATE'));
});
test('nearest rank convention, empty and insufficient tail samples',async()=>{
  assert.equal(percentile([],0.95),null);assert.equal(percentile([1,2,3,4,5],.5),3);assert.equal(percentile([1,2,3,4,5],.95),5);assert.equal(reports(await run()).result.operations[0].sampleState,'INSUFFICIENT_FOR_TAIL_INFERENCE');
});
test('result parser rejects counts, identity, outcome, units and timing mismatch',async()=>{
  const base=await run();for(const mutate of [r=>r.scheduled++,r=>r.configHash='a'.repeat(64),r=>r.evidence='ERP_MEASURED',r=>r.actions[0].outcome='SECRET',r=>r.actions[0].latencyMs=-1,r=>r.samples[0].metrics.freeMemoryBytes.unit='GiB',r=>r.end='PRIVATE',r=>r.samples[0].atMs=-1]){const r=structuredClone(base);mutate(r);assert.throws(()=>validateResult(r));}
});
test('all report formats exclude untrusted extras and HTML escapes active content',async()=>{
  const r=await run();const secret=randomUUID();r.secret=secret;r.actions[0].body=secret;r.samples[0].metrics.extra=secret;
  const p=reports(r);assert.ok(![p.json,p.csv,p.html].some(s=>s.includes(secret)));assert.equal(escapeHtml('<script>"&\''),'&lt;script&gt;&quot;&amp;&#39;');
});
test('output path/foreign ownership/changed-file checks and exact cleanup',async()=>{
  for(const name of ['../bad','C:/bad','a/b','CON','nul','bad?token=x',''])await assert.rejects(reserveOutput(name));
  const dir=await reserveOutput('test-'+Date.now());const p=reports(await run());await writeReports(dir,p);
  assert.equal(await readFile(path.join(dir,'operations.csv'),'utf8'),p.csv);await assert.rejects(reserveOutput(path.basename(dir)));
  await writeFile(path.join(dir,'.owner'),'FOREIGN');await assert.rejects(cleanupOutput(dir));await writeFile(path.join(dir,'.owner'),'NPS-LAPTOP-LAB-D1P');
  await writeFile(path.join(dir,'foreign.txt'),'retain');await assert.rejects(cleanupOutput(dir));await unlink(path.join(dir,'foreign.txt'));
  await writeFile(path.join(dir,'operations.csv'),'changed');await assert.rejects(cleanupOutput(dir));await writeFile(path.join(dir,'operations.csv'),p.csv);
  await cleanupOutput(dir);await assert.rejects(lstat(dir));await assert.rejects(cleanupOutput(path.dirname(ROOT)));
});
