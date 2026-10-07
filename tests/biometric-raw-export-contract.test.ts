// Current backend services with a synthetic in-memory database seam and mocked transport.
// This is not SQLite, PostgreSQL, deployed ERP, or physical-device acceptance.
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { verifyBiometricRequest, biometricRequestMessage } from "@/lib/biometric-attendance/trust";
import { validateBiometricEnvelope, biometricEventIdentity } from "@/lib/biometric-attendance/contracts";
import { ingestBiometricBatch } from "@/lib/biometric-attendance/ingestion";
import { registerBiometricDevice, transitionBiometricDevice } from "@/lib/biometric-attendance/governance";
import { syncPreparedBatch, validateAcknowledgement } from "../apps/nalanda-biometric-bridge/src/sync";
import { setRuntimeSecrets } from "../apps/nalanda-biometric-bridge/src/runtime-secrets";
import { parseExport } from "../apps/nalanda-biometric-bridge/src/export-profile";
import { id, profile } from "../apps/nalanda-biometric-bridge/src/export-test-fixtures";
import type { BridgeConfig } from "../apps/nalanda-biometric-bridge/src/contracts";

const fixture=vi.hoisted(()=>({db:{} as any}));
vi.mock("@/lib/prisma",()=>({get prisma(){return fixture.db;}}));
vi.mock("@prisma/client",()=>({Prisma:{PrismaClientKnownRequestError:class extends Error{code="P2002";}}}));
const now=new Date("2026-10-04T13:00:00.000Z"),pair=generateKeyPairSync("ed25519");
let bridge:any,device:any,batches:Map<string,any>,punches:Map<string,any>,nonces:Set<string>;
const config:BridgeConfig={bridgeId:id,erpUrl:"https://synthetic.invalid",privateKeyPath:"unused",queuePath:"unused",healthPath:"unused",pollIntervalMs:5000,syntheticOnly:true,transportEnabled:true,devices:[]};
beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),signingKey:pair.privateKey.export({format:"jwk"}),keyVersion:1});
  bridge={id:"synthetic-bridge",publicBridgeId:id,status:"ACTIVE",keyVersion:1,keyAlgorithm:"ED25519",publicSigningKey:JSON.stringify(pair.publicKey.export({format:"jwk"})),lastEventAt:null};
  device={id:"synthetic-device",publicDeviceId:id,bridgeId:bridge.id,status:"ACTIVE",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1",protocolProofStatus:"ADAPTER_CONTRACT_APPROVED",sequenceEpoch:1,lastSequence:null,lastEventAt:null,lastSyncAt:null,clockDriftSeconds:null,clockDriftStatus:"UNKNOWN",version:1};
  batches=new Map();punches=new Map();nonces=new Set();
  const db:any={biometricBridge:{findUnique:vi.fn(async()=>bridge),update:vi.fn(async()=>bridge)},biometricDevice:{findMany:vi.fn(async()=>[device]),findUnique:vi.fn(async()=>({...device,bridge})),create:vi.fn(async({data}:any)=>{device={...device,...data,status:"PENDING_APPROVAL",version:1};return device;}),updateMany:vi.fn(async({where,data}:any)=>{if((where.status&&where.status!==device.status)||(where.version&&where.version!==device.version))return {count:0};device={...device,...data,version:data.version?.increment?device.version+data.version.increment:device.version};return {count:1};})},biometricIngestBatch:{count:vi.fn(async()=>0),findUnique:vi.fn(async({where}:any)=>batches.get(where.bridgeId_batchReference.batchReference)??null),create:vi.fn(async({data}:any)=>{const v={...data,id:"synthetic-batch"};batches.set(data.batchReference,v);return v;}),update:vi.fn(async()=>({}))},biometricRawPunch:{findUnique:vi.fn(async({where}:any)=>punches.get(where.eventIdentityHash)??null),create:vi.fn(async({data}:any)=>{punches.set(data.eventIdentityHash,{...data,id:"synthetic-punch"});return data;})},biometricStaffMapping:{findMany:vi.fn(async()=>[])},biometricReplayNonce:{deleteMany:vi.fn(async()=>({count:0})),create:vi.fn(async({data}:any)=>{if(nonces.has(data.nonceHash)){const {Prisma}=await import("@prisma/client");throw new (Prisma.PrismaClientKnownRequestError as any)();}nonces.add(data.nonceHash);return data;})},biometricAuditEvent:{create:vi.fn(async()=>({}))}};
  db.$transaction=async(fn:any)=>fn(db);fixture.db=db;
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),keyVersion:1});});
function exportBody(){
  const p={...profile(),schemaVersion:2 as const,terminalField:"ALLOW_ONE_EMPTY_TAB_V1" as const,header:false,separator:"\t" as const,extensions:[".dat" as const]};
  const input=Buffer.from("0007\t2026-10-02 09:00:00\tSYN-LOCAL-01\tIN\t\r\n");
  const parsed=parseExport(input,p,id,now.toISOString());expect(parsed.rows[0].rejection).toBeUndefined();
  return JSON.stringify({schemaVersion:1,batchReference:"synthetic-export-batch",bridgeTime:now.toISOString(),events:parsed.rows.map(r=>r.event)});
}
async function send(body:string,receive:(request:Request,body:string)=>Promise<Response>){vi.stubGlobal("fetch",async(url:string,init:RequestInit)=>receive(new Request(url,init),String(init.body)));return syncPreparedBatch(config,{reference:JSON.parse(body).batchReference,body,identities:["synthetic"],attempts:0,nextAttemptAt:0});}
const receive=async(request:Request,body:string)=>Response.json(await ingestBiometricBatch({rawBody:body,envelope:validateBiometricEnvelope(JSON.parse(body),now),verified:await verifyBiometricRequest(request,body)}),{status:202});
it("registers the ordinary export profile pending contract proof and keeps approval fail-closed",async()=>{
  const registered=await registerBiometricDevice({bridgeId:bridge.id,protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1",vendor:"Synthetic",model:"Synthetic file route",campus:"Synthetic campus",location:"Synthetic fixture"},"synthetic-actor");
  expect(registered).toMatchObject({status:"PENDING_APPROVAL",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1",protocolProofStatus:"ADAPTER_CONTRACT_PENDING",profileStatus:{ingestionAllowed:false,hardwareCertified:false}});
  await expect(transitionBiometricDevice(device.id,"APPROVE","synthetic-approver")).rejects.toThrow("BIOMETRIC_GENERIC_ADAPTER_CONTRACT_NOT_APPROVED");
  await expect(transitionBiometricDevice(device.id,"VERIFY_PROTOCOL","synthetic-approver","")).rejects.toThrow();
  await transitionBiometricDevice(device.id,"VERIFY_PROTOCOL","synthetic-approver","synthetic-reviewed-file-contract");
  expect(device.protocolProofStatus).toBe("ADAPTER_CONTRACT_APPROVED");expect(device.status).toBe("PENDING_APPROVAL");
  await transitionBiometricDevice(device.id,"APPROVE","synthetic-approver");expect(device.status).toBe("ACTIVE");
  expect(fixture.db.biometricAuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({eventType:"DEVICE_GENERIC_ADAPTER_CONTRACT_APPROVED"})}));
});
it("connects terminal-tab parser, exact companion signature, current service storage, replay and acknowledgement",async()=>{
  const body=exportBody(),envelope=validateBiometricEnvelope(JSON.parse(body),now),identity=biometricEventIdentity(envelope.events[0]);
  expect(await send(body,receive)).toMatchObject({duplicate:false});expect(punches.size).toBe(1);expect(punches.has(identity)).toBe(true);
  const punch=punches.get(identity);expect(punch).toMatchObject({opaqueDeviceUserId:"0007",verificationMethod:"OTHER",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1",punchCode:"IN"});
  expect(punch.punchTimestamp.toISOString()).toBe("2026-10-02T03:30:00.000Z");expect(punch.bridgeReceivedTimestamp.toISOString()).toBe(now.toISOString());
  expect(await send(body,receive)).toMatchObject({duplicate:true});expect(punches.size).toBe(1);expect(nonces.size).toBe(2);
  const changed=JSON.parse(body);changed.events[0].punchCode="OUT";
  await expect(send(JSON.stringify(changed),receive)).rejects.toThrow("BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED");
  changed.batchReference="synthetic-other-batch";
  await expect(send(JSON.stringify(changed),receive)).rejects.toThrow("BIOMETRIC_CHANGED_EVENT_REPLAY_REJECTED");
  expect(()=>validateAcknowledgement({schemaVersion:1,batchReference:envelope.batchReference,status:"ACCEPTED",accepted:0,duplicates:0,exceptions:0,serverTime:now.toISOString()},envelope.batchReference,1)).toThrow("BRIDGE_ACK_INVALID");
});
it.each([
  ["unregistered","BIOMETRIC_DEVICE_NOT_REGISTERED"],
  ["pending","BIOMETRIC_DEVICE_NOT_ACTIVE"],
  ["revoked","BIOMETRIC_DEVICE_REVOKED"],
  ["unapproved-contract","BIOMETRIC_GENERIC_ADAPTER_CONTRACT_NOT_APPROVED"],
  ["wrong-profile","BIOMETRIC_DEVICE_PROFILE_MISMATCH"],
  ["wrong-bridge","BIOMETRIC_DEVICE_NOT_REGISTERED"]
])("refuses %s export registration before storing invented source rows",async(kind,reason)=>{
  if(kind==="unregistered")device.publicDeviceId="00000000-0000-4000-8000-000000000099";
  if(kind==="pending")device.status="PENDING_APPROVAL";
  if(kind==="revoked")device.status="REVOKED";
  if(kind==="unapproved-contract")device.protocolProofStatus="NOT_REQUIRED";
  if(kind==="wrong-profile")device.protocolProfile="SIMULATOR";
  if(kind==="wrong-bridge")device.bridgeId="synthetic-other-bridge";
  await expect(send(exportBody(),receive)).rejects.toThrow(reason);expect(punches.size).toBe(0);expect(batches.size).toBe(0);
});
it("refuses forged signatures, changed signed bodies and changed signature targets",async()=>{
  const body=exportBody();
  await expect(send(body,async(request,raw)=>{
    expect(biometricRequestMessage({method:"POST",path:"/api/biometric/ingest",timestamp:request.headers.get("x-nalanda-biometric-timestamp")!,nonce:request.headers.get("x-nalanda-biometric-nonce")!,bodyHash:request.headers.get("x-nalanda-biometric-body-sha256")!,publicBridgeId:id,keyVersion:1,schemaVersion:1}).split("\n")).toHaveLength(9);
    const headers=new Headers(request.headers);headers.set("x-nalanda-biometric-signature",Buffer.alloc(64,1).toString("base64url"));
    await expect(verifyBiometricRequest(new Request(request.url,{method:"POST",headers}),raw)).rejects.toThrow("BIOMETRIC_BRIDGE_PROOF_INVALID");
    await expect(verifyBiometricRequest(request,raw+" ")).rejects.toThrow("BIOMETRIC_BODY_HASH_MISMATCH");
    await expect(verifyBiometricRequest(new Request(request.url+"?changed=1",{method:"POST",headers:request.headers}),raw)).rejects.toThrow("BIOMETRIC_BRIDGE_PROOF_INVALID");
    return Response.json({code:"SYNTHETIC_NEGATIVE_ACK"},{status:409});
  })).rejects.toThrow("BRIDGE_SYNC_REJECTED:SYNTHETIC_NEGATIVE_ACK");expect(punches.size).toBe(0);
});
it("retains nonce replay and actual freshness boundaries without retimestamping punches",async()=>{
  const body=exportBody();let proof:any;
  await send(body,async(request,raw)=>{proof=await verifyBiometricRequest(request,raw);return Response.json(await ingestBiometricBatch({rawBody:raw,envelope:validateBiometricEnvelope(JSON.parse(raw),now),verified:proof}),{status:202});});
  await expect(ingestBiometricBatch({rawBody:body,envelope:validateBiometricEnvelope(JSON.parse(body),now),verified:proof})).rejects.toThrow("BIOMETRIC_NONCE_REPLAYED");
  const boundary=JSON.parse(body), old48=new Date(now.getTime()-48*3600000).toISOString();boundary.bridgeTime=old48;boundary.events[0].bridgeReceivedTimestamp=old48;boundary.events[0].punchTimestamp=new Date(now.getTime()-370*86400000).toISOString();
  expect(validateBiometricEnvelope(boundary,now).events).toHaveLength(1);
  boundary.bridgeTime=new Date(Date.parse(old48)-1).toISOString();expect(()=>validateBiometricEnvelope(boundary,now)).toThrow("BIOMETRIC_BRIDGE_TIME_INVALID");boundary.bridgeTime=old48;
  boundary.events[0].bridgeReceivedTimestamp=new Date(Date.parse(old48)-1).toISOString();expect(()=>validateBiometricEnvelope(boundary,now)).toThrow("BIOMETRIC_BRIDGE_RECEIVED_TIMESTAMP_INVALID");boundary.events[0].bridgeReceivedTimestamp=old48;
  boundary.events[0].punchTimestamp=new Date(now.getTime()-370*86400000-1).toISOString();expect(()=>validateBiometricEnvelope(boundary,now)).toThrow("BIOMETRIC_PUNCH_TIMESTAMP_INVALID");
  await expect(send(body,async(request,raw)=>{vi.setSystemTime(new Date(now.getTime()+5*60000));await expect(verifyBiometricRequest(request,raw)).resolves.toBeDefined();vi.setSystemTime(new Date(now.getTime()+5*60000+1));await expect(verifyBiometricRequest(request,raw)).rejects.toThrow("BIOMETRIC_BRIDGE_PROOF_EXPIRED");return Response.json({code:"SYNTHETIC_FRESHNESS_TEST"},{status:409});})).rejects.toThrow("BRIDGE_SYNC_REJECTED:SYNTHETIC_FRESHNESS_TEST");
});
