import { randomUUID, generateKeyPairSync } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { registerBiometricDevice, transitionBiometricDevice, createBiometricBridge, transitionBiometricBridge } from "@/lib/biometric-attendance/governance";
import { verifyBiometricRequest } from "@/lib/biometric-attendance/trust";
import { validateBiometricEnvelope } from "@/lib/biometric-attendance/contracts";
import { ingestBiometricBatch } from "@/lib/biometric-attendance/ingestion";
import { BIOMETRIC_ATTENDANCE_BACKUP_KEYS, loadBiometricAttendanceBackup, validateBiometricAttendanceBackupRows, restoreBiometricAttendanceBackup } from "@/lib/biometric-attendance/backup";
import { parseExport, type ExportProfile } from "../apps/nalanda-biometric-bridge/src/export-profile";
import { syncPreparedBatch } from "../apps/nalanda-biometric-bridge/src/sync";
import { setRuntimeSecrets } from "../apps/nalanda-biometric-bridge/src/runtime-secrets";
import type { BridgeConfig } from "../apps/nalanda-biometric-bridge/src/contracts";

// Only the dependency binding is substituted: every service uses this actual
// newly allocated Prisma database. No operational lib/prisma client is loaded.
const fixture=vi.hoisted(()=>({db:undefined as PrismaClient|undefined}));
vi.mock("@/lib/prisma",()=>({get prisma(){if(!fixture.db)throw Error("SYNTHETIC_DATABASE_NOT_READY");return fixture.db;}}));
const postgres=process.env.DATABASE_PROVIDER==="postgresql", originalUrl=process.env.DATABASE_URL;
let root:string|undefined, client:PrismaClient|undefined, restoreTarget:PrismaClient|undefined;
const clients:PrismaClient[]=[],ownedSchemas=new Map<PrismaClient,string>();
const pair=generateKeyPairSync("ed25519");
let bridge:any,device:any;
async function database(label:string){
  const directory=path.join(root!,label);await mkdir(directory);
  let url="file:"+path.join(directory,"synthetic.db").replaceAll("\\","/");let db:PrismaClient;
  if(postgres){
    if(process.env.CI!=="true"||process.env.POSTGRES_READINESS_SYNTHETIC_QA!=="1"||!originalUrl)throw Error("EPHEMERAL_CI_POSTGRES_REQUIRED");
    const ownedSchema="biometric_export_"+randomUUID().replaceAll("-","");const connection=new URL(originalUrl);connection.searchParams.set("schema",ownedSchema);url=connection.toString();
    db=new PrismaClient({datasourceUrl:url});clients.push(db);ownedSchemas.set(db,ownedSchema);
    execFileSync(process.execPath,["node_modules/prisma/build/index.js","migrate","deploy","--schema","prisma/postgresql/schema.prisma"],{env:{...process.env,DATABASE_URL:url,DIRECT_URL:url},stdio:"pipe",windowsHide:true,timeout:60000});
  }else{
    const file=path.join(directory,"synthetic.db");await writeFile(file,"",{flag:"wx",mode:0o600});const sql=new DatabaseSync(file);
    try{for(const migration of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()).map(e=>e.name).sort())sql.exec(readFileSync(path.join("prisma/migrations",migration,"migration.sql"),"utf8"));expect(sql.prepare("PRAGMA foreign_key_check").all()).toEqual([]);}finally{sql.close();}
    db=new PrismaClient({datasourceUrl:url});clients.push(db);
  }
  return db;
}
beforeAll(async()=>{
  await mkdir(path.resolve("tmp"),{recursive:true});root=await realpath(await mkdtemp(path.resolve("tmp","biometric-export-provider-")));
  client=await database("source");
  fixture.db=client;
  for(const actor of ["synthetic-export-preparer","synthetic-export-approver"])await client.user.create({data:{id:actor,username:actor,name:"SYNTHETIC Export Actor",role:"DIRECTOR",passwordHash:"SYNTHETIC-NONLOGIN",isActive:false}});
  const prepared=await createBiometricBridge({label:"SYNTHETIC raw export bridge",publicSigningKey:pair.publicKey.export({format:"jwk"})},"synthetic-export-preparer");
  await transitionBiometricBridge(prepared.id,"APPROVE","synthetic-export-approver");bridge=await client.biometricBridge.findUniqueOrThrow({where:{id:prepared.id}});
},120000);
// Allocate the independent full-migration target as fixture setup, with the
// same existing provider hook/migration deadlines. Restore assertions remain
// in the test; no service/backup operation is hidden in this hook.
beforeAll(async()=>{restoreTarget=await database("restore-target");},120000);
afterAll(async()=>{
  vi.unstubAllGlobals();fixture.db=undefined;setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),keyVersion:1});
  try{for(const [db,schema] of ownedSchemas){if(!/^biometric_export_[a-f0-9]{32}$/.test(schema))throw Error("SYNTHETIC_SCHEMA_CLEANUP_SCOPE_REFUSED");await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);}}
  finally{await Promise.all(clients.map(db=>db.$disconnect()));if(root){const stat=await lstat(root);expect(stat.isSymbolicLink()).toBe(false);expect(await realpath(root)).toBe(root);expect(path.dirname(root)).toBe(path.resolve("tmp"));expect(path.basename(root).startsWith("biometric-export-provider-")).toBe(true);await rm(root,{recursive:true});}}
});
it("actual isolated provider enforces raw-route proof approval then stores signed invented observations and replay ACK",async()=>{
  const db=client!;
  const prepared=await registerBiometricDevice({bridgeId:bridge.id,vendor:"SYNTHETIC",model:"SYNTHETIC manual-file route",campus:"SYNTHETIC",location:"SYNTHETIC",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1"},"synthetic-export-preparer");
  expect(prepared).toMatchObject({status:"PENDING_APPROVAL",protocolProofStatus:"ADAPTER_CONTRACT_PENDING",profileStatus:{ingestionAllowed:false,hardwareCertified:false}});
  await expect(transitionBiometricDevice(prepared.id,"APPROVE","synthetic-export-approver")).rejects.toThrow("BIOMETRIC_GENERIC_ADAPTER_CONTRACT_NOT_APPROVED");
  expect(await db.biometricRawPunch.count()).toBe(0);
  await transitionBiometricDevice(prepared.id,"VERIFY_PROTOCOL","synthetic-export-approver","SYNTHETIC reviewed file contract, no physical-device attestation");
  await transitionBiometricDevice(prepared.id,"APPROVE","synthetic-export-approver");device=await db.biometricDevice.findUniqueOrThrow({where:{id:prepared.id}});
  const p:ExportProfile={schemaVersion:2,terminalField:"ALLOW_ONE_EMPTY_TAB_V1",profileId:"synthetic-provider-tab",columns:["Employee code","Punch DateTime","Device Id","Direction"],header:false,separator:"\t",encoding:"utf-8",filenamePrefix:"SYN",extensions:[".dat"],dateFormat:"dd-MMM-yyyy HH:mm:ss",culture:"en-IN",timezone:"Asia/Kolkata",employeeIdentifierKind:"EmployeeCode",localDeviceId:"SYN-LOCAL",approvedMappingReference:"synthetic-only-approved-fixture",employeeMapping:{"SYN-0001":"0001"},directionMapping:{"0":"IN","1":"OUT"}};
  const observedAt=new Date().toISOString(),input=Buffer.from("SYN-0001\t02-Oct-2026 09:00:00\tSYN-LOCAL\t0\t\r\nSYN-0001\t02-Oct-2026 09:00:01\tSYN-LOCAL\t1\t\r\n");
  const parsed=parseExport(input,p,device.publicDeviceId,observedAt);expect(parsed.rows.every(r=>!!r.event)).toBe(true);
  const body=JSON.stringify({schemaVersion:1,batchReference:"synthetic-provider-export",bridgeTime:observedAt,events:parsed.rows.map(r=>r.event)});
  const config:BridgeConfig={bridgeId:bridge.publicBridgeId,erpUrl:"https://synthetic.invalid",privateKeyPath:"unused",queuePath:"unused",healthPath:"unused",pollIntervalMs:5000,syntheticOnly:true,transportEnabled:true,devices:[]};
  setRuntimeSecrets({queueKey:Buffer.alloc(32,7).toString("base64url"),signingKey:pair.privateKey.export({format:"jwk"}),keyVersion:1});
  vi.stubGlobal("fetch",async(url:string,init:RequestInit)=>{const raw=String(init.body),request=new Request(url,init),verified=await verifyBiometricRequest(request,raw);return Response.json(await ingestBiometricBatch({rawBody:raw,envelope:validateBiometricEnvelope(JSON.parse(raw)),verified}),{status:202});});
  const batch={reference:"synthetic-provider-export",body,identities:["synthetic-1","synthetic-2"],attempts:0,nextAttemptAt:0};
  expect(await syncPreparedBatch(config,batch)).toMatchObject({duplicate:false});expect(await db.biometricRawPunch.count()).toBe(2);
  const punches=await db.biometricRawPunch.findMany({orderBy:{punchTimestamp:"asc"}});
  expect(punches.map(r=>r.punchTimestamp.toISOString())).toEqual(["2026-10-02T03:30:00.000Z","2026-10-02T03:30:01.000Z"]);
  expect(punches.map(r=>r.punchCode)).toEqual(["IN","OUT"]);expect(punches.every(r=>r.protocolProfile==="ETIMETRACKLITE_RAW_EXPORT_V1"&&r.verificationMethod==="OTHER"&&r.reconciliationStatus==="UNMAPPED_STAFF")).toBe(true);
  expect(await syncPreparedBatch(config,batch)).toMatchObject({duplicate:true});expect(await db.biometricRawPunch.count()).toBe(2);expect(await db.biometricReplayNonce.count()).toBe(2);
  const changed=JSON.parse(body);changed.events[0].punchCode="OUT";
  await expect(syncPreparedBatch(config,{...batch,body:JSON.stringify(changed)})).rejects.toThrow("BIOMETRIC_CHANGED_BATCH_REPLAY_REJECTED");expect(await db.biometricRawPunch.count()).toBe(2);
  const wrongDevice=JSON.parse(body);wrongDevice.batchReference="synthetic-unregistered-export";wrongDevice.events[0].deviceId=randomUUID();
  await expect(syncPreparedBatch(config,{...batch,reference:wrongDevice.batchReference,body:JSON.stringify(wrongDevice)})).rejects.toThrow("BIOMETRIC_DEVICE_NOT_REGISTERED");
  const wrongProfile=JSON.parse(body);wrongProfile.batchReference="synthetic-wrong-profile";wrongProfile.events[0].protocolProfile="SIMULATOR";
  await expect(syncPreparedBatch(config,{...batch,reference:wrongProfile.batchReference,body:JSON.stringify(wrongProfile)})).rejects.toThrow("BIOMETRIC_DEVICE_PROFILE_MISMATCH");
  expect(await db.biometricRawPunch.count()).toBe(2);expect(await db.biometricIngestBatch.count()).toBe(1);
  // The actual database immutability trigger remains active for this profile.
  await expect(db.biometricRawPunch.update({where:{id:punches[0].id},data:{punchCode:"OUT"}})).rejects.toThrow();
  expect((await db.biometricRawPunch.findUniqueOrThrow({where:{id:punches[0].id}})).punchCode).toBe("IN");
});
it("actual provider guards reject invalid raw-profile states and retain legacy proof requirements",async()=>{
  const db=client!,base={bridgeId:bridge.id,vendor:"SYNTHETIC",model:"SYNTHETIC guard fixture",campus:"SYNTHETIC",location:"SYNTHETIC",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1",protocolProofStatus:"ADAPTER_CONTRACT_PENDING"};
  for(const invalid of [{protocolProofStatus:"NOT_REQUIRED"},{protocolProofStatus:"NOT_PROVIDED"},{protocolProofStatus:"OFFICIAL_VERIFIED"},{protocolProofStatus:"INVALID"},{status:"ACTIVE"},{status:"INVALID"},{clockDriftStatus:"INVALID"},{protocolProfile:"INVALID"}]){
    const before=await db.biometricDevice.count();await expect(db.biometricDevice.create({data:{...base,...invalid}})).rejects.toThrow();expect(await db.biometricDevice.count()).toBe(before);
  }
  await expect(db.biometricDevice.update({where:{id:device.id},data:{protocolProofStatus:"ADAPTER_CONTRACT_PENDING"}})).rejects.toThrow();
  await expect(db.biometricDevice.update({where:{id:device.id},data:{protocolProfile:"GENERIC_LAN_POLL"}})).rejects.toThrow();
  expect(await db.biometricDevice.findUniqueOrThrow({where:{id:device.id}})).toMatchObject({status:"ACTIVE",protocolProofStatus:"ADAPTER_CONTRACT_APPROVED",protocolProfile:"ETIMETRACKLITE_RAW_EXPORT_V1"});
  for(const status of ["REVOKED","RETIRED"]){
    const locked=await db.biometricDevice.create({data:{...base,status,protocolProofStatus:"ADAPTER_CONTRACT_APPROVED"}});
    await expect(db.biometricDevice.update({where:{id:locked.id},data:{status:"PENDING_APPROVAL"}})).rejects.toThrow();
  }
  const legacy=[...["ESSL_K30_PRO_PUSH","ESSL_ZK_LAN_SDK","ZK_ADMS_PUSH"].map(protocolProfile=>({protocolProfile,proof:"OFFICIAL_VERIFIED"})),...["GENERIC_ADMS_PUSH","GENERIC_LAN_POLL"].map(protocolProfile=>({protocolProfile,proof:"ADAPTER_CONTRACT_APPROVED"})),...["GENERIC_CSV_IMPORT","SIMULATOR"].map(protocolProfile=>({protocolProfile,proof:"NOT_REQUIRED"}))];
  for(const {protocolProfile,proof} of legacy){
    await expect(db.biometricDevice.create({data:{...base,protocolProfile,status:"ACTIVE",protocolProofStatus:"INVALID"}})).rejects.toThrow();
    expect(await db.biometricDevice.create({data:{...base,protocolProfile,status:"ACTIVE",protocolProofStatus:proof}})).toMatchObject({protocolProfile,status:"ACTIVE",protocolProofStatus:proof});
  }
});
it("serializes and validates raw-profile backup then restores into an actual fresh fully migrated target",async()=>{
  const backup=validateBiometricAttendanceBackupRows(JSON.parse(JSON.stringify(await loadBiometricAttendanceBackup(client!))));
  expect(backup.biometricDevices.some(d=>d.protocolProfile==="ETIMETRACKLITE_RAW_EXPORT_V1")).toBe(true);
  const bad=structuredClone(backup);bad.biometricDevices[0].protocolProfile="INVALID";
  expect(()=>validateBiometricAttendanceBackupRows(bad)).toThrow("protocolProfile is unsupported");
  const target=restoreTarget!,result:any={...Object.fromEntries(BIOMETRIC_ATTENDANCE_BACKUP_KEYS.map(k=>[k,{created:0,updated:0,skipped:0,errors:[]}])),warnings:[]};
  await restoreBiometricAttendanceBackup(target,backup,{users:new Map(),staffMembers:new Map(),restoredBy:"synthetic-export-approver"},result);
  expect(BIOMETRIC_ATTENDANCE_BACKUP_KEYS.every(k=>result[k].errors.length===0)).toBe(true);
  expect(result.biometricRawPunches).toMatchObject({created:2,updated:0,skipped:0,errors:[]});
  const punches=await target.biometricRawPunch.findMany({orderBy:{punchTimestamp:"asc"}});
  expect(punches.map(r=>r.punchTimestamp.toISOString())).toEqual(["2026-10-02T03:30:00.000Z","2026-10-02T03:30:01.000Z"]);
  expect(punches.map(r=>r.punchCode)).toEqual(["IN","OUT"]);expect(punches.every(r=>r.protocolProfile==="ETIMETRACKLITE_RAW_EXPORT_V1")).toBe(true);
  expect(await target.biometricReplayNonce.count()).toBe(0);
  await expect(target.biometricRawPunch.update({where:{id:punches[0].id},data:{punchCode:"OUT"}})).rejects.toThrow();
  // Original migration coverage remains an unsupported target for this new data.
  // This is the owner's original SQLite guard, not a claim about frozen v48.
  const original=new DatabaseSync(":memory:");
  try{
    for(const migration of readdirSync("prisma/migrations",{withFileTypes:true}).filter(e=>e.isDirectory()&&e.name!=="20261007123000_etimetracklite_raw_export_profile_1a").map(e=>e.name).sort())original.exec(readFileSync(path.join("prisma/migrations",migration,"migration.sql"),"utf8"));
    original.exec(`INSERT INTO BiometricBridge(id,publicBridgeId,label,publicSigningKey,publicKeyHash,updatedAt) VALUES('synthetic-old-bridge','00000000-0000-4000-8000-000000000088','SYNTHETIC','SYNTHETIC','SYNTHETIC',CURRENT_TIMESTAMP)`);
    expect(()=>original.exec(`INSERT INTO BiometricDevice(id,publicDeviceId,bridgeId,vendor,model,campus,location,protocolProfile,protocolProofStatus,updatedAt) VALUES('synthetic-old-device','00000000-0000-4000-8000-000000000089','synthetic-old-bridge','SYNTHETIC','SYNTHETIC','SYNTHETIC','SYNTHETIC','ETIMETRACKLITE_RAW_EXPORT_V1','ADAPTER_CONTRACT_PENDING',CURRENT_TIMESTAMP)`)).toThrow("BIOMETRIC_DEVICE_CONTRACT_INVALID");
    expect(original.prepare("SELECT count(*) AS count FROM BiometricDevice").get()).toEqual({count:0});
  }finally{original.close();}
});
