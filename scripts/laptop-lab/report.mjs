import { validateConfig,hash,OPERATIONS,fail } from './config.mjs';
import { GAUGES,normalizeSample,resourceSummary,portableCounters,portableSummary,validPortableCounter } from './metrics.mjs';
const OUTCOMES=['success','failed','timeout','cancelled','refused'];
const STOPS=['ACTION_LIMIT','DURATION_LIMIT','CANCELLED','OWNERSHIP_LOST','SUSTAINED_ERRORS','MEMORY_PRESSURE','LOW_DISK','TEMPERATURE_LIMIT','MEMORY_GROWTH'];
const finite=n=>Number.isFinite(n)&&n>=0;
const iso=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v)&&Number.isFinite(Date.parse(v));
export const escapeHtml = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function percentile(values,p){
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.ceil(p*sorted.length)-1];
}
// Construct an allowlisted record; never serialize arbitrary input, diagnostics,
// bodies, errors, URLs, credentials, fixture identifiers, or extra properties.
export function validateResult(raw){
  const c=validateConfig(raw?.config);
  const real=c.profile==='local-synthetic-http',evidence=real?'LOCAL_SYNTHETIC_HTTP':'HARNESS_ONLY',clockKind=real?'MONOTONIC_WALL':'VIRTUAL';
  if(raw.schemaVersion!==1||raw.evidence!==evidence||raw.artifact!==null||raw.source!==c.source||raw.tree!==c.tree||raw.subject!==c.subject||raw.configHash!==hash(c)||raw.clockKind!==clockKind||!iso(raw.start)||!iso(raw.end)||!finite(raw.elapsedMs)||raw.elapsedMs>c.durationMs+(real?c.timeoutMs+1000:10)||Date.parse(raw.end)-Date.parse(raw.start)!==raw.elapsedMs||!STOPS.includes(raw.stopReason))fail('RESULT_IDENTITY_INVALID');
  if(!Number.isInteger(raw.scheduled)||raw.scheduled<0||raw.scheduled>c.maxActions||raw.notScheduled!==c.maxActions-raw.scheduled||!Number.isInteger(raw.peakInFlight)||raw.peakInFlight<0||raw.peakInFlight>c.maxInFlight||!Array.isArray(raw.actions)||raw.actions.length!==raw.scheduled||!Array.isArray(raw.samples)||raw.samples.length>102)fail('RESULT_COUNTS_INVALID');
  const actions=raw.actions.map(a=>{
    if(!c.mix.some(x=>x.operation===a.operation)||!OUTCOMES.includes(a.outcome)||![a.startMs,a.endMs,a.latencyMs].every(finite)||a.endMs<a.startMs||a.endMs>raw.elapsedMs||Math.abs(a.endMs-a.startMs-a.latencyMs)>1e-6||a.mutationUncertain!==(OPERATIONS[a.operation].mutation&&a.outcome!=='success'))fail('ACTION_INVALID');
    return {operation:a.operation,outcome:a.outcome,startMs:a.startMs,endMs:a.endMs,latencyMs:a.latencyMs,mutationUncertain:a.mutationUncertain};
  });
  let last=-1;
  const samples=raw.samples.map(s=>{
    if(!finite(s.atMs)||s.atMs<=last||s.atMs>raw.elapsedMs)fail('SAMPLE_TIME_INVALID');last=s.atMs;
    const input={};for(const name of Object.keys(GAUGES)){
      const m=s.metrics?.[name];
      if(!m||m.unit!==GAUGES[name]||!['AVAILABLE','UNAVAILABLE','INVALID'].includes(m.state)||m.state!=='AVAILABLE'&&m.value!==null)fail('SAMPLE_INVALID');
      if(m.state==='AVAILABLE')input[name]={value:m.value,unit:m.unit};
      else if(m.state==='INVALID')input[name]={value:null,unit:m.unit};
    }
    const clean=normalizeSample(input,s.atMs);
    for(const name of Object.keys(GAUGES))if(clean.metrics[name].state!==s.metrics[name].state)fail('SAMPLE_INVALID');
    const p=s.portable;
    if(!p||!['OBSERVED','UNAVAILABLE'].includes(p.state)||!p.values||typeof p.values!=='object'||Array.isArray(p.values)||!Array.isArray(p.issues)||p.issues.length>2||p.issues.some(i=>!['INVALID_METRIC_INPUT','REJECTED_METRIC_LINE'].includes(i)))fail('PORTABLE_SAMPLE_INVALID');
    if(Object.entries(p.values).some(([k,v])=>!validPortableCounter(k,v)))fail('PORTABLE_SAMPLE_INVALID');
    const parsed=portableCounters(Object.entries(p.values).map(([k,v])=>`${k} ${v}`).join('\n'));
    if(parsed.issues.length||p.state==='UNAVAILABLE'&&(Object.keys(p.values).length||p.issues.length))fail('PORTABLE_SAMPLE_INVALID');
    clean.portable={values:parsed.values,issues:[...p.issues],state:p.state};
    return clean;
  });
  let connection;
  if(raw.connection!==undefined){
    const x=raw.connection;
    if(!x||Object.keys(x).sort().join()!==(real?'adapter,consumerRunId,lifecycle,mode,processIntegration,producerSource,producerTree,profileSha256':'adapter,consumerRunId,lifecycle,mode,processIntegration,producerSource,profileSha256')||! /^[a-f0-9]{64}$/.test(x.profileSha256)||! /^[a-f0-9]{40}$/.test(x.producerSource)||! /^[a-f0-9]{32}$/.test(x.consumerRunId))fail('CONNECTION_CLASSIFICATION_INVALID');
    if(real?x.mode!=='REAL'||x.adapter!=='AUTHENTICATED_OPERATION_ADAPTER'||x.lifecycle!=='OWNED_LOCAL_RUNTIME'||x.processIntegration!=='BOUND_DOCKER_PROCESS'||x.producerSource!==c.source||x.producerTree!==c.tree:x.mode!=='HARNESS_ONLY'||!['SIMULATED_SERVICE','AUTHENTICATED_OPERATION_ADAPTER'].includes(x.adapter)||x.lifecycle!=='SIMULATED_RUNTIME'||!['SIMULATED_PROCESS','HARMLESS_CHILD_CAPTURED'].includes(x.processIntegration))fail('CONNECTION_CLASSIFICATION_INVALID');
    connection={mode:x.mode,adapter:x.adapter,lifecycle:x.lifecycle,processIntegration:x.processIntegration,profileSha256:x.profileSha256,producerSource:x.producerSource,...(real?{producerTree:x.producerTree}:{}),consumerRunId:x.consumerRunId};
  }
  if(real&&!connection)fail('CONNECTION_CLASSIFICATION_INVALID');
  return {schemaVersion:1,evidence,artifact:null,source:c.source,tree:c.tree,subject:c.subject,configHash:raw.configHash,config:c,start:raw.start,end:raw.end,clockKind,elapsedMs:raw.elapsedMs,stopReason:raw.stopReason,scheduled:raw.scheduled,notScheduled:c.maxActions-raw.scheduled,peakInFlight:raw.peakInFlight,actions,samples,...(connection?{connection}:{})};
}
export function reports(input){
  const r=validateResult(input), seconds=r.elapsedMs/1000;
  const counts=Object.fromEntries(OUTCOMES.map(name=>[name,r.actions.filter(a=>a.outcome===name).length]));
  const operations=r.config.mix.map(({operation,weight})=>{
    const actions=r.actions.filter(a=>a.operation===operation),latency=actions.filter(a=>a.outcome==='success').map(a=>a.latencyMs);
    return {operation,weight,attempts:actions.length,successfulBusinessOperations:latency.length,p50Ms:percentile(latency,.5),p95Ms:percentile(latency,.95),p99Ms:percentile(latency,.99),sampleState:latency.length===0?'EMPTY':latency.length<100?'INSUFFICIENT_FOR_TAIL_INFERENCE':'DESCRIPTIVE_ONLY'};
  });
  const summary={...r,counts,operations,actionCount:r.actions.length,sampleCount:r.samples.length,completedBusinessOperations:counts.success,errorRate:r.scheduled?(counts.failed+counts.timeout+counts.refused)/r.scheduled:null,cancelledRate:r.scheduled?counts.cancelled/r.scheduled:null,achievedActionsPerSecond:seconds?r.scheduled/seconds:null,achievedHttpRequestsPerSecond:null,successfulBusinessOperationsPerSecond:seconds?counts.success/seconds:null,coverageComplete:r.stopReason==='ACTION_LIMIT'&&r.notScheduled===0&&counts.success===r.scheduled,resources:resourceSummary(r.samples),portableCounters:portableSummary(r.samples),percentileConvention:'Nearest rank, successful operations only, milliseconds',limitations:['HARNESS_ONLY: virtual time and invented metrics; no ERP capacity evidence.','HTTP requests per second unavailable: transport is in-memory.','Same-host load generation consumes measured resources.','No laptop CPU to VPS vCPU conversion.','Unavailable metrics are not zero; thermal/throttling visibility is unverified.','No recovery or soak executed.','Sizing and bottleneck conclusions pending admitted ERP measurements.']};
  if(r.connection)summary.limitations[1]='HARNESS_ONLY controlled transport and virtual time; no actual HTTP/ERP measurement.';
  if(r.evidence==='LOCAL_SYNTHETIC_HTTP'){
    summary.limitations[0]='Bound disposable synthetic HTTP scenario; no production or sizing inference.';
    summary.limitations[1]='HTTP requests per second unavailable: actions include target checks and served-database readback.';
  }
  const columns=['operation','weight','attempts','successfulBusinessOperations','p50Ms','p95Ms','p99Ms','sampleState',...(r.connection?['evidence','adapter','lifecycle','processIntegration']:[])];
  const csv=[columns.join(','),...operations.map(o=>columns.map(k=>({...o,evidence:r.evidence,...r.connection})[k]??'UNAVAILABLE').join(','))].join('\n')+'\n';
  const html='<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; style-src \'unsafe-inline\'; base-uri \'none\'; form-action \'none\'"><meta name="viewport" content="width=device-width"><title>NPS lab source fixture</title><style>body{max-width:72rem;margin:2rem auto;padding:1rem;font:16px system-ui;line-height:1.5}pre{white-space:pre-wrap;overflow-wrap:anywhere}h1{color:#194a4a}</style><h1>'+escapeHtml(r.evidence)+'</h1><p>'+(r.evidence==='HARNESS_ONLY'?'Source validation with virtual time and invented records. This is not ERP performance.':'Bound synthetic scenario only. Same-host action timing includes validation/readback and cannot determine capacity.')+'</p><pre>'+escapeHtml(JSON.stringify(summary,null,2))+'</pre></html>';
  return {result:summary,json:JSON.stringify(summary,null,2)+'\n',csv,html};
}
