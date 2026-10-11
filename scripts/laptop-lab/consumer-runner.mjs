import { exampleConfig, preflight, hash } from './config.mjs';
import { runScenario } from './runner.mjs';
import { reports } from './report.mjs';

export function scheduleFor(scope) {
  const config=exampleConfig(scope.scenario);
  config.mix=config.mix.filter(item=>scope.operations.includes(item.operation));
  return preflight(config,{expectedConfigHash:hash(config)}).config;
}
// Both paths use the original scheduler, correctness checks and report writer.
// A virtual service double stays explicitly synthetic; it cannot become ERP evidence.
export async function runConnectedScenario(scope,adapter,connection,signal) {
  const actual=adapter.classification==='AUTHENTICATED_ERP';
  if(!actual&&adapter.classification!=='SIMULATED_SERVICE')throw Error('REAL_OPERATION_ADAPTER_UNAVAILABLE');
  if(connection.mode==='HARNESS_ONLY'&&(adapter.clock.kind!=='VIRTUAL'||actual&&adapter.measurement!=='CONTROLLED_TRANSPORT'))throw Error('CONTROLLED_MEASUREMENT_REQUIRED');
  if(connection.mode==='REAL'&&(!actual||adapter.clock.kind!=='MONOTONIC_WALL'||adapter.measurement!=='BOUND_HTTP'))throw Error('REAL_MEASUREMENT_ADAPTER_REQUIRED');
  const config=scheduleFor(scope);
  // Global certificate GET and non-idempotent POST require serial readback.
  // Keep the original scheduler; do not advertise concurrent mutation coverage.
  if(actual)Object.assign(config,{virtualUsers:1,maxInFlight:1,durationMs:2000});
  if(connection.mode==='REAL'){
    if(!adapter.binding||adapter.binding.source!==connection.producerSource)throw Error('CERTIFICATE_SOURCE_BINDING_REQUIRED');
    Object.assign(config,{source:connection.producerSource,tree:connection.producerTree,subject:adapter.binding.subjectSha256,target:scope.origin,profile:'local-synthetic-http',durationMs:10000,timeoutMs:Math.min(scope.phaseTimeoutMs,2000)});
  }
  const result=await adapter.drive(runScenario(config,{...adapter,identity:{expectedConfigHash:hash(config),expectedSource:config.source},signal}));
  return reports({...result,connection});
}
