import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { verifyBiometricRequest, biometricRequestMessage } from "../contract-fixture/lib/biometric-attendance/trust";
import { validateBiometricEnvelope, biometricEventIdentity } from "../contract-fixture/lib/biometric-attendance/contracts";
import { ingestBiometricBatch } from "../contract-fixture/lib/biometric-attendance/ingestion";
import { registerBiometricDevice } from "../contract-fixture/lib/biometric-attendance/governance";
import { syncPreparedBatch, validateAcknowledgement } from "./sync.js";
import { setRuntimeSecrets } from "./runtime-secrets.js";
import { parseExport } from "./export-profile.js";
import { bytes, id, profile } from "./export-test-fixtures.js";
import type { BridgeConfig } from "./contracts.js";

const fixture=vi.hoisted(()=>({db:{} as any}));
vi.mock("@/lib/prisma",()=>({get prisma(){return fixture.db;}}));
vi.mock("@/lib/biometric-attendance/feature-flag",()=>({BIOMETRIC_SCHEMA_VERSION:1}));
vi.mock("@prisma/client",()=>({Prisma:{PrismaClientKnownRequestError:class extends Error{code="P2002";}}}));
const now=new Date("2026-10-04T13:00:00.000Z"),pair=generateKeyPairSync("ed25519");
let bridge:any,device:any,batches:Map<string,any>,punches:Map<string,any>,nonces:Set<string>;
const config:BridgeConfig={bridgeId:id,erpUrl:"https://synthetic.invalid",privateKeyPath:"unused",queuePath:"unused",healthPath:"unused",pollIntervalMs:5000,syntheticOnly:true,transportEnabled:true,devices:[]};
beforeEach(()=>{
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),signingKey:pair.privateKey.export({format:"jwk"}),keyVersion:1});
  bridge={id:"synthetic-bridge",publicBridgeId:id,status:"ACTIVE",keyVersion:1,keyAlgorithm:"ED25519",publicSigningKey:JSON.stringify(pair.publicKey.export({format:"jwk"})),lastEventAt:null};
  device={id:"synthetic-device",publicDeviceId:id,bridgeId:bridge.id,status:"ACTIVE",protocolProfile:"SIMULATOR",protocolProofStatus:"NOT_PROVIDED",sequenceEpoch:1,lastSequence:null,lastEventAt:null,lastSyncAt:null,clockDriftSeconds:null,clockDriftStatus:"UNKNOWN",version:1};
  batches=new Map();punches=new Map();nonces=new Set();
  const db:any={biometricBridge:{findUnique:vi.fn(async()=>bridge),update:vi.fn(async()=>bridge)},biometricDevice:{findMany:vi.fn(async()=>[device]),findUnique:vi.fn(async()=>device),updateMany:vi.fn(async()=>({count:1}))},biometricIngestBatch:{count:vi.fn(async()=>0),findUnique:vi.fn(async({where}:any)=>batches.get(where.bridgeId_batchReference.batchReference)??null),create:vi.fn(async({data}:any)=>{const v={...data,id:"synthetic-batch"};batches.set(data.batchReference,v);return v;}),update:vi.fn(async()=>({}))},biometricRawPunch:{findUnique:vi.fn(async({where}:any)=>punches.get(where.eventIdentityHash)??null),create:vi.fn(async({data}:any)=>{punches.set(data.eventIdentityHash,{...data,id:"synthetic-punch"});return data;})},biometricStaffMapping:{findMany:vi.fn(async()=>[])},biometricReplayNonce:{deleteMany:vi.fn(async()=>({count:0})),create:vi.fn(async({data}:any)=>{if(nonces.has(data.nonceHash)){const {Prisma}=await import("@prisma/client");throw new (Prisma.PrismaClientKnownRequestError as any)();}nonces.add(data.nonceHash);return data;})},biometricAuditEvent:{create:vi.fn(async()=>({}))}};
  db.$transaction=async(fn:any)=>fn(db);fixture.db=db;
});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),keyVersion:1});});
function exportBody(){return JSON.stringify({schemaVersion:1,batchReference:"synthetic-export-batch",bridgeTime:now.toISOString(),events:parseExport(bytes(),profile(),id,now.toISOString()).rows.map(r=>r.event)});}
function simulatorBody(){const event={deviceId:id,opaqueDeviceUserId:"SYNTHETIC-CONTROL",punchTimestamp:now.toISOString(),bridgeReceivedTimestamp:now.toISOString(),estimatedClockDriftSeconds:null,verificationMethod:"OTHER",punchCode:"IN",statusCode:null,sequenceNumber:null,sequenceEpoch:1,eventReference:"synthetic-control-1",protocolProfile:"SIMULATOR"};return JSON.stringify({schemaVersion:1,batchReference:"synthetic-simulator-control",bridgeTime:now.toISOString(),events:[event]});}
async function send(body:string,receive:(request:Request,body:string)=>Promise<Response>){vi.stubGlobal("fetch",async(url:string,init:RequestInit)=>receive(new Request(url,init),String(init.body)));return syncPreparedBatch(config,{reference:JSON.parse(body).batchReference,body,identities:["synthetic"],attempts:0,nextAttemptAt:0});}
it("qualifies immutable published source bytes, not an older root or reconstructed receiver",()=>{
  const manifest=JSON.parse(readFileSync(new URL("../contract-fixture/manifest.json",import.meta.url),"utf8"));expect(manifest.source).toBe("2113fa17bcda1acfb3edf5fa0d6ca9c2a21e8c7c");
  for(const f of manifest.files){const b=readFileSync(new URL(`../contract-fixture/${f.path}`,import.meta.url));expect(createHash("sha256").update(b).digest("hex")).toBe(f.sha256);const header=Buffer.from(`blob ${b.length}\0`);expect(createHash("sha1").update(header).update(b).digest("hex")).toBe(f.blob);}
});
it("actual signature verifier accepts exact companion subject, then actual envelope and registration refuse the export profile",async()=>{
  const body=exportBody();await expect(send(body,async(request,raw)=>{expect(raw).toBe(body);const proof=await verifyBiometricRequest(request,raw);expect(proof.bridge).toBe(bridge);expect(()=>validateBiometricEnvelope(JSON.parse(raw),now)).toThrow("BIOMETRIC_PROTOCOL_PROFILE_INVALID");return Response.json({code:"BIOMETRIC_PROTOCOL_PROFILE_INVALID"},{status:400});})).rejects.toThrow("BRIDGE_SYNC_REJECTED:BIOMETRIC_PROTOCOL_PROFILE_INVALID");
  await expect(registerBiometricDevice({bridgeId:"synthetic-bridge",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1"},"synthetic-actor")).rejects.toThrow("BIOMETRIC_PROTOCOL_PROFILE_INVALID");expect(punches.size).toBe(0);
});
it("signature subject binds body, path, schema, bridge and key version",async()=>{
  const body=exportBody();await expect(send(body,async(request,raw)=>{expect(biometricRequestMessage({method:"POST",path:"/api/biometric/ingest",timestamp:request.headers.get("x-nalanda-biometric-timestamp")!,nonce:request.headers.get("x-nalanda-biometric-nonce")!,bodyHash:request.headers.get("x-nalanda-biometric-body-sha256")!,publicBridgeId:id,keyVersion:1,schemaVersion:1}).split("\n")).toHaveLength(9);
    const altered=new Request("https://synthetic.invalid/api/biometric/ingest?changed=1",{method:"POST",headers:request.headers});await expect(verifyBiometricRequest(altered,raw)).rejects.toThrow("BIOMETRIC_BRIDGE_PROOF_INVALID");await expect(verifyBiometricRequest(request,raw+" ")).rejects.toThrow("BIOMETRIC_BODY_HASH_MISMATCH");return Response.json({code:"SYNTHETIC_NEGATIVE_ACK"},{status:409});})).rejects.toThrow("BRIDGE_SYNC_REJECTED:SYNTHETIC_NEGATIVE_ACK");
});
it("actual service executes a separately labelled simulator control with replay, nonce and complete ACK semantics",async()=>{
  const raw=simulatorBody(),envelope=validateBiometricEnvelope(JSON.parse(raw),now),bodyIdentity=biometricEventIdentity(envelope.events[0]);
  let firstProof:any;
  const receive=async(request:Request,body:string)=>{const verified=await verifyBiometricRequest(request,body);firstProof??=verified;return Response.json(await ingestBiometricBatch({rawBody:body,envelope:validateBiometricEnvelope(JSON.parse(body),now),verified}),{status:202});};
  expect(await send(raw,receive)).toMatchObject({duplicate:false});expect(punches.size).toBe(1);expect(punches.has(bodyIdentity)).toBe(true);expect(await send(raw,receive)).toMatchObject({duplicate:true});expect(punches.size).toBe(1);expect(nonces.size).toBe(2);
  await expect(ingestBiometricBatch({rawBody:raw,envelope,verified:firstProof})).rejects.toThrow("BIOMETRIC_NONCE_REPLAYED");expect(punches.size).toBe(1);
  const changed=JSON.parse(raw);changed.events[0].punchCode="OUT";await expect(send(JSON.stringify(changed),receive)).rejects.toThrow("BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED");
  expect(()=>validateAcknowledgement({schemaVersion:1,batchReference:envelope.batchReference,status:"ACCEPTED",accepted:0,duplicates:0,exceptions:0,serverTime:now.toISOString()},envelope.batchReference,1)).toThrow("BRIDGE_ACK_INVALID");
});
it("48-hour boundary is bridgeTime and bridgeReceivedTimestamp, while punch age is 370 days and proof freshness five minutes",async()=>{
  const root=JSON.parse(simulatorBody()),old48=new Date(now.getTime()-48*3600000).toISOString();root.bridgeTime=old48;root.events[0].bridgeReceivedTimestamp=old48;root.events[0].punchTimestamp=new Date(now.getTime()-370*86400000).toISOString();expect(validateBiometricEnvelope(root,now).events).toHaveLength(1);
  root.bridgeTime=new Date(Date.parse(old48)-1).toISOString();expect(()=>validateBiometricEnvelope(root,now)).toThrow("BIOMETRIC_BRIDGE_TIME_INVALID");root.bridgeTime=old48;root.events[0].bridgeReceivedTimestamp=new Date(Date.parse(old48)-1).toISOString();expect(()=>validateBiometricEnvelope(root,now)).toThrow("BIOMETRIC_BRIDGE_RECEIVED_TIMESTAMP_INVALID");root.events[0].bridgeReceivedTimestamp=old48;root.events[0].punchTimestamp=new Date(now.getTime()-370*86400000-1).toISOString();expect(()=>validateBiometricEnvelope(root,now)).toThrow("BIOMETRIC_PUNCH_TIMESTAMP_INVALID");
  await expect(send(simulatorBody(),async(request,raw)=>{vi.setSystemTime(new Date(now.getTime()+5*60000));await expect(verifyBiometricRequest(request,raw)).resolves.toBeDefined();vi.setSystemTime(new Date(now.getTime()+5*60000+1));await expect(verifyBiometricRequest(request,raw)).rejects.toThrow("BIOMETRIC_BRIDGE_PROOF_EXPIRED");return Response.json({code:"SYNTHETIC_FRESHNESS_TEST"},{status:409});})).rejects.toThrow("BRIDGE_SYNC_REJECTED:SYNTHETIC_FRESHNESS_TEST");
});
it("actual service rejects mismatched device binding without recording source rows",async()=>{
  const envelope=validateBiometricEnvelope(JSON.parse(simulatorBody()),now);device.publicDeviceId="00000000-0000-4000-8000-000000000099";
  await expect(ingestBiometricBatch({envelope,rawBody:simulatorBody(),verified:{bridge,nonceHash:"a".repeat(64),keyVersion:1,nonceExpiresAt:now}})).rejects.toThrow("BIOMETRIC_DEVICE_NOT_REGISTERED");expect(punches.size).toBe(0);
});
