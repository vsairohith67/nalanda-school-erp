import { loadBridgeConfig } from "./config.js";
import { EncryptedDurableQueue } from "./encrypted-queue.js";
import { GenericCsvAdapter } from "./adapters/csv.js";
import { SimulatorAdapter } from "./adapters/simulator.js";
import { VendorProtocolDisabledAdapter } from "./adapters/vendor-disabled.js";
import { GenericContractPendingAdapter } from "./adapters/generic-pending.js";
import type { DeviceAdapter } from "./adapters/adapter.js";
import { GENERIC_PENDING_PROFILES, validateNormalizedEvent, type Profile } from "./contracts.js";
import { syncQueuedEvents } from "./sync.js";
import { writeLocalHealth } from "./health.js";

export async function runBridgeCycle() {
  const config=loadBridgeConfig(),queue=new EncryptedDurableQueue(config.queuePath);let lastErrorCode:string|undefined;
  for(const device of config.devices){try{const adapter=adapterFor(device.profile);const normalized=(await adapter.poll(device)).map(validateNormalizedEvent);const events=normalized.map(event=>({...event,queuedAt:event.bridgeReceivedTimestamp,localState:"RECEIVED_FROM_DEVICE" as const,attemptCount:0}));if(events.length){queue.append(events);await adapter.acknowledgePoll?.(device,normalized);}}catch(error){lastErrorCode=safeCode(error);}}
  let lastSyncAt:string|undefined;const batch=queue.peek(100);if(batch.length){queue.markSending(batch.length);try{const result=await syncQueuedEvents(config,batch);queue.acknowledge(batch.length,(result as {status?:string}).status==="DUPLICATE_ACCEPTED");lastSyncAt=new Date().toISOString();}catch(error){lastErrorCode=safeCode(error);queue.markSendFailed(batch.length,lastErrorCode);}}
  writeLocalHealth(config.healthPath,{status:lastErrorCode?"DEGRADED":"HEALTHY",queueDepth:queue.size(),configuredDevices:config.devices.length,lastPollAt:new Date().toISOString(),lastSyncAt,lastErrorCode});return{queueDepth:queue.size(),lastErrorCode};
}
function adapterFor(profile:Profile):DeviceAdapter{if(profile==="SIMULATOR")return new SimulatorAdapter();if(profile==="GENERIC_CSV_IMPORT")return new GenericCsvAdapter();if(GENERIC_PENDING_PROFILES.has(profile))return new GenericContractPendingAdapter(profile);return new VendorProtocolDisabledAdapter(profile);}
function safeCode(error:unknown){const value=error instanceof Error?error.message:"BRIDGE_OPERATION_FAILED";return /^[A-Z0-9_:.-]{3,160}$/.test(value)?value.slice(0,160):"BRIDGE_OPERATION_FAILED";}

async function main(){let stopping=false;process.on("SIGINT",()=>{stopping=true});process.on("SIGTERM",()=>{stopping=true});while(!stopping){const started=Date.now();const config=loadBridgeConfig();await runBridgeCycle();const delay=Math.max(1000,config.pollIntervalMs-(Date.now()-started));await new Promise(resolve=>setTimeout(resolve,delay));}}
if(process.argv[1]&&import.meta.url===new URL(`file:///${process.argv[1].replaceAll("\\","/")}`).href)main().catch(error=>{process.stderr.write(`${safeCode(error)}\n`);process.exitCode=1;});
