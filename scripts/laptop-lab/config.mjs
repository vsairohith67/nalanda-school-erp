import { createHash } from 'node:crypto';

export const SOURCE = 'baa49c738e009f99c5e741a04bc3fe8f8862a848';
export const TREE = 'ee2b3a2f9eb3a5b45d456eb54547a983ab5991dd';
export const TARGET = 'memory://nps-d1p-fixture';
export const SUBJECT = createHash('sha256').update('NPS-D1P-INVENTED-FIXTURE-v1').digest('hex');
export const OPERATIONS = Object.freeze({
  certificate_list: { method: 'GET', route: '/api/certificates/requests', mutation: false },
  certificate_request: { method: 'POST', route: '/api/certificates/requests', mutation: true },
});
export const fail = code => { throw new Error(code); };
export const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const exact = (o, keys) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join() === [...keys].sort().join();
const bounded = (n, min, max) => Number.isFinite(n) && n >= min && n <= max;
export function validateConfig(raw) {
  if (!exact(raw, ['version','source','tree','subject','target','profile','scenario','virtualUsers','maxInFlight','arrivalPerSecond','thinkMs','durationMs','timeoutMs','maxActions','mix','limits'])) fail('CONFIG_INVALID');
  const connected=raw.profile==='local-synthetic-http';
  if (raw.version !== 1 || (connected?!/^[a-f0-9]{40}$/.test(raw.source)||!/^[a-f0-9]{40}$/.test(raw.tree)||!/^[a-f0-9]{64}$/.test(raw.subject):raw.source!==SOURCE||raw.tree!==TREE||raw.subject!==SUBJECT)) fail('SOURCE_SUBJECT_MISMATCH');
  if (raw.target !== (connected?'https://portable-staging.localhost:8443':TARGET)) fail('TARGET_NOT_PERMITTED');
  if (!['in-memory-harness','local-synthetic-http'].includes(raw.profile)) fail('PROFILE_NOT_PERMITTED');
  if (!['read-only','disposable-mutation'].includes(raw.scenario)) fail('SCENARIO_INVALID');
  for (const [key,min,max] of [['virtualUsers',1,50],['maxInFlight',1,8],['thinkMs',1,10000],['durationMs',10,10000],['timeoutMs',1,2000],['maxActions',1,250]]) {
    if (!Number.isInteger(raw[key]) || !bounded(raw[key],min,max)) fail('BOUND_INVALID');
  }
  if (raw.maxInFlight > raw.virtualUsers || !bounded(raw.arrivalPerSecond,0.1,100)) fail('BOUND_INVALID');
  if (!Array.isArray(raw.mix) || !raw.mix.length || raw.mix.length > 2 || new Set(raw.mix.map(x=>x?.operation)).size !== raw.mix.length) fail('MIX_INVALID');
  for (const item of raw.mix) {
    if (!exact(item,['operation','weight']) || !Object.hasOwn(OPERATIONS,item.operation) || !Number.isInteger(item.weight) || !bounded(item.weight,1,100)) fail('MIX_INVALID');
    if (raw.scenario === 'read-only' && OPERATIONS[item.operation].mutation) fail('MUTATION_REFUSED');
  }
  const l=raw.limits;
  if (!exact(l,['consecutiveErrors','minFreeMemoryBytes','minFreeDiskBytes','maxMemoryGrowthBytes','maxTemperatureC'])) fail('LIMITS_INVALID');
  if (!Number.isInteger(l.consecutiveErrors) || !bounded(l.consecutiveErrors,1,20) || !bounded(l.minFreeMemoryBytes,1,2**50) || !bounded(l.minFreeDiskBytes,1,2**50) || !bounded(l.maxMemoryGrowthBytes,1,2**50) || !bounded(l.maxTemperatureC,40,100)) fail('LIMITS_INVALID');
  return structuredClone(raw);
}
// Configuration validation grants no runtime authority. The connected CLI
// independently qualifies the producer and enforces both source policy holds.
export function preflight(raw, { expectedConfigHash, expectedSource = SOURCE } = {}) {
  const config = validateConfig(raw);
  if (expectedSource !== config.source || expectedConfigHash !== hash(config)) fail('CONFIG_IDENTITY_MISMATCH');
  return { config, configHash: hash(config), evidence: 'HARNESS_ONLY', artifact: null, runtimePermission: false };
}
export function runtimePreflight() { fail('LAPTOP_CONSUMER_NOT_ADMITTED_USE_EXISTING_PORTABLE_OWNER'); }
export function exampleConfig(scenario = 'read-only') {
  return { version:1, source:SOURCE, tree:TREE, subject:SUBJECT, target:TARGET, profile:'in-memory-harness', scenario,
    virtualUsers:2,maxInFlight:2,arrivalPerSecond:20,thinkMs:100,durationMs:1000,timeoutMs:150,maxActions:12,
    mix: scenario === 'read-only' ? [{operation:'certificate_list',weight:1}] : [{operation:'certificate_list',weight:4},{operation:'certificate_request',weight:1}],
    limits:{consecutiveErrors:3,minFreeMemoryBytes:512*2**20,minFreeDiskBytes:2**30,maxMemoryGrowthBytes:512*2**20,maxTemperatureC:85} };
}
