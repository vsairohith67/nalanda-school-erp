// Fixed names only. No request labels, SQL, identities, paths or raw diagnostics.
export const GAUGES = Object.freeze({ hostCpuPercent:'percent',hostMemoryBytes:'bytes',freeMemoryBytes:'bytes',swapBytes:'bytes',appMemoryBytes:'bytes',appCpuPercent:'percent',dbMemoryBytes:'bytes',dbCpuPercent:'percent',dbConnections:'count',dbWaits:'count',dbLocks:'count',dbQueryMs:'ms',diskFreeBytes:'bytes',diskUsedBytes:'bytes',diskReadBytes:'bytes',diskWriteBytes:'bytes',diskLatencyMs:'ms',networkRxBytes:'bytes',networkTxBytes:'bytes',generatorMemoryBytes:'bytes',generatorCpuMs:'ms',temperatureC:'celsius' });
const COUNTERS = new Set(['diskReadBytes','diskWriteBytes','networkRxBytes','networkTxBytes','generatorCpuMs']);
const METRIC = /^nalanda_(?:requests|http_4xx|http_5xx|rate_limit_429|rate_limit_503|valkey_unavailable|object_store_errors|backup_success|backup_failure|job_lock_contention|offline_sync_accepted|offline_sync_conflict|offline_sync_rejected)_total$/;
export const validPortableCounter = (name,value) => typeof name==='string' && METRIC.test(name) && !/[\r\n]/.test(name) && Number.isSafeInteger(value) && value>=0;
export function portableCounters(text) {
  const values = {}, issues = [];
  if (typeof text !== 'string' || text.length > 65536) return {values,issues:['INVALID_METRIC_INPUT']};
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('#')) continue;
    const match=/^(\w+) ([0-9]+(?:\.[0-9]+)?)$/.exec(line);
    if (!match || !METRIC.test(match[1]) || !Number.isSafeInteger(Number(match[2])) || Object.hasOwn(values,match[1])) {issues.push('REJECTED_METRIC_LINE');continue;}
    values[match[1]]=Number(match[2]);
  }
  return {values,issues:[...new Set(issues)]};
}
export function normalizeSample(raw, atMs) {
  const metrics = {};
  for (const [name, unit] of Object.entries(GAUGES)) {
    const item=raw?.[name];
    const valid=item && item.unit===unit && Number.isFinite(item.value) && item.value>=0 && (unit!=='percent'||item.value<=100) && (!['bytes','count'].includes(unit)||Number.isSafeInteger(item.value));
    metrics[name]=valid?{value:item.value,unit,state:'AVAILABLE'}:{value:null,unit,state:item===undefined?'UNAVAILABLE':'INVALID'};
  }
  const portable=raw?.portableMetrics===undefined?{values:{},issues:[],state:'UNAVAILABLE'}:{...portableCounters(raw.portableMetrics),state:'OBSERVED'};
  return {atMs,metrics,portable};
}
export function portableSummary(samples){
  const names=[...new Set(samples.flatMap(s=>Object.keys(s.portable.values)))].sort();
  return Object.fromEntries(names.map(name=>[name,{ratesPerSecond:samples.slice(1).map((s,i)=>counterRate(samples[i].portable.values[name],s.portable.values[name],s.atMs-samples[i].atMs)),availableSamples:samples.filter(s=>Object.hasOwn(s.portable.values,name)).length}]));
}
export function counterRate(previous,current,elapsedMs) {
  if (!Number.isFinite(previous)||!Number.isFinite(current)||previous<0||current<0||!Number.isFinite(elapsedMs)||elapsedMs<=0) return {value:null,state:'UNAVAILABLE'};
  if(current<previous) return {value:null,state:'COUNTER_RESET'};
  return {value:(current-previous)*1000/elapsedMs,state:'AVAILABLE'};
}
export function resourceSummary(samples) {
  return Object.fromEntries(Object.entries(GAUGES).map(([name,unit])=>{
    const valid=samples.filter(s=>s.metrics[name].state==='AVAILABLE');
    const values=valid.map(s=>s.metrics[name].value);
    const deltas=samples.slice(1).map((s,i)=>counterRate(samples[i].metrics[name].value,s.metrics[name].value,s.atMs-samples[i].atMs));
    return [name,{unit,availableSamples:values.length,unavailableSamples:samples.length-values.length,min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null,growth:values.length>1?values.at(-1)-values[0]:null,...(COUNTERS.has(name)?{ratesPerSecond:deltas}: {})}];
  }));
}
export function stopForResources(sample, first, limits) {
  const v=name=>sample.metrics[name]?.value;
  if(v('freeMemoryBytes')!==null&&v('freeMemoryBytes')<limits.minFreeMemoryBytes)return 'MEMORY_PRESSURE';
  if(v('diskFreeBytes')!==null&&v('diskFreeBytes')<limits.minFreeDiskBytes)return 'LOW_DISK';
  if(v('temperatureC')!==null&&v('temperatureC')>limits.maxTemperatureC)return 'TEMPERATURE_LIMIT';
  if(v('appMemoryBytes')!==null&&first?.metrics.appMemoryBytes.value!==null&&first?.metrics.appMemoryBytes.value!==undefined&&v('appMemoryBytes')-first.metrics.appMemoryBytes.value>limits.maxMemoryGrowthBytes)return 'MEMORY_GROWTH';
  return null;
}
