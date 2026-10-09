import { preflight, OPERATIONS } from './config.mjs';
import { normalizeSample, stopForResources } from './metrics.mjs';

/** @typedef {'success'|'failed'|'timeout'|'cancelled'|'refused'} Outcome */
/** @typedef {{operation:string, outcome:Outcome, startMs:number, endMs:number, latencyMs:number, mutationUncertain:boolean}} Action */
export function correct(operation, response, expected) {
  if(!response || response.contentType!=='application/json' || response.redirected || !response.body || typeof response.body!=='object' || response.body.error || response.body.denied)return false;
  if(operation==='certificate_list')return response.status===200 && Array.isArray(response.body.requests) && response.body.requests.length===expected.ids.length && response.body.requests.every((row,i)=>row.id===expected.ids[i]);
  const row=response.body.request;
  return response.status===201 && row?.id===expected.id && row?.status==='SUBMITTED' && row?.studentId===expected.studentId && response.readback?.effectCount===1 && response.readback?.id===row.id && response.readback?.status==='SUBMITTED';
}

// Pure scheduler: HTTP/process/database effects belong to the qualified adapter.
export async function runScenario(raw, seams) {
  const admitted=preflight(raw,seams.identity), c=admitted.config;
  const {clock,transport,expected,sample=()=>({}),owns=()=>true,signal}=seams;
  const begin=clock.now(), start=clock.iso();
  const actions=[],samples=[],active=new Map(),users=Array(c.virtualUsers).fill(begin);
  const mix=c.mix.flatMap(x=>Array(x.weight).fill(x.operation));
  let scheduled=0,peakInFlight=0,nextArrival=begin,errorStreak=0,stopReason=null,lastSample=-Infinity;
  const stop=reason=>{if(!stopReason)stopReason=reason;for(const task of active.values())task.controller.abort();};
  const onAbort=()=>stop('CANCELLED');
  signal?.addEventListener('abort',onAbort,{once:true});
  const launch=(user,operation)=>{
    if(stopReason||signal?.aborted)return;
    const ordinal=scheduled++,at=clock.now(),controller=new AbortController(),timer=new AbortController();
    let resolveAbort;
    const aborted=new Promise(resolve=>{resolveAbort=()=>resolve({kind:'cancelled'});controller.signal.addEventListener('abort',resolveAbort,{once:true});});
    // No retry, including after timeout of a possibly committed mutation.
    const work=Promise.resolve().then(()=>{
      if(controller.signal.aborted||signal?.aborted)return {kind:'cancelled'};
      return transport({operation,ordinal,signal:controller.signal});
    }).then(response=>response?.kind==='cancelled'?response:{kind:'response',response},()=>({kind:'failed'}));
    const timeout=clock.sleep(c.timeoutMs,timer.signal).then(()=>({kind:'timeout'}),()=>({kind:'cancelled'}));
    const done=Promise.race([work,timeout,aborted]).then(result=>{
      timer.abort();controller.abort();controller.signal.removeEventListener('abort',resolveAbort);
      let outcome=result.kind;
      if(result.kind==='response') {
        if([401,403].includes(result.response?.status))outcome='refused';
        else {try{outcome=correct(operation,result.response,expected(operation,ordinal))?'success':'failed';}catch{outcome='failed';}}
      }
      const end=clock.now();
      actions.push({operation,outcome,startMs:at-begin,endMs:end-begin,latencyMs:end-at,mutationUncertain:OPERATIONS[operation].mutation&&outcome!=='success'});
      active.delete(user);users[user]=end+c.thinkMs;
      errorStreak=outcome==='success'?0:errorStreak+1;
      if(errorStreak>=c.limits.consecutiveErrors)stop('SUSTAINED_ERRORS');
    });
    active.set(user,{controller,done});peakInFlight=Math.max(peakInFlight,active.size);
  };
  try { while(!stopReason) {
    const now=clock.now();
    if(signal?.aborted){stop('CANCELLED');break;}
    let owned=false;try{owned=owns()===true;}catch{}if(!owned){stop('OWNERSHIP_LOST');break;}
    if(now-lastSample>=100) {
      let rawSample;try{rawSample=sample();}catch{rawSample={};}
      const s=normalizeSample(rawSample,now-begin);samples.push(s);lastSample=now;
      const reason=stopForResources(s,samples[0],c.limits);if(reason){stop(reason);break;}
    }
    if(now-begin>=c.durationMs){stop('DURATION_LIMIT');break;}
    if(scheduled>=c.maxActions && active.size===0){stopReason='ACTION_LIMIT';break;}
    for(let user=0;!stopReason && user<users.length && active.size<c.maxInFlight && scheduled<c.maxActions;user++) {
      if(!active.has(user) && users[user]<=now && now>=nextArrival) {
        launch(user,mix[scheduled%mix.length]);nextArrival=now+1000/c.arrivalPerSecond;
      }
    }
    await clock.sleep(10);
  }
  await Promise.all([...active.values()].map(t=>t.done));
  } finally { signal?.removeEventListener('abort',onAbort); }
  const elapsedMs=clock.now()-begin,end=clock.iso();
  return {schemaVersion:1,evidence:c.profile==='local-synthetic-http'?'LOCAL_SYNTHETIC_HTTP':'HARNESS_ONLY',artifact:null,source:c.source,tree:c.tree,subject:c.subject,configHash:admitted.configHash,config:c,start,end,clockKind:clock.kind,elapsedMs,stopReason,scheduled,notScheduled:c.maxActions-scheduled,peakInFlight,actions,samples,
    limitations:[...(c.profile==='local-synthetic-http'?[]:['IN_MEMORY_ONLY']),'NO_ERP_PERFORMANCE_CLAIM','SAME_HOST_GENERATOR_DISTORTS_MEASUREMENT','NO_LAPTOP_CPU_TO_VPS_CONVERSION','MISSING_METRICS_ARE_UNAVAILABLE','NO_REAL_RECOVERY_OR_SOAK']};
}
